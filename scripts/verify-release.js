#!/usr/bin/env node
/**
 * CampusHub 发布级静态校验（verify-release）
 *
 * 前端在 v0.9.0 已迁移到 uni-app（Vue 3 SFC）。旧版脚本仍在按原生小程序规则检查
 * `pages/**\/*.wxml` 四件套与 `miniprogram_npm`，在现架构下必然报 72 个假错误 ——
 * 一个永远红的门禁等于没有门禁。本版改为按当前架构校验：
 *
 *   1. pages.json 可解析；每个注册页面对应 `src/<path>.vue` 存在；tabBar 图标存在
 *   2. 全部云函数与 scripts 的 JS 通过 `node --check`
 *   3. require() 相对路径可解析（内核 `./common-*` 由构建期内联，允许不存在）
 *   4. 每个云函数有 package.json / main 入口 / wx-server-sdk 依赖
 *   5. uni-app/src 下不得残留旧架构的 .wxml / .wxss / .json 页面文件
 *   6. 版本号三处一致：package.json / index.html badge / README badge
 *   7. 开源治理文件齐全（LICENSE / SECURITY / CONTRIBUTING / CODE_OF_CONDUCT / NOTICE / CHANGELOG）
 *
 * 用法：
 *   node scripts/verify-release.js            # 人类可读输出
 *   node scripts/verify-release.js --json out # 追加 JSON 报告
 *
 * 退出码：存在 error 时为 1（可直接接入 CI）。
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'uni-app', 'src')
const CF = path.join(ROOT, 'cloudfunctions')

const jsonOut = (() => {
  const i = process.argv.indexOf('--json')
  return i > -1 ? process.argv[i + 1] : null
})()

/** @type {{level:'error'|'warn'|'ok', group:string, msg:string}[]} */
const results = []
const report = (level, group, msg) => results.push({ level, group, msg })
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')
const exists = (p) => fs.existsSync(p)

function walk(dir, exts, acc = []) {
  if (!exists(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, exts, acc)
    else if (exts.includes(path.extname(name))) acc.push(p)
  }
  return acc
}

// ============ 1. pages.json + 页面 SFC + tabBar ============
let pagesJson = null
try {
  pagesJson = JSON.parse(fs.readFileSync(path.join(SRC, 'pages.json'), 'utf8'))
  report('ok', 'pages.json', 'pages.json 解析成功')
} catch (e) {
  report('error', 'pages.json', `pages.json 解析失败：${e.message}`)
}

if (pagesJson) {
  const pages = pagesJson.pages || []
  if (!pages.length) report('error', 'pages', 'pages.json 未注册任何页面')
  let missing = 0
  for (const p of pages) {
    if (!exists(path.join(SRC, `${p.path}.vue`))) {
      report('error', 'pages', `页面 ${p.path} 缺少对应的 .vue 文件`)
      missing++
    }
  }
  if (!missing && pages.length) report('ok', 'pages', `${pages.length} 个注册页面均有 .vue 实现`)

  const dupes = pages.filter((p, i) => pages.findIndex((x) => x.path === p.path) !== i)
  if (dupes.length) report('error', 'pages', `重复注册页面: ${dupes.map((d) => d.path).join(', ')}`)

  const tabs = (pagesJson.tabBar && pagesJson.tabBar.list) || []
  let iconBad = 0
  for (const item of tabs) {
    for (const key of ['iconPath', 'selectedIconPath']) {
      if (item[key] && !exists(path.join(SRC, item[key]))) {
        report('error', 'tabBar', `tab「${item.text}」图标不存在: ${item[key]}`)
        iconBad++
      }
    }
  }
  if (!iconBad && tabs.length) report('ok', 'tabBar', `${tabs.length} 个 tab 图标路径全部有效`)
}

// ============ 2. JS 语法 ============
const jsFiles = [...walk(CF, ['.js']), ...walk(path.join(ROOT, 'scripts'), ['.js'])]
let syntaxBad = 0
for (const file of jsFiles) {
  try {
    execSync(`node --check ${JSON.stringify(file)}`, { stdio: 'pipe' })
  } catch (e) {
    report('error', 'js-syntax', `${rel(file)}: ${String(e.stderr).split('\n')[0]}`)
    syntaxBad++
  }
}
if (!syntaxBad) report('ok', 'js-syntax', `${jsFiles.length} 个 JS 文件语法校验通过`)

// ============ 3. require 相对路径 ============
// 内核（common-*.js）由 scripts/build-functions.js 在构建期内联进 dist/，
// 源码目录里本来就没有这些文件，因此按约定放行。
const KERNEL_RE = /^\.\/common(-[a-z]+)?(\.js)?$/
let requireBad = 0
for (const file of jsFiles) {
  const baseDir = path.dirname(file)
  const code = fs.readFileSync(file, 'utf8')
  for (const m of code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1]
    // 模板插值（require(`./handlers/${n}`)）是动态路径，静态不可判定，跳过
    if (!spec.startsWith('.') || KERNEL_RE.test(spec) || spec.includes('${')) continue
    const resolved = path.resolve(baseDir, spec)
    const candidates = [resolved, `${resolved}.js`, path.join(resolved, 'index.js')]
    if (!candidates.some(exists)) {
      report('error', 'require', `${rel(file)}: require('${spec}') 无法解析`)
      requireBad++
    }
  }
}
if (!requireBad) report('ok', 'require', '全部业务 require() 相对路径可解析（内核由构建期内联）')

// ============ 4. 云函数结构 ============
let cfBad = 0
if (exists(CF)) {
  for (const name of fs.readdirSync(CF)) {
    if (name === 'common') continue
    const dir = path.join(CF, name)
    if (!fs.statSync(dir).isDirectory()) continue
    const pkg = path.join(dir, 'package.json')
    if (!exists(pkg)) {
      report('error', 'cloudfunctions', `云函数 ${name} 缺少 package.json`)
      cfBad++
      continue
    }
    try {
      const p = JSON.parse(fs.readFileSync(pkg, 'utf8'))
      if (!p.dependencies || !p.dependencies['wx-server-sdk'])
        report('warn', 'cloudfunctions', `云函数 ${name} 未声明 wx-server-sdk 依赖`)
      const main = p.main || 'index.js'
      if (!exists(path.join(dir, main))) {
        report('error', 'cloudfunctions', `云函数 ${name} 入口 ${main} 不存在`)
        cfBad++
      }
    } catch (e) {
      report('error', 'cloudfunctions', `云函数 ${name} package.json 解析失败: ${e.message}`)
      cfBad++
    }
  }
  if (!cfBad) report('ok', 'cloudfunctions', '全部云函数 package.json 与入口文件完整')
}

// ============ 5. 旧架构残留 ============
const legacy = [...walk(SRC, ['.wxml', '.wxss'])]
if (legacy.length) {
  report(
    'error',
    'legacy',
    `uni-app/src 残留旧架构文件 ${legacy.length} 个：${legacy.slice(0, 3).map(rel).join(', ')}`
  )
} else {
  report('ok', 'legacy', 'uni-app/src 无旧架构 .wxml/.wxss 残留')
}

// ============ 6. 版本一致性 ============
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const badge = (file, re) => {
    const s = fs.readFileSync(path.join(ROOT, file), 'utf8')
    const m = s.match(re)
    return m ? m[1] : null
  }
  const htmlVer = badge('index.html', /version-([0-9]+\.[0-9]+\.[0-9]+)-green/)
  const readmeVer = badge('README.md', /version-([0-9]+\.[0-9]+\.[0-9]+)-green/)
  const zhVer = badge('docs/README.zh-CN.md', /version-([0-9]+\.[0-9]+\.[0-9]+)-green/)
  const mismatched = [
    ['index.html', htmlVer],
    ['README.md', readmeVer],
    ['docs/README.zh-CN.md', zhVer]
  ].filter(([, v]) => v !== pkg.version)
  if (mismatched.length) {
    report(
      'error',
      'version',
      `版本徽章与 package.json(${pkg.version}) 不一致：${mismatched.map(([f, v]) => `${f}=${v}`).join(' / ')}`
    )
  } else {
    report('ok', 'version', `版本徽章三处一致：v${pkg.version}`)
  }
} catch (e) {
  report('error', 'version', `版本一致性检查失败：${e.message}`)
}

// ============ 7. 开源治理文件 ============
const GOVERNANCE = [
  'LICENSE',
  'NOTICE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
  'README.md',
  'AGENTS.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/workflows/ci.yml'
]
const missingGov = GOVERNANCE.filter((f) => !exists(path.join(ROOT, f)))
if (missingGov.length) {
  report('error', 'governance', `缺少开源治理文件：${missingGov.join(', ')}`)
} else {
  report('ok', 'governance', `${GOVERNANCE.length} 个开源治理文件齐全`)
}

// ============ 汇总 ============
const counts = { error: 0, warn: 0, ok: 0 }
for (const r of results) counts[r.level]++

console.log('CampusHub 发布级静态校验')
console.log('========================')
const groups = [...new Set(results.map((r) => r.group))]
for (const g of groups) {
  for (const r of results.filter((x) => x.group === g && x.level !== 'ok')) {
    console.log(`${r.level === 'error' ? '✗' : '⚠'} [${g}] ${r.msg}`)
  }
  for (const r of results.filter((x) => x.group === g && x.level === 'ok')) {
    console.log(`✓ [${g}] ${r.msg}`)
  }
}
console.log(`\n结果：${counts.error} 个错误，${counts.warn} 个警告，${counts.ok} 项通过`)

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ counts, results }, null, 2))
  console.log(`JSON 报告已写入 ${jsonOut}`)
}
process.exit(counts.error > 0 ? 1 : 0)
