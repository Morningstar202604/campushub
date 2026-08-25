#!/usr/bin/env node
/**
 * scripts/doctor.js — 部署前自检（一键体检）
 *
 * 用法：
 *   npm run doctor            # 常规体检：错误导致退出码 1，警告不阻断
 *   node scripts/doctor.js --strict   # 警告也视为失败（CI 用）
 *
 * 检查项：
 *  1. project.config.json 的 AppID 是否已填写
 *  2. app.js 云环境 ID 是否仍是占位符
 *  3. 每个云函数目录结构完整（index.js / package.json）
 *  4. common 内核是否已同步到全部云函数（md5 一致性）
 *  5. tdesign-miniprogram 已安装、miniprogram_npm 已构建
 *  6. deploy.config.json 是否存在（可选，部署自动化用）
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const strict = process.argv.includes('--strict')

let errors = 0
let warns = 0

function ok(msg) { console.log(`✓ ${msg}`) }
function warn(msg) { warns++; console.log(`⚠ ${msg}`) }
function err(msg) { errors++; console.log(`✗ ${msg}`) }

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex')
}

// ---------- 1. AppID ----------
function checkAppid() {
  const cfgPath = path.join(ROOT, 'project.config.json')
  if (!fs.existsSync(cfgPath)) {
    err('project.config.json 不存在')
    return
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    if (!cfg.appid || cfg.appid === 'touristappid') {
      err(`project.config.json 的 appid 未填写（当前值：${cfg.appid || '空'}）`)
    } else {
      ok(`AppID 已配置：${cfg.appid}`)
    }
  } catch (e) {
    err(`project.config.json 解析失败：${e.message}`)
  }
}

// ---------- 2. 云环境 ID ----------
function checkEnvId() {
  const appJs = fs.readFileSync(path.join(ROOT, 'miniprogram', 'app.js'), 'utf8')
  const m = appJs.match(/env:\s*'([^']*)'/)
  const envId = m ? m[1] : ''
  if (!envId) {
    err("miniprogram/app.js 未找到 wx.cloud.init 的 env 配置")
  } else if (envId.includes('你的') || envId.includes('替换')) {
    err(`miniprogram/app.js 云环境 ID 仍是占位符：'${envId}'`)
  } else if (envId === 'campushub') {
    warn(`miniprogram/app.js env='${envId}'，若这是默认占位值请改为真实环境 ID`)
  } else {
    ok(`云环境 ID：${envId}`)
  }
}

// ---------- 3+4. 云函数清单与 common 同步一致性 ----------
const COMMON_FILES = [
  'common-bundle.js', 'common-content.js', 'common-context.js', 'common-db.js',
  'common-error.js', 'common-indexes.js', 'common-rate.js', 'common-security.js',
  'common-subscribe.js'
]

function checkFunctions() {
  if (!fs.existsSync(path.join(ROOT, 'cloudfunctions'))) {
    err('cloudfunctions/ 目录不存在')
    return
  }
  const dirs = fs.readdirSync(path.join(ROOT, 'cloudfunctions'), { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'common')
    .map(d => d.name)
    .sort()

  let structBad = 0
  let driftFns = []

  for (const name of dirs) {
    const dir = path.join(ROOT, 'cloudfunctions', name)
    const hasIndex = fs.existsSync(path.join(dir, 'index.js'))
    const hasPkg = fs.existsSync(path.join(dir, 'package.json'))
    if (!hasIndex || !hasPkg) {
      err(`${name}：缺少 ${[!hasIndex && 'index.js', !hasPkg && 'package.json'].filter(Boolean).join(' 与 ')}`)
      structBad++
      continue
    }
    // common 同步漂移检测
    for (const f of COMMON_FILES) {
      const src = path.join(ROOT, 'cloudfunctions', 'common', f)
      const dst = path.join(dir, f)
      if (!fs.existsSync(src)) continue // 未知内核文件跳过
      if (!fs.existsSync(dst)) {
        driftFns.push(name)
        break
      }
      if (md5(src) !== md5(dst)) {
        driftFns.push(name)
        break
      }
    }
  }

  if (structBad === 0) ok(`${dirs.length} 个云函数目录结构完整`)
  if (driftFns.length) {
    err(`common 内核未同步或已漂移的函数（${driftFns.length} 个）：${driftFns.slice(0, 10).join(', ')}${driftFns.length > 10 ? ' ...' : ''}`)
    console.log('  → 执行 npm run sync:common 后重新检查')
  } else {
    ok('common 内核已同步到全部云函数（md5 一致）')
  }
}

// ---------- 5. 依赖与构建 ----------
function checkDeps() {
  if (fs.existsSync(path.join(ROOT, 'node_modules', 'tdesign-miniprogram'))) {
    ok('tdesign-miniprogram 已安装')
  } else {
    warn('tdesign-miniprogram 未安装：请执行 npm install')
  }
  if (fs.existsSync(path.join(ROOT, 'miniprogram', 'miniprogram_npm'))) {
    ok('miniprogram_npm 已构建')
  } else {
    warn('miniprogram_npm 不存在：请在微信开发者工具执行「工具 → 构建 npm」')
  }
}

// ---------- 6. 部署配置 ----------
function checkDeployConfig() {
  const p = path.join(__dirname, 'deploy.config.json')
  if (fs.existsSync(p)) {
    ok('scripts/deploy.config.json 存在（npm run deploy 可用）')
  } else {
    console.log('ℹ scripts/deploy.config.json 不存在（可选）：配置后可用 npm run deploy 一键部署云函数')
  }
}

console.log('CampusHub doctor 自检\n=====================')
checkAppid()
checkEnvId()
checkFunctions()
checkDeps()
checkDeployConfig()

console.log(`\n结果：${errors} 个错误，${warns} 个警告`)
if (errors > 0 || (strict && warns > 0)) {
  process.exit(1)
}
console.log('通过 ✓')
