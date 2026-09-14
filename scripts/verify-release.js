#!/usr/bin/env node
/**
 * CampusHub 发布级静态校验（verify-release）
 *
 * 在无微信开发者工具的环境（CI / 沙箱）里做上线前最后一道静态网：
 *   1. app.json 可解析、sitemap 存在
 *   2. 每个注册页面的 js/json/wxml/wxss 四件套齐全
 *   3. tabBar 图标文件存在
 *   4. 全部自有 JS 通过 node --check 语法校验
 *   5. require() 相对路径可解析（页面 / 组件 / 云函数 / common）
 *   6. WXML 标签平衡、自定义组件已注册、组件四件套存在
 *   7. WXSS 引用的 CSS 变量均有定义
 *   8. WXML/WXSS/JS 引用的 /assets 图片文件存在
 *   9. 云函数依赖已声明（package.json vs require）
 *  10. miniprogram_npm 构建产物与 usingComponents 引用一致
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
const MP = path.join(ROOT, 'miniprogram')
const CF = path.join(ROOT, 'cloudfunctions')

const jsonOut = (() => {
  const i = process.argv.indexOf('--json')
  return i > -1 ? process.argv[i + 1] : null
})()

/** @type {{level:'error'|'warn'|'ok', group:string, msg:string}[]} */
const results = []
const report = (level, group, msg) => results.push({ level, group, msg })

const walk = (dir, exts, acc = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'miniprogram_npm') continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, exts, acc)
    else if (exts.includes(path.extname(name))) acc.push(p)
  }
  return acc
}
const rel = (p) => path.relative(ROOT, p)
const exists = (p) => fs.existsSync(p)

// ============ 1. app.json ============
const appJsonPath = path.join(MP, 'app.json')
let appJson = null
try {
  appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
  report('ok', 'app.json', 'app.json 解析成功')
} catch (e) {
  report('error', 'app.json', 'app.json 解析失败：' + e.message)
}

// ============ 2. 页面四件套 ============
const pageDirs = new Set()
if (appJson) {
  const pages = appJson.pages || []
  if (pages.length === 0) report('error', 'pages', 'app.json 未注册任何页面')
  for (const p of pages) {
    pageDirs.add(p)
    const missing = ['js', 'json', 'wxml', 'wxss'].filter((e) => !exists(path.join(MP, `${p}.${e}`)))
    if (missing.length) report('error', 'pages', `页面 ${p} 缺少: ${missing.join(', ')}`)
  }
  if (!results.some((r) => r.group === 'pages' && r.level === 'error'))
    report('ok', 'pages', `${pages.length} 个注册页面四件套齐全`)
  const dupes = pages.filter((p, i) => pages.indexOf(p) !== i)
  if (dupes.length) report('error', 'pages', `重复注册页面: ${[...new Set(dupes)].join(', ')}`)
  // 子包
  for (const sp of appJson.subPackages || appJson.subpackages || []) {
    for (const p of sp.pages || []) {
      const full = path.join(sp.root, p)
      const missing = ['js', 'json', 'wxml', 'wxss'].filter((e) => !exists(path.join(MP, `${full}.${e}`)))
      if (missing.length) report('error', 'pages', `分包页面 ${full} 缺少: ${missing.join(', ')}`)
    }
  }
  if (!appJson.sitemapLocation || !exists(path.join(MP, appJson.sitemapLocation)))
    report('warn', 'app.json', 'sitemapLocation 缺失或文件不存在（不影响运行，影响索引配置）')
}

// ============ 3. tabBar 图标 ============
if (appJson && appJson.tabBar && Array.isArray(appJson.tabBar.list)) {
  let bad = 0
  for (const item of appJson.tabBar.list) {
    for (const key of ['iconPath', 'selectedIconPath']) {
      if (item[key] && !exists(path.join(MP, item[key]))) {
        report('error', 'tabBar', `tab「${item.text}」图标不存在: ${item[key]}`)
        bad++
      }
    }
  }
  if (!bad) report('ok', 'tabBar', `${appJson.tabBar.list.length} 个 tab 图标路径全部有效`)
}

// ============ 4. JS 语法 + 5. require 解析 ============
const jsFiles = [...walk(MP, ['.js']), ...walk(CF, ['.js'])]
const usingComponentsGlobal = (appJson && appJson.usingComponents) || {}
const BUILTIN_WXML_TAGS = new Set(('view,text,image,button,block,scroll-view,swiper,swiper-item,input,textarea,form,' +
  'picker,picker-view,picker-view-column,checkbox,checkbox-group,radio,radio-group,slider,switch,label,navigator,' +
  'video,camera,live-player,live-pusher,map,canvas,web-view,progress,rich-text,icon,audio,ad,official-account,' +
  'open-data,editor,movable-area,movable-view,cover-view,cover-image,page-meta,navigation-bar,match-media,' +
  'functional-page-navigator,snapshot,root-portal,grid-view,list-view,sticky-section,sticky-header,custom-wrapper,' +
  'wxs,import-wxs').split(','))

const WXML_VOID = new Set(['input', 'import', 'include', 'wxs'])

/** WXML 解析：返回 { tags:[{name,type:'open'|'close'|'self'}], errors[] } */
function parseWxml(src) {
  const errors = []
  const tags = []
  let i = 0
  while (i < src.length) {
    if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i); i = e === -1 ? src.length : e + 3; continue }
    if (src[i] !== '<') { i++; continue }
    // 闭标签
    if (src.startsWith('</', i)) {
      let j = i + 2, name = ''
      while (j < src.length && /[\w-]/.test(src[j])) name += src[j++]
      while (j < src.length && src[j] !== '>') j++
      if (name) tags.push({ name, type: 'close', pos: i })
      i = j + 1
      continue
    }
    // 开标签 / 自闭合
    let j = i + 1, name = ''
    while (j < src.length && /[\w-]/.test(src[j])) name += src[j++]
    if (!name) { i++; continue } // '<' 或表达式比较符
    let selfClose = false, closed = false
    while (j < src.length) {
      const c = src[j]
      if (c === '"' || c === "'") { const q = c; j++; while (j < src.length && src[j] !== q) j++; j++ }
      else if (c === '/' && src[j + 1] === '>') { selfClose = true; closed = true; j += 2; break }
      else if (c === '>') { closed = true; j++; break }
      else j++
    }
    if (!closed) { errors.push(`标签 <${name}> 未闭合（偏移 ${i} 处截断）`); break }
    tags.push({ name, type: selfClose ? 'self' : 'open', pos: i })
    i = j
  }
  // 配对校验
  const stack = []
  for (const t of tags) {
    if (t.type === 'self' || WXML_VOID.has(t.name)) continue
    if (t.type === 'open') stack.push(t)
    else {
      const top = stack.pop()
      if (!top) errors.push(`多余的闭标签 </${t.name}>（偏移 ${t.pos}）`)
      else if (top.name !== t.name) errors.push(`标签错配：<${top.name}>（偏移 ${top.pos}）被 </${t.name}> 闭合`)
    }
  }
  for (const t of stack) errors.push(`标签 <${t.name}>（偏移 ${t.pos}）未闭合`)
  return { tags, errors }
}

// 逐个 JS 文件检查
let syntaxBad = 0, requireBad = 0
for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8')
  try { execSync(`node --check ${JSON.stringify(file)}`, { stdio: 'pipe' }) }
  catch (e) { report('error', 'js-syntax', `${rel(file)}: ${e.stderr.toString().split('\n')[0]}`); syntaxBad++ }

  const isCF = file.startsWith(CF)
  // common 是共享内核（随各云函数一起部署），不独立检查依赖声明
  const isCommonKernel = isCF && path.relative(CF, file).split(path.sep)[0] === 'common'
  const baseDir = path.dirname(file)
  for (const m of code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1]
    if (!spec.startsWith('.')) {
      // 云函数外部依赖必须声明在 package.json
      if (isCF && !isCommonKernel) {
        const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
        const pkgPath = path.join(baseDir, 'package.json')
        let deps = {}
        try { deps = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).dependencies || {} } catch (_) { /* 下方统一报 */ }
        if (!deps[pkgName]) {
          report('error', 'cf-deps', `${rel(file)}: require('${spec}') 未在 ${rel(pkgPath)} dependencies 声明`)
          requireBad++
        }
      }
      continue
    }
    const resolved = path.resolve(baseDir, spec)
    const candidates = [resolved, resolved + '.js', path.join(resolved, 'index.js')]
    if (!candidates.some(exists)) {
      report('error', 'require', `${rel(file)}: require('${spec}') 无法解析`)
      requireBad++
    }
  }
}
if (!syntaxBad) report('ok', 'js-syntax', `${jsFiles.length} 个 JS 文件语法校验通过`)
if (!requireBad) report('ok', 'require', '全部 require() 相对路径可解析；云函数依赖声明完整')

// ============ 6. WXML 检查 ============
const wxmlFiles = [...walk(MP, ['.wxml'])]
let wxmlBad = 0, compBad = 0, imgBad = 0
const definedVars = new Set()
// 7. CSS 变量定义先收集（所有 wxss）
const wxssFiles = walk(MP, ['.wxss'])
for (const f of wxssFiles) {
  const css = fs.readFileSync(f, 'utf8')
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) definedVars.add(m[1])
}
for (const f of wxmlFiles) {
  const src = fs.readFileSync(f, 'utf8')
  const parsed = parseWxml(src)
  for (const e of parsed.errors) { report('error', 'wxml', `${rel(f)}: ${e}`); wxmlBad++ }
  // 自定义组件注册检查
  const pageDir = path.dirname(f)
  const jsonPath = f.replace(/\.wxml$/, '.json')
  let comps = { ...usingComponentsGlobal }
  try { comps = { ...comps, ...(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).usingComponents || {}) } } catch (_) {}
  for (const t of parsed.tags) {
    if (!t.name.includes('-') || BUILTIN_WXML_TAGS.has(t.name)) continue
    if (!comps[t.name]) {
      report('error', 'wxml', `${rel(f)}: 组件 <${t.name}> 未在 usingComponents 注册`)
      compBad++
      continue
    }
    const ref = comps[t.name]
    let base = null
    if (ref.startsWith('/')) base = path.join(MP, ref) // 小程序根绝对路径
    else if (ref.startsWith('.')) base = path.resolve(pageDir, ref) // 相对路径
    else if (ref.includes('/')) base = path.join(MP, 'miniprogram_npm', ref) // npm 包引用
    if (base) {
      const missing = ['js', 'json', 'wxml'].filter((e) => !exists(`${base}.${e}`))
      if (missing.length) {
        report('error', 'wxml', `${rel(f)}: 组件 <${t.name}> → ${ref} 缺少文件: ${missing.join(', ')}`)
        compBad++
      }
    }
  }
  // 图片引用
  for (const m of src.matchAll(/['"]((?:\/|\.\.\/)+assets\/[\w\-./]+\.(?:png|jpe?g|gif|svg|webp))['"]/g)) {
    const p = m[1].replace(/^\/+/, '').replace(/^(\.\.\/)+/, '')
    if (!exists(path.join(MP, p))) { report('error', 'assets', `${rel(f)}: 图片不存在 ${m[1]}`); imgBad++ }
  }
}
if (!wxmlBad && !compBad) report('ok', 'wxml', `${wxmlFiles.length} 个 WXML 标签平衡、组件注册与文件完整`)
if (!imgBad) report('ok', 'assets', 'WXML 引用的 assets 图片全部存在')

// ============ 7. WXSS 变量 + 图片 ============
let varBad = 0, cssImgBad = 0
for (const f of wxssFiles) {
  const css = fs.readFileSync(f, 'utf8')
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!definedVars.has(m[1])) { report('error', 'wxss', `${rel(f)}: 使用未定义变量 ${m[1]}`); varBad++ }
  }
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    let u = m[1].trim()
    if (/^(https?:|data:)/.test(u)) continue
    const abs = u.startsWith('/') ? path.join(MP, u) : path.resolve(path.dirname(f), u)
    if (!exists(abs)) { report('error', 'assets', `${rel(f)}: 样式图片不存在 ${u}`); cssImgBad++ }
  }
}
if (!varBad) report('ok', 'wxss', `${wxssFiles.length} 个 WXSS 的 CSS 变量引用全部有定义`)

// JS 中引用的 /assets 图片
for (const f of walk(MP, ['.js'])) {
  const code = fs.readFileSync(f, 'utf8')
  for (const m of code.matchAll(/['"](\/assets\/[\w\-./]+\.(?:png|jpe?g|gif|svg|webp))['"]/g)) {
    if (!exists(path.join(MP, m[1]))) { report('error', 'assets', `${rel(f)}: 图片不存在 ${m[1]}`); imgBad++ }
  }
}

// ============ 9. 云函数配置 ============
if (exists(CF)) {
  let cfBad = 0
  for (const name of fs.readdirSync(CF)) {
    if (name === 'common') continue // 共享内核，不是独立云函数
    const dir = path.join(CF, name)
    if (!fs.statSync(dir).isDirectory()) continue
    const pkg = path.join(dir, 'package.json')
    if (!exists(pkg)) { report('error', 'cloudfunctions', `云函数 ${name} 缺少 package.json`); cfBad++; continue }
    try {
      const p = JSON.parse(fs.readFileSync(pkg, 'utf8'))
      if (!p.dependencies || !p.dependencies['wx-server-sdk']) {
        report('warn', 'cloudfunctions', `云函数 ${name} 未声明 wx-server-sdk 依赖`)
      }
      if (!p.main) { report('warn', 'cloudfunctions', `云函数 ${name} package.json 缺少 main 字段`); }
      if (!exists(path.join(dir, p.main || 'index.js'))) {
        report('error', 'cloudfunctions', `云函数 ${name} 入口文件 ${p.main || 'index.js'} 不存在`); cfBad++
      }
    } catch (e) { report('error', 'cloudfunctions', `云函数 ${name} package.json 解析失败: ${e.message}`); cfBad++ }
  }
  if (!cfBad) report('ok', 'cloudfunctions', '全部云函数 package.json 与入口文件完整')
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
  const oks = results.filter((x) => x.group === g && x.level === 'ok')
  for (const r of oks) console.log(`✓ [${g}] ${r.msg}`)
}
console.log(`\n结果：${counts.error} 个错误，${counts.warn} 个警告，${counts.ok} 项通过`)

if (jsonOut) {
  fs.writeFileSync(jsonOut, JSON.stringify({ counts, results }, null, 2))
  console.log(`JSON 报告已写入 ${jsonOut}`)
}
process.exit(counts.error > 0 ? 1 : 0)
