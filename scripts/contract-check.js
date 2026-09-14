#!/usr/bin/env node
/**
 * CampusHub 跨端契约校验（contract-check）
 *
 * 静态比对「前端调用」与「云函数实现」，抓只有真机运行才会暴露的对接 bug：
 *   1. 前端 callFunction(...) / wx.cloud.callFunction({name}) 调用的函数必须存在于 cloudfunctions/
 *   2. 前端传的 action 必须被云函数的分发逻辑支持（action === 'x' / case 'x' / 默认值）
 *   3. 云函数存在 action 但前端从未调用 → 仅提示（可能由触发器/控制台调用）
 *
 * 用法：node scripts/contract-check.js [--json out]
 * 退出码：存在 error 时为 1。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const MP = path.join(ROOT, 'miniprogram')
const CF = path.join(ROOT, 'cloudfunctions')

const jsonOut = (() => { const i = process.argv.indexOf('--json'); return i > -1 ? process.argv[i + 1] : null })()
/** @type {{level:'error'|'warn'|'info'|'ok', msg:string}[]} */
const results = []
const report = (level, msg) => results.push({ level, msg })

const walk = (dir, acc = []) => {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'miniprogram_npm') continue
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else if (name.endsWith('.js')) acc.push(p)
  }
  return acc
}
const rel = (p) => path.relative(ROOT, p)

// ---------- 1. 前端调用清单 ----------
const mpFiles = walk(MP)
/** @type {Map<string, {actions:Set<string>, dynamic:Set<string>, where:Set<string>}>} */
const called = new Map()
const add = (fn, action, where) => {
  if (!called.has(fn)) called.set(fn, { actions: new Set(), dynamic: new Set(), where: new Set() })
  const e = called.get(fn)
  e.where.add(rel(where))
  if (action === null || action === 'dynamic') e.dynamic.add(action || '')
  else e.actions.add(action)
}
for (const f of mpFiles) {
  const content = fs.readFileSync(f, 'utf8')
  // 全文窗口法：兼容跨行调用（调用点起，到下一个 callFunction 或 400 字符为窗口）
  for (const m of content.matchAll(/(?<![\w.])callFunction\(\s*['"]([\w-]+)['"]/g)) {
    const fn = m[1]
    const line = content.slice(0, m.index).split('\n').length
    let win = content.slice(m.index, m.index + 400)
    const next = win.slice(10).search(/(?<![\w.])callFunction\(/)
    if (next > -1) win = win.slice(0, next + 10)
    const am = win.match(/action:\s*['"]([\w-]+)['"]/)
    const dyn = !am && /action:/.test(win)
    add(fn, am ? am[1] : (dyn ? 'dynamic' : null), `${rel(f)}:${line}`)
  }
}

// ---------- 2. 云函数 action 支持清单 ----------
const cfNames = fs.readdirSync(CF).filter((n) => fs.statSync(path.join(CF, n)).isDirectory() && n !== 'common')
/** @type {Map<string, {actions:Set<string>, distributed:boolean}>} */
const provided = new Map()
for (const n of cfNames) {
  const code = fs.readFileSync(path.join(CF, n, 'index.js'), 'utf8')
  const actions = new Set()
  for (const m of code.matchAll(/action\s*={1,3}\s*['"]([\w-]+)['"]/g)) actions.add(m[1])
  for (const m of code.matchAll(/case\s*['"]([\w-]+)['"]/g)) actions.add(m[1])
  provided.set(n, { actions, distributed: actions.size > 0, hasElse: /\}\s*else\s*\{/.test(code) })
}

// ---------- 3. 交叉比对 ----------
let errors = 0
for (const [fn, info] of called) {
  if (!provided.has(fn)) {
    report('error', `前端调用不存在的云函数「${fn}」← ${[...info.where].join(', ')}`); errors++; continue
  }
  const p = provided.get(fn)
  for (const a of info.actions) {
    if (p.distributed && !p.actions.has(a)) {
      // 云函数存在 else 兜底分支时，未知 action 会落入 else（如 collect 的 uncollect），降级为提示
      if (p.hasElse) report('info', `云函数「${fn}」无显式 action '${a}'，走 else 兜底分支 ← ${[...info.where].join(', ')}`)
      else {
        report('error', `云函数「${fn}」不支持 action '${a}'（支持: ${[...p.actions].join(', ') || '无'}）← ${[...info.where].join(', ')}`)
        errors++
      }
    }
  }
  // 敏感函数不应被前端直接调用
  if (fn === 'init-db') report('warn', `前端调用 init-db（含 INIT_SECRET 校验的初始化函数）应仅限控制台手动触发 ← ${[...info.where].join(', ')}`)
}
for (const [fn, p] of provided) {
  if (!called.has(fn)) {
    const trigger = ['task-expire', 'backup-db'].includes(fn)
    report('info', `云函数「${fn}」前端无调用${trigger ? '（定时触发器，正常）' : '（确认是否仅控制台/管理端使用）'}`)
  } else {
    const unused = [...p.actions].filter((a) => !called.get(fn).actions.has(a))
    for (const a of unused) report('info', `云函数「${fn}」的 action '${a}' 前端未见调用（可能由触发器/控制台/动态调用使用）`)
  }
}
const dynList = [...called.entries()].filter(([, i]) => i.dynamic.has('dynamic'))
if (dynList.length) report('info', `${dynList.length} 处 action 为动态变量，静态无法比对（人工确认）`)

report('ok', `前端调用 ${called.size} 个云函数 / 云端提供 ${cfNames.length} 个`)

// ---------- 输出 ----------
const counts = { error: 0, warn: 0, info: 0, ok: 0 }
for (const r of results) counts[r.level]++
console.log('CampusHub 跨端契约校验')
console.log('======================')
for (const r of results) {
  const tag = { error: '✗', warn: '⚠', info: 'ℹ', ok: '✓' }[r.level]
  console.log(`${tag} ${r.msg}`)
}
console.log(`\n结果：${counts.error} 个错误，${counts.warn} 个警告，${counts.info} 项提示`)
if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify({ counts, results }, null, 2)); console.log(`JSON 报告已写入 ${jsonOut}`) }
process.exit(counts.error > 0 ? 1 : 0)
