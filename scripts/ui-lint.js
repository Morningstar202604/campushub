#!/usr/bin/env node
/**
 * CampusHub UI 层 lint（ui-lint）
 *
 * 覆盖「跨文件」才能发现的问题（纯单文件语法检查抓不到）：
 *   1. WXML 事件绑定（bindtap / catch:tap / 内联三元 …）的处理器在 JS 中是否存在 → 死按钮
 *   2. wx:for 是否配 wx:key（缺 key 官方告警 + 列表渲染性能差）
 *   3. usingComponents 引用但未在 WXML 中使用（冗余组件，拖累包体积）
 *   4. 隐私接口使用清单（提审需在 mp 后台「隐私保护指引」勾选）
 *
 * 用法：node scripts/ui-lint.js [--json out]
 * 退出码：存在 error 时为 1。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const MP = path.join(ROOT, 'miniprogram')

const jsonOut = (() => { const i = process.argv.indexOf('--json'); return i > -1 ? process.argv[i + 1] : null })()
/** @type {{level:'error'|'warn'|'info'|'ok', group:string, msg:string}[]} */
const results = []
const report = (level, group, msg) => results.push({ level, group, msg })

const walk = (dir, ext, acc = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'miniprogram_npm') continue
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, ext, acc)
    else if (name.endsWith(ext)) acc.push(p)
  }
  return acc
}
const rel = (p) => path.relative(ROOT, p)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 隐私接口（提审需在「隐私保护指引」中勾选）
const PRIVACY_APIS = ['getLocation', 'chooseLocation', 'chooseImage', 'chooseMedia', 'chooseVideo',
  'getUserInfo', 'getUserProfile', 'chooseAddress', 'chooseInvoice', 'choosePoi', 'addPhoneContact',
  'getWeRunData', 'openBluetoothAdapter', 'startRecord', 'chooseWeChatContact', 'authorize']

let deadHandlers = 0, missingKey = 0, unusedComp = 0
const privacyUsed = new Set()

const wxmlFiles = [...walk(MP, '.wxml')]

// ---------- 逐 WXML 检查 ----------
for (const wf of wxmlFiles) {
  const src = fs.readFileSync(wf, 'utf8')
  const jsPath = wf.replace(/\.wxml$/, '.js')
  const jsonPath = wf.replace(/\.wxml$/, '.json')
  const hasJs = fs.existsSync(jsPath)
  const code = hasJs ? fs.readFileSync(jsPath, 'utf8') : ''

  // 1) 事件绑定 → 处理器存在性
  const handlers = new Set()
  for (const m of src.matchAll(/\s(?:capture-)?(?:bind|catch)[:]?[a-zA-Z]+\s*=\s*"([^"]*)"/g)) {
    const raw = m[1].trim()
    if (!raw || raw === '{{}}') continue
    if (raw.includes('.')) continue // wxs 模块方法 {{m.fn}}
    if (raw.startsWith('{{')) {
      for (const q of raw.matchAll(/(['"])([a-zA-Z_$][\w$]*)\1/g)) handlers.add(q[2])
      const bare = raw.match(/^\{\{\s*([a-zA-Z_$][\w$]*)\s*\}\}$/)
      if (bare) handlers.add(bare[1])
    } else {
      handlers.add(raw)
    }
  }
  for (const h of handlers) {
    if (!hasJs) { report('error', 'dead-handler', `${rel(wf)}: 绑定 ${h} 但缺少 ${rel(jsPath)}`); deadHandlers++; continue }
    const defined = new RegExp('(^|[^\\w.$])' + esc(h) + '\\s*[(:]', 'm').test(code)
    if (!defined) { report('error', 'dead-handler', `${rel(wf)}: 绑定了处理器「${h}」但 ${rel(jsPath)} 中未定义（点击无反应）`); deadHandlers++ }
  }

  // 2) wx:for 缺 wx:key
  for (const m of src.matchAll(/<([a-zA-Z][\w-]*)\s+([^>]*?)\/?>/g)) {
    const attrs = m[2]
    if (/\bwx:for\s*=/.test(attrs) && !/\bwx:key\s*=/.test(attrs)) {
      const line = src.slice(0, m.index).split('\n').length
      report('warn', 'wx-key', `${rel(wf)}:${line} <${m[1]}> 有 wx:for 但缺 wx:key（官方告警 + 列表性能差）`)
      missingKey++
    }
  }

  // 3) usingComponents 未使用
  if (fs.existsSync(jsonPath)) {
    try {
      const comps = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).usingComponents || {}
      for (const tag of Object.keys(comps)) {
        if (!new RegExp('<' + esc(tag) + '[\\s/>]').test(src)) {
          report('info', 'unused-component', `${rel(wf)}: 引用组件 <${tag}> 但 WXML 未使用（冗余，可删以减小包体积）`)
          unusedComp++
        }
      }
    } catch (_) { /* json 解析失败由 verify-release 负责 */ }
  }

  // 4) WXML 内联表达式里的隐私接口（如 wx:if 调用）一般不触发，主查 JS
}

// ---------- JS 中的隐私接口使用 ----------
for (const jf of walk(MP, '.js')) {
  const code = fs.readFileSync(jf, 'utf8')
  for (const api of PRIVACY_APIS) {
    if (new RegExp('wx\\.' + api + '\\s*\\(').test(code)) privacyUsed.add(api)
  }
}
if (privacyUsed.size) {
  report('info', 'privacy', `使用的隐私接口：${[...privacyUsed].join(', ')} —— 提审前需在 mp 后台「设置 → 服务内容声明 → 用户隐私保护指引」勾选对应信息类型（详见 docs/COMPLIANCE.md）`)
}

// ---------- 汇总 ----------
if (!deadHandlers) report('ok', 'dead-handler', `${wxmlFiles.length} 个 WXML 的事件绑定全部有对应处理函数`)
if (!missingKey) report('ok', 'wx-key', '全部 wx:for 均配置 wx:key')
if (!unusedComp) report('ok', 'unused-component', '无冗余组件引用')

const counts = { error: 0, warn: 0, info: 0, ok: 0 }
for (const r of results) counts[r.level]++

console.log('CampusHub UI 层 lint')
console.log('====================')
for (const r of results.filter((x) => x.level !== 'ok')) {
  const tag = { error: '✗', warn: '⚠', info: 'ℹ' }[r.level]
  console.log(`${tag} [${r.group}] ${r.msg}`)
}
for (const r of results.filter((x) => x.level === 'ok')) console.log(`✓ [${r.group}] ${r.msg}`)
console.log(`\n结果：${counts.error} 个错误，${counts.warn} 个警告，${counts.info} 项提示`)
if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify({ counts, results }, null, 2)); console.log(`JSON 报告已写入 ${jsonOut}`) }
process.exit(counts.error > 0 ? 1 : 0)
