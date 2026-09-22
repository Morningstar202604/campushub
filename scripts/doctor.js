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
 *  7. wx-server-sdk 版本基线：各函数声明 === common/package-lock.json 锁定版本
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
const MANIFEST = path.join(ROOT, 'cloudfunctions', 'common', '.sync-manifest.json')

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
    }
  }

  // 优先用 manifest 指纹校验；缺失/损坏则回退到逐文件 md5
  let usedManifest = false
  if (fs.existsSync(MANIFEST)) {
    let manifest = null
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) } catch (e) { /* fallback */ }
    if (manifest && Array.isArray(manifest.files)) {
      usedManifest = true
      const shaMap = new Map(manifest.files.map(f => [f.name, f.sha1]))
      for (const name of dirs) {
        const dir = path.join(ROOT, 'cloudfunctions', name)
        for (const f of COMMON_FILES) {
          const dst = path.join(dir, f)
          const expected = shaMap.get(f)
          if (!expected) continue
          if (!fs.existsSync(dst)) { driftFns.push(name); break }
          const actual = crypto.createHash('sha1').update(fs.readFileSync(dst)).digest('hex')
          if (actual !== expected) { driftFns.push(name); break }
        }
      }
    }
  }
  if (!usedManifest) {
    for (const name of dirs) {
      const dir = path.join(ROOT, 'cloudfunctions', name)
      for (const f of COMMON_FILES) {
        const src = path.join(ROOT, 'cloudfunctions', 'common', f)
        const dst = path.join(dir, f)
        if (!fs.existsSync(src)) continue
        if (!fs.existsSync(dst) || md5(src) !== md5(dst)) {
          driftFns.push(name)
          break
        }
      }
    }
  }

  if (structBad === 0) ok(`${dirs.length} 个云函数目录结构完整`)
  if (driftFns.length) {
    err(`common 内核未同步或已漂移的函数（${driftFns.length} 个）：${driftFns.slice(0, 10).join(', ')}${driftFns.length > 10 ? ' ...' : ''}`)
    console.log('  → 执行 npm run sync:common 后重新检查')
  } else {
    ok(`common 内核已同步到全部云函数（${usedManifest ? 'SHA1 指纹' : 'md5'} 一致）`)
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

// ---------- 5.5 新增功能函数检查 ----------
const REQUIRED_NEW_FNS = ['backup-db', 'announcement', 'points']
function checkNewFns() {
  let missing = 0
  for (const fn of REQUIRED_NEW_FNS) {
    const dir = path.join(ROOT, 'cloudfunctions', fn)
    if (!fs.existsSync(path.join(dir, 'index.js')) || !fs.existsSync(path.join(dir, 'package.json'))) {
      err(`功能函数 ${fn} 目录不完整`)
      missing++
    }
  }
  if (!missing) ok('新增功能函数（backup-db / announcement / points）目录完整')
  const backupCfg = path.join(ROOT, 'cloudfunctions', 'backup-db', 'config.json')
  if (fs.existsSync(backupCfg)) ok('backup-db 定时触发器配置存在（需在控制台单独上传触发器）')
  else warn('backup-db/config.json 缺失：将无法自动备份')
}

// ---------- 5.6 换校配置检查 ----------
function checkSchoolConfig() {
  const p = path.join(ROOT, 'config', 'school.json')
  if (fs.existsSync(p)) {
    ok('config/school.json 存在（换校配置就绪）')
  } else if (fs.existsSync(path.join(ROOT, 'config', 'school.default.json'))) {
    console.log('ℹ config/school.json 不存在：部署新学校时 cp config/school.default.json config/school.json 填写（见 docs/SCHOOL_SETUP.md）')
  } else {
    warn('config/ 目录缺少学校配置模板')
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

// ---------- 6.5 依赖版本基线（wx-server-sdk 锁定一致性，档位2改造③）----------
// 以 cloudfunctions/common/package-lock.json 锁定的 wx-server-sdk 版本为唯一基准，
// 检查每个云函数 package.json 声明的 wx-server-sdk 是否与其一致。
// 不一致 → 告警（云端 remoteNpmInstall 会按各自 range 现装，版本漂移是隐患）。
function normalizeVer(raw) {
  if (typeof raw !== 'string') return null
  // 去掉 ~ ^ = > = 前缀与尾部杂项，取主版本号段
  const m = raw.replace(/[~^=<>]+/g, ' ').trim().split(/\s+/)[0]
  return m || null
}

function checkWxSdkBaseline() {
  const lockPath = path.join(ROOT, 'cloudfunctions', 'common', 'package-lock.json')
  if (!fs.existsSync(lockPath)) {
    warn('cloudfunctions/common/package-lock.json 缺失：依赖版本基线未建立，无法校验 wx-server-sdk 一致性')
    return
  }
  let locked = null
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    const nodeEntry = lock.packages && lock.packages['node_modules/wx-server-sdk']
    locked = nodeEntry && nodeEntry.version
  } catch (e) {
    warn(`common/package-lock.json 解析失败，跳过 wx-server-sdk 基线检查：${e.message}`)
    return
  }
  if (!locked) {
    warn('common/package-lock.json 未锁定 wx-server-sdk（缺 node_modules/wx-server-sdk 条目），无法做版本基线')
    return
  }

  const cfDir = path.join(ROOT, 'cloudfunctions')
  const dirs = fs.readdirSync(cfDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'common')
    .map(d => d.name)
    .sort()

  const drifted = []
  let checked = 0
  let tildeCount = 0
  for (const name of dirs) {
    const pkgPath = path.join(cfDir, name, 'package.json')
    if (!fs.existsSync(pkgPath)) continue
    let pkg = null
    try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) } catch (e) { continue }
    const raw = pkg.dependencies && pkg.dependencies['wx-server-sdk']
    if (!raw) continue // 不依赖 wx-server-sdk 的函数不在此列
    checked++
    if (/^[~^]/.test(raw)) tildeCount++ // 仍用范围符 → 允许 patch/minor 漂移
    const declared = normalizeVer(raw)
    if (declared !== locked) {
      drifted.push(`${name}(${raw})`)
    }
  }

  if (checked === 0) {
    warn('未发现任何声明 wx-server-sdk 的云函数，基线检查无对象')
    return
  }
  if (drifted.length) {
    warn(`wx-server-sdk 与基线 ${locked} 不一致的函数（${drifted.length} 个）：${drifted.join(', ')} → 统一改回基线版本（见 docs/OPERATIONS.md「依赖版本基线」）`)
  } else {
    ok(`全部 ${checked} 个函数的 wx-server-sdk 声明与基线 ${locked} 一致`)
  }
  if (tildeCount > 0) {
    console.log(`ℹ 有 ${tildeCount} 个函数仍用范围符（~/^）声明 wx-server-sdk：基线已锁定，升级时只改 cloudfunctions/common 一处；各函数保持 ~ 会在云端现装时放行 patch/minor 漂移，如需强一致可把各函数改为与基线相同的精确版本`)
  }
}

console.log('CampusHub doctor 自检\n=====================')
checkAppid()
checkEnvId()
checkFunctions()
checkNewFns()
checkSchoolConfig()
checkDeps()
checkWxSdkBaseline()
checkDeployConfig()

console.log(`\n结果：${errors} 个错误，${warns} 个警告`)
if (errors > 0 || (strict && warns > 0)) {
  process.exit(1)
}
console.log('通过 ✓')
