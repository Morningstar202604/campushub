#!/usr/bin/env node
// scripts/build-functions.js — 云函数构建期内联（取代"复制内核到 37 个目录"）
//
// 为什么要有这个脚本：
//   云开发不支持跨函数共享代码，仓库原本用 sync:common 把 9 个内核模块
//   复制进 37 个函数目录（333 份副本），而 common-bundle.js 运行时 require 的正是这些副本。
//   结果只要有人改了 cloudfunctions/common/ 却漏跑一次同步，线上就跑旧内核 ——
//   v0.9.3 就因此把限频器退化成了 fail-open（见 AUDIT 与 tests/common-sync.test.js）。
//
//   现在：内核只保留一份源码，构建时用 esbuild 把它内联进每个函数的单文件产物，
//   产物只存在于 dist/，不入库。漂移在结构上不再可能：产物永远是"当前源码 + 当前业务代码"。
//
// 用法：npm run build:functions       构建全部函数到 dist/cloudfunctions/
//       npm run build:functions -- --check   只校验产物是否与源码一致（CI 用，不写文件）
//
// 约束：
//   - wx-server-sdk 必须保持 external：云端运行时注入，打进包会破坏云调用与依赖安装。
//   - 每个函数的 package.json（云端装依赖）与 config.json（云调用权限 / 定时触发器）必须原样带进产物。

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'cloudfunctions')
const COMMON_DIR = path.join(SRC, 'common')
const OUT = path.join(ROOT, 'dist', 'cloudfunctions')

const CHECK_ONLY = process.argv.includes('--check')

let esbuild
try {
  esbuild = require('esbuild')
} catch {
  console.error('✗ 需要构建期依赖 esbuild：npm install --include=dev')
  process.exit(1)
}

function listFunctions() {
  return fs
    .readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'common' && d.name !== 'node_modules')
    .map((d) => d.name)
    .sort()
}

// 把函数目录里的 './common-xxx' 指向唯一内核源码；common 目录内部的相互 require 保持原样。
const kernelRedirect = {
  name: 'campushub-kernel',
  setup(build) {
    build.onResolve({ filter: /^\.\/common-/ }, (args) => {
      if (path.resolve(args.resolveDir) === COMMON_DIR) return undefined
      const base = path.basename(args.path)
      const target = path.join(COMMON_DIR, base.endsWith('.js') ? base : base + '.js')
      if (!fs.existsSync(target)) {
        return { errors: [{ text: `内核模块不存在：${base}` }] }
      }
      return { path: target }
    })
  }
}

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
}

// 源码指纹：函数自身代码 + 全部内核源码 + 随附配置。
// 任何一个变了，产物都算"过期"——这就是取代 sync 校验的方式。
function sourceFingerprint(fn) {
  const parts = []
  // 递归收集：网关的 handlers/ 子目录同样是源码，必须参与新鲜度指纹，
  // 否则改了 handler 不会被判定为"产物过期"，等于把刚修掉的漂移换个地方重演。
  const walk = (dir, prefix) => {
    for (const f of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? `${prefix}/${f.name}` : f.name
      if (f.isDirectory()) {
        walk(path.join(dir, f.name), rel)
        continue
      }
      if (/^common-[a-z]+\.js$/.test(f.name)) continue // 旧副本不参与指纹（应当已不存在）
      parts.push(rel, sha1(path.join(dir, f.name)))
    }
  }
  walk(path.join(SRC, fn), '')
  for (const f of fs.readdirSync(COMMON_DIR).sort()) {
    if (f.endsWith('.js')) parts.push('kernel', f, sha1(path.join(COMMON_DIR, f)))
  }
  return crypto.createHash('sha1').update(parts.join('\n')).digest('hex')
}

async function buildOne(fn) {
  const outDir = path.join(OUT, fn)
  const outIndex = path.join(outDir, 'index.js')
  const stampFile = path.join(outDir, '.source-stamp')

  const fp = sourceFingerprint(fn)
  if (fs.existsSync(outIndex) && fs.existsSync(stampFile)) {
    if (fs.readFileSync(stampFile, 'utf8').trim() === fp) return { fn, skipped: true }
  }

  if (CHECK_ONLY) return { fn, stale: true }

  fs.mkdirSync(outDir, { recursive: true })
  await esbuild.build({
    entryPoints: [path.join(SRC, fn, 'index.js')],
    outfile: outIndex,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: ['node16'],
    minify: false,
    // 云函数按目录整体上传，产物里保留可读源码更利于排查线上堆栈
    legalComments: 'none',
    // 默认 ascii 会把中文报错转成 \uXXXX，云端日志与产物排查都难读，这里保持字面量
    charset: 'utf8',
    external: ['wx-server-sdk'],
    plugins: [kernelRedirect],
    logLevel: 'silent'
  })
  for (const f of ['package.json', 'config.json']) {
    const p = path.join(SRC, fn, f)
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(outDir, f))
  }
  fs.writeFileSync(stampFile, fp + os.EOL)
  return { fn, built: true }
}

async function main() {
  const fns = listFunctions()
  if (!fns.length) {
    console.error('✗ 没找到任何云函数目录')
    process.exit(1)
  }

  // 陈旧副本必须清场：它们会让"产物内联的是源码"这个前提失真
  const leftovers = []
  for (const fn of fns) {
    const scan = (dir, rel) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
          scan(path.join(dir, ent.name), `${rel}/${ent.name}`)
          continue
        }
        if (/^common-[a-z]+\.js$/.test(ent.name)) leftovers.push(`${rel}/${ent.name}`)
      }
    }
    scan(path.join(SRC, fn), fn)
  }
  if (leftovers.length) {
    console.error(`✗ 函数目录里仍有 ${leftovers.length} 份内核副本（构建期内联后不应存在）`)
    console.error(
      '  请删除它们：' + leftovers.slice(0, 5).join(', ') + (leftovers.length > 5 ? ' ...' : '')
    )
    process.exit(1)
  }

  if (!CHECK_ONLY) {
    // 只清理"已不存在的函数"留下的陈旧产物目录。
    // 不能整棵 dist 删掉重建：测试与 CI 会并发读产物，整目录删除会造成瞬时空窗。
    if (fs.existsSync(OUT)) {
      const alive = new Set(fns)
      for (const name of fs.readdirSync(OUT)) {
        if (!alive.has(name)) fs.rmSync(path.join(OUT, name), { recursive: true, force: true })
      }
    }
  }

  const results = []
  for (const fn of fns) results.push(await buildOne(fn))

  const stale = results.filter((r) => r.stale)
  if (CHECK_ONLY) {
    if (stale.length) {
      console.error(`✗ 产物过期或缺失（${stale.length} 个）：${stale.map((s) => s.fn).join(', ')}`)
      console.error('  执行 npm run build:functions 后重试')
      process.exit(1)
    }
    console.log(`✓ ${fns.length} 个云函数产物与源码一致`)
    return
  }

  console.log(
    `✓ 已内联构建 ${fns.length} 个云函数 → dist/cloudfunctions/（wx-server-sdk 保持 external）`
  )
  const total = fns
    .map((f) => {
      const p = path.join(OUT, f, 'index.js')
      return fs.existsSync(p) ? fs.statSync(p).size : 0
    })
    .reduce((a, b) => a + b, 0)
  console.log(
    `  产物合计 ${(total / 1024).toFixed(1)} KB，平均每函数 ${(total / fns.length / 1024).toFixed(1)} KB`
  )
}

main().catch((e) => {
  console.error('✗ 构建失败：', e && (e.message || e))
  process.exit(1)
})
