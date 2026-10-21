#!/usr/bin/env node
/**
 * push-github.js — 通过 GitHub REST API 把一个「完整快照」推到指定仓库的 main。
 *
 * 为什么不用 git push：本机到 github.com 的 git 传输会被重置（Recv failure），
 * 但 api.github.com 可用，因此改走 Git Data API 组装 tree + commit + 更新 ref。
 *
 * 用法：
 *   GH_TOKEN=xxx node scripts/push-github.js <owner/repo> [--branch main] [--message "..."]
 *
 * 特点：
 *   - 不依赖本地 .git 历史（镜像仓库的历史与本地不同步也无妨）；
 *   - 不经过 git 传输层，适合被网络策略拦截的场景；
 *   - 逐文件上传 blob（大仓库会慢，但对本项目规模足够）。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const API = 'https://api.github.com'

const args = process.argv.slice(2)
const slug = args[0]
if (!slug || !/^[^/]+\/[^/]+$/.test(slug)) {
  console.error('用法: node scripts/push-github.js <owner/repo> [--branch main] [--message "..."]')
  process.exit(1)
}
const getArg = (name, def) => {
  const i = args.indexOf('--' + name)
  return i > -1 ? args[i + 1] : def
}
const BRANCH = getArg('branch', 'main')
const MESSAGE = getArg('message', 'chore: sync from local workspace')
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!TOKEN) {
  console.error('缺少 GH_TOKEN')
  process.exit(1)
}

// 与 .gitignore 保持一致：这些目录不进仓库
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'unpackage',
  '.gradle',
  'build',
  '.hbuilderx',
  '.v2c'
])
const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'local.properties'])
const IGNORE_EXT = ['.log', '.apk', '.out.txt']

async function api(method, p, body) {
  const res = await fetch(API + p, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new Error(`${method} ${p} -> ${res.status} ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data
}

function collectFiles(dir, base = '') {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // 只跳过 .git 本身；.github 必须保留（CI 工作流就在这里）
    if (entry.name === '.git') continue
    const rel = base ? `${base}/${entry.name}` : entry.name
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      if (ignoredPath(rel)) continue
      out.push(...collectFiles(abs, rel))
    } else {
      if (IGNORE_FILES.has(entry.name)) continue
      if (IGNORE_EXT.some((e) => entry.name.endsWith(e))) continue
      if (ignoredPath(rel)) continue
      out.push({ rel, abs })
    }
  }
  return out
}

// .gitignore 里的路径规则（本项目用到的几条）
function ignoredPath(rel) {
  if (rel.startsWith('android/app/src/main/assets/www/')) return true
  if (rel.startsWith('android/app/build/')) return true
  if (rel.startsWith('android/.gradle/')) return true
  if (rel.startsWith('out/')) return true
  if (rel.startsWith('uni-app/dist/')) return true
  return false
}

async function main() {
  console.log(`[push-github] 目标 ${slug} 分支 ${BRANCH}`)

  // 1) 取远端最新 commit（可能是镜像自己的 chore 提交），拿它的 tree 作 base 以便保留历史
  let parentSha = null
  try {
    const ref = await api('GET', `/repos/${slug}/git/ref/heads/${BRANCH}`)
    parentSha = ref.object.sha
    console.log(`[push-github] 远端当前 HEAD: ${parentSha.slice(0, 7)}`)
  } catch {
    console.log('[push-github] 远端无该分支，将创建首个提交')
  }

  const files = collectFiles(ROOT)
  console.log(`[push-github] 待上传文件: ${files.length} 个`)

  // 2) 上传 blob
  const tree = []
  let done = 0
  for (const f of files) {
    const buf = fs.readFileSync(f.abs)
    const blob = await api('POST', `/repos/${slug}/git/blobs`, {
      content: buf.toString('base64'),
      encoding: 'base64'
    })
    tree.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha })
    done++
    if (done % 50 === 0) console.log(`  已上传 ${done}/${files.length}`)
  }

  // 3) 建 tree（不基于远端 tree：我们是完整快照，避免残留已删除文件）
  const treeRes = await api('POST', `/repos/${slug}/git/trees`, { tree })
  console.log(`[push-github] tree: ${treeRes.sha.slice(0, 7)}`)

  // 4) 建 commit
  const commitRes = await api('POST', `/repos/${slug}/git/commits`, {
    message: MESSAGE,
    tree: treeRes.sha,
    parents: parentSha ? [parentSha] : []
  })
  console.log(`[push-github] commit: ${commitRes.sha.slice(0, 7)}`)

  // 5) 更新 ref（非快进也强制更新，因为镜像历史本来就和本地不同）
  await api('PATCH', `/repos/${slug}/git/refs/heads/${BRANCH}`, {
    sha: commitRes.sha,
    force: true
  })
  console.log(`[push-github] ✓ 已更新 ${slug}@${BRANCH} -> ${commitRes.sha.slice(0, 7)}`)
}

main().catch((e) => {
  console.error('[push-github] 失败:', e.message)
  process.exit(1)
})
