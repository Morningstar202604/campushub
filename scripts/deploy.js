#!/usr/bin/env node
/**
 * scripts/deploy.js — 一键批量部署全部云函数（基于 miniprogram-ci 官方能力）
 *
 * 用法：
 *   npm run deploy -- --env prod                 # 使用 scripts/deploy.config.json 中 prod 环境配置
 *   node scripts/deploy.js --env dev --only login,post-list
 *   node scripts/deploy.js --appid wx123 --private-key-path ./private.key --env-id my-env-id
 *
 * 凭据解析优先级：CLI 参数 > 环境变量（WX_APPID / WX_UPLOAD_PRIVATE_KEY_PATH /
 * WX_UPLOAD_PRIVATE_KEY_B64 / CLOUD_ENV_ID）> scripts/deploy.config.json
 *
 * 安全约定：私钥与配置文件不入库（.gitignore 已排除），CI 中经 Secrets 注入。
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

// ---------- CLI 解析 ----------
function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        args[key] = true
      } else {
        args[key] = next
        i++
      }
    } else {
      args._.push(a)
    }
  }
  return args
}

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const ROOT = path.resolve(__dirname, '..')
const CF_DIR = path.join(ROOT, 'cloudfunctions')

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const targetEnv = args.env || 'prod'

  // ---------- 配置合并 ----------
  let fileConfig = {}
  const configPath = path.join(__dirname, 'deploy.config.json')
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } catch (e) {
      fail(`deploy.config.json 解析失败：${e.message}`)
    }
  }

  const appid = args.appid || process.env.WX_APPID || fileConfig.appid
  const envId =
    args['env-id'] ||
    process.env.CLOUD_ENV_ID ||
    (fileConfig.environments && fileConfig.environments[targetEnv] && fileConfig.environments[targetEnv].envId)

  // ---------- 私钥定位 ----------
  let privateKeyPath = args['private-key-path'] || process.env.WX_UPLOAD_PRIVATE_KEY_PATH || fileConfig.privateKeyPath
  let tmpKeyFile = null
  if (!privateKeyPath && process.env.WX_UPLOAD_PRIVATE_KEY_B64) {
    tmpKeyFile = path.join(os.tmpdir(), `campushub-upload-key-${Date.now()}.key`)
    fs.writeFileSync(tmpKeyFile, Buffer.from(process.env.WX_UPLOAD_PRIVATE_KEY_B64, 'base64'))
    privateKeyPath = tmpKeyFile
  }

  if (!appid) fail('缺少 AppID：请通过 --appid、环境变量 WX_APPID 或 deploy.config.json 提供')
  if (!envId) fail(`缺少云环境 ID：请通过 --env-id、环境变量 CLOUD_ENV_ID 或 deploy.config.json environments.${targetEnv}.envId 提供`)
  if (!privateKeyPath) fail('缺少上传私钥：请通过 --private-key-path、WX_UPLOAD_PRIVATE_KEY_PATH 或 WX_UPLOAD_PRIVATE_KEY_B64 提供')
  if (!fs.existsSync(privateKeyPath)) fail(`私钥文件不存在：${privateKeyPath}`)

  // ---------- 枚举云函数 ----------
  const only = args.only ? String(args.only).split(',').map(s => s.trim()).filter(Boolean) : null
  const functions = fs.readdirSync(CF_DIR)
    .filter((name) => {
      if (name === 'common') return false
      const dir = path.join(CF_DIR, name)
      return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'index.js'))
    })
    .filter((name) => !only || only.includes(name))
    .sort()
    .map((name) => ({ name, path: path.join(CF_DIR, name) }))

  if (only) {
    const found = new Set(functions.map(f => f.name))
    const missing = only.filter(n => !found.has(n))
    if (missing.length) fail(`--only 指定的函数不存在或缺少 index.js：${missing.join(', ')}`)
  }
  if (!functions.length) fail('没有可部署的云函数')

  // ---------- 加载 miniprogram-ci ----------
  let ci
  try {
    ci = require('miniprogram-ci')
  } catch (e) {
    fail('未安装 miniprogram-ci，请先执行：npm install（或 npm i -D miniprogram-ci）')
  }

  let project
  try {
    project = new ci.Project({
      appid,
      type: 'miniProgram',
      projectPath: ROOT,
      privateKeyPath,
      ignores: ['node_modules/**/*']
    })
  } catch (e) {
    fail(`miniprogram-ci Project 初始化失败：${e.message}`)
  }

  // ---------- 并发部署 ----------
  const concurrency = Math.max(1, Math.min(8, Number(args.concurrency || 4)))
  const results = []
  let cursor = 0

  async function worker() {
    while (cursor < functions.length) {
      const fn = functions[cursor++]
      try {
        await ci.cloud.uploadFunctions({
          project,
          env: envId,
          functions: [{ name: fn.name, path: fn.path }],
          remoteNpmInstall: true
        })
        results.push({ ...fn, ok: true })
        console.log(`✓ ${fn.name} 部署成功`)
      } catch (e) {
        results.push({ ...fn, ok: false, error: e.message })
        console.error(`✗ ${fn.name} 部署失败：${e.message}`)
      }
    }
  }

  console.log(`开始部署 ${functions.length} 个云函数到环境「${targetEnv}」(${envId})，并发=${concurrency}`)
  const startedAt = Date.now()
  await Promise.all(Array.from({ length: Math.min(concurrency, functions.length) }, worker))

  if (tmpKeyFile) {
    try { fs.unlinkSync(tmpKeyFile) } catch (e) { /* ignore */ }
  }

  const failed = results.filter(r => !r.ok)
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n完成：成功 ${results.length - failed.length}/${results.length}，耗时 ${seconds}s`)

  if (functions.some(f => f.name === 'task-expire')) {
    console.log('\n提醒：task-expire 为定时触发器函数。若该环境首次部署，请到')
    console.log('开发者工具右键 task-expire →「上传触发器」确认 cron（当前为每 6 小时）。')
  }

  if (failed.length) {
    console.error(`\n以下函数部署失败，可单独重试：node scripts/deploy.js --only ${failed.map(f => f.name).join(',')}`)
    process.exit(1)
  }
}

main().catch((e) => fail(e.stack || e.message))
