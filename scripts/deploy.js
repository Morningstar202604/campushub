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
 *
 * 结构约定：main 只做编排（解析 → 构建 → 凭据 → 枚举 → 上传 → 报告），
 * 每个阶段一个函数，各自可单测、可目读。加新阶段时新写函数，不要往 main 里堆分支。
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

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
// 部署物 = 构建期内联产物，而不是 cloudfunctions/ 源码目录。
// 源码目录里不再有内核副本；把内核打进每个函数是 build-functions.js 的职责，
// 这样"上传的是当前源码"由构建保证，而不是靠人记得先跑一次同步。
const SRC_DIR = path.join(ROOT, 'cloudfunctions')
const CF_DIR = path.join(ROOT, 'dist', 'cloudfunctions')

// ---------- 前置构建（先于一切上传动作）----------
// 内核只在 cloudfunctions/common/ 存一份源码，构建时内联进每个函数产物。
// 部署前强制重建，杜绝"改了内核没同步/传了旧副本"这类漂移上线。
function prebuild() {
  console.log('前置构建：把内核内联进各云函数 → dist/cloudfunctions/')
  if (!fs.existsSync(SRC_DIR)) fail(`缺少源码目录：${SRC_DIR}`)
  try {
    execSync('node scripts/build-functions.js', { stdio: 'inherit', cwd: ROOT })
    execSync('node scripts/build-functions.js --check', { stdio: 'inherit', cwd: ROOT })
  } catch (e) {
    fail(`前置构建/校验失败，终止部署：${e.message}`)
  }
  if (!fs.existsSync(CF_DIR)) fail(`缺少构建产物目录：${CF_DIR}（请先 npm run build:functions）`)
}

// ---------- 凭据解析 ----------
// CLI 参数 > 环境变量 > deploy.config.json；B64 私钥先落临时文件再返回路径，
// 调用方负责在部署结束后清理（见 main）。
function loadFileConfig() {
  const configPath = path.join(__dirname, 'deploy.config.json')
  if (!fs.existsSync(configPath)) return {}
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (e) {
    fail(`deploy.config.json 解析失败：${e.message}`)
  }
}

/** 取第一个非空值（CLI > 环境变量 > 配置文件 的通用形态） */
function firstDefined(...values) {
  for (const v of values) if (v) return v
  return undefined
}

function envIdFromFile(fileConfig, targetEnv) {
  const env = fileConfig.environments && fileConfig.environments[targetEnv]
  return env && env.envId
}

/** 私钥定位：路径优先；无路径时把 B64 环境变量落成临时文件（返回路径供清理） */
function resolvePrivateKey(args, fileConfig) {
  const fromArgs = firstDefined(
    args['private-key-path'],
    process.env.WX_UPLOAD_PRIVATE_KEY_PATH,
    fileConfig.privateKeyPath
  )
  if (fromArgs) return { privateKeyPath: fromArgs, tmpKeyFile: null }
  if (process.env.WX_UPLOAD_PRIVATE_KEY_B64) {
    const tmpKeyFile = path.join(os.tmpdir(), `campushub-upload-key-${Date.now()}.key`)
    fs.writeFileSync(tmpKeyFile, Buffer.from(process.env.WX_UPLOAD_PRIVATE_KEY_B64, 'base64'))
    return { privateKeyPath: tmpKeyFile, tmpKeyFile }
  }
  return { privateKeyPath: '', tmpKeyFile: null }
}

function assertCredentials(appid, envId, privateKeyPath, targetEnv) {
  if (!appid) fail('缺少 AppID：请通过 --appid、环境变量 WX_APPID 或 deploy.config.json 提供')
  if (!envId)
    fail(
      `缺少云环境 ID：请通过 --env-id、环境变量 CLOUD_ENV_ID 或 deploy.config.json environments.${targetEnv}.envId 提供`
    )
  if (!privateKeyPath)
    fail(
      '缺少上传私钥：请通过 --private-key-path、WX_UPLOAD_PRIVATE_KEY_PATH 或 WX_UPLOAD_PRIVATE_KEY_B64 提供'
    )
  if (!fs.existsSync(privateKeyPath)) fail(`私钥文件不存在：${privateKeyPath}`)
}

function resolveCredentials(args, targetEnv) {
  const fileConfig = loadFileConfig()
  const appid = firstDefined(args.appid, process.env.WX_APPID, fileConfig.appid)
  const envId = firstDefined(
    args['env-id'],
    process.env.CLOUD_ENV_ID,
    envIdFromFile(fileConfig, targetEnv)
  )
  const { privateKeyPath, tmpKeyFile } = resolvePrivateKey(args, fileConfig)
  assertCredentials(appid, envId, privateKeyPath, targetEnv)
  return { appid, envId, privateKeyPath, tmpKeyFile }
}

// ---------- 枚举云函数 ----------
// 只枚举构建产物里有 index.js 的目录；--only 传空串等价于"谁都不部署"，
// 与旧实现一致（走"没有可部署的云函数"分支，不静默升级为全量）。
function parseOnly(raw) {
  return raw
    ? String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null
}

function enumerateFunctions(only) {
  const functions = fs
    .readdirSync(CF_DIR)
    .filter((name) => {
      if (name === 'common') return false
      const dir = path.join(CF_DIR, name)
      return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'index.js'))
    })
    .filter((name) => !only || only.includes(name))
    .sort()
    .map((name) => ({ name, path: path.join(CF_DIR, name) }))

  if (only) {
    const found = new Set(functions.map((f) => f.name))
    const missing = only.filter((n) => !found.has(n))
    if (missing.length) fail(`--only 指定的函数不存在或缺少 index.js：${missing.join(', ')}`)
  }
  if (!functions.length) fail('没有可部署的云函数')
  return functions
}

// ---------- 预部署：源码目录不得残留内核副本 ----------
// 副本一旦回到源码目录，"产物永远等于当前内核"这个前提就失效了，直接中止。
function assertNoKernelLeftovers() {
  const leftovers = []
  for (const name of fs.readdirSync(SRC_DIR)) {
    const dir = path.join(SRC_DIR, name)
    if (name === 'common' || !fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      if (/^common-[a-z]+\.js$/.test(f)) leftovers.push(`${name}/${f}`)
    }
  }
  if (leftovers.length) {
    fail(
      `源码目录残留 ${leftovers.length} 份内核副本（会导致漂移上线），请删除后重试：${leftovers.slice(0, 5).join(', ')}`
    )
  }
  console.log('✓ 源码目录零副本，部署物由构建期内联')
}

// ---------- 并发部署 ----------
// 固定 worker 池（默认 4，上限 8）：云上传有配额速率限制，并发不是越大越好。
async function deployAll(ci, project, creds, functions, concurrency, targetEnv) {
  const results = []
  let cursor = 0

  async function worker() {
    while (cursor < functions.length) {
      const fn = functions[cursor++]
      try {
        await ci.cloud.uploadFunctions({
          project,
          env: creds.envId,
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

  console.log(
    `开始部署 ${functions.length} 个云函数到环境「${targetEnv}」(${creds.envId})，并发=${concurrency}`
  )
  const startedAt = Date.now()
  await Promise.all(Array.from({ length: Math.min(concurrency, functions.length) }, worker))
  return { results, startedAt }
}

function reportResults(results, startedAt) {
  const failed = results.filter((r) => !r.ok)
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`\n完成：成功 ${results.length - failed.length}/${results.length}，耗时 ${seconds}s`)

  if (results.some((r) => r.name === 'task-expire')) {
    console.log('\n提醒：task-expire 为定时触发器函数。若该环境首次部署，请到')
    console.log('开发者工具右键 task-expire →「上传触发器」确认 cron（当前为每 6 小时）。')
  }

  if (failed.length) {
    console.error(
      `\n以下函数部署失败，可单独重试：node scripts/deploy.js --only ${failed.map((f) => f.name).join(',')}`
    )
    process.exit(1)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const targetEnv = args.env || 'prod'

  prebuild()
  const creds = resolveCredentials(args, targetEnv)
  const functions = enumerateFunctions(parseOnly(args.only))

  let ci
  try {
    ci = require('miniprogram-ci')
  } catch {
    fail('未安装 miniprogram-ci，请先执行：npm install（或 npm i -D miniprogram-ci）')
  }

  let project
  try {
    project = new ci.Project({
      appid: creds.appid,
      type: 'miniProgram',
      projectPath: ROOT,
      privateKeyPath: creds.privateKeyPath,
      ignores: ['node_modules/**/*']
    })
  } catch (e) {
    fail(`miniprogram-ci Project 初始化失败：${e.message}`)
  }

  assertNoKernelLeftovers()

  const concurrency = Math.max(1, Math.min(8, Number(args.concurrency || 4)))
  const { results, startedAt } = await deployAll(
    ci,
    project,
    creds,
    functions,
    concurrency,
    targetEnv
  )

  if (creds.tmpKeyFile) {
    try {
      fs.unlinkSync(creds.tmpKeyFile)
    } catch {
      /* ignore */
    }
  }

  reportResults(results, startedAt)
}

main().catch((e) => fail(e.stack || e.message))
