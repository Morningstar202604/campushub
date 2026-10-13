// openapi-permissions.test.js — 云调用必须在 config.json 里声明权限（部署阻断防护）
// 微信云开发要求：云函数调用 openapi 必须在同目录 config.json 的
// permissions.openapi 中声明，否则返回「api unauthorized」。
// 本项目的审核是 fail-closed 的：msgSecCheck/imgSecCheck 一旦因未声明权限而失败，
// 表现不是"跳过审核"，而是**所有人的发布全部被拒** —— 首次部署即全站不可用。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', 'cloudfunctions')

const funcs = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'common' && d.name !== 'node_modules')
  .map((d) => d.name)

// 静态推导：该函数运行时可能调用哪些 openapi
function neededApis(fn) {
  const idx = path.join(ROOT, fn, 'index.js')
  if (!fs.existsSync(idx)) return []
  const code = fs.readFileSync(idx, 'utf8')
  const set = new Set()
  for (const m of code.matchAll(/cloud\.openapi\.([a-zA-Z]+\.[a-zA-Z]+)/g)) set.add(m[1])
  if (/await\s+checkContents?\(|checkContents?\(\{/.test(code)) set.add('security.msgSecCheck')
  if (/await\s+checkImages?\(|checkImages?\(\{/.test(code)) set.add('security.imgSecCheck')
  if (/sendSubscribe\(/.test(code)) set.add('subscribeMessage.send')
  return [...set].sort()
}

function declaredApis(fn) {
  const p = path.join(ROOT, fn, 'config.json')
  if (!fs.existsSync(p)) return null
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8')) // 非法 JSON 直接让测试失败
  const list = cfg.permissions && cfg.permissions.openapi
  return Array.isArray(list) ? list.sort() : []
}

test('凡是运行时会调 openapi 的函数，都必须在 config.json 声明权限', () => {
  const missing = []
  for (const fn of funcs) {
    const need = neededApis(fn)
    if (!need.length) continue
    const declared = declaredApis(fn)
    if (declared === null) {
      missing.push(`${fn}(无 config.json，需要 ${need.join('/')})`)
      continue
    }
    const gap = need.filter((a) => !declared.includes(a))
    if (gap.length) missing.push(`${fn}(未声明 ${gap.join('/')})`)
  }
  assert.deepEqual(missing, [], `云调用权限缺失会导致发布全被拒：${missing.join('; ')}`)
})

test('权限声明不得过度授予（最小权限）', () => {
  const over = []
  for (const fn of funcs) {
    const declared = declaredApis(fn)
    if (!declared || !declared.length) continue
    const need = neededApis(fn)
    const extra = declared.filter((a) => !need.includes(a))
    if (extra.length) over.push(`${fn}(多声明 ${extra.join('/')})`)
  }
  assert.deepEqual(over, [], `无谓的权限授予扩大了被滥用面：${over.join('; ')}`)
})

test('定时触发器必须留在 config.json 里（权限声明不能覆盖掉它）', () => {
  const timers = { 'task-expire': 'expireTasks', 'backup-db': 'dailyBackup' }
  for (const [fn, name] of Object.entries(timers)) {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, fn, 'config.json'), 'utf8'))
    const t = (cfg.triggers || []).find((x) => x.name === name)
    assert.ok(t, `${fn} 缺少触发器 ${name}`)
    assert.equal(t.type, 'timer')
    assert.match(t.config, /^\d+\s+\S+\s+\S+\s+\S+\s+\S+/)
  }
})
