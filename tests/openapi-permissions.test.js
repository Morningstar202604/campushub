// openapi-permissions.test.js — 云调用必须在所属部署函数的 config.json 里声明权限
// 微信云开发要求：云函数调用 openapi 必须在同目录 config.json 的 permissions.openapi 中声明，
// 否则返回 api unauthorized。本项目审核是 fail-closed 的：msgSecCheck/imgSecCheck 一旦因
// 未声明而失败，症状不是"跳过审核"，而是**所有人的发布全部被拒** —— 首次部署即全站不可用。
// 收敛为网关后，权限声明归属"部署函数"，因此必须按 gateway-routes 把单元映射到目标函数再校验。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const U = require('./lib/unit-paths')

function declaredApis(deployName) {
  const cfgPath = require('path').join(U.CF, deployName, 'config.json')
  if (!fs.existsSync(cfgPath)) return null
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) // 非法 JSON 直接让测试失败
  const list = cfg.permissions && cfg.permissions.openapi
  return Array.isArray(list) ? list.sort() : []
}

function neededApis(unit) {
  const code = U.readSource(unit)
  const set = new Set()
  for (const m of code.matchAll(/cloud\.openapi\.([a-zA-Z]+\.[a-zA-Z]+)/g)) set.add(m[1])
  if (/await\s+checkContents?\(/.test(code)) set.add('security.msgSecCheck')
  if (/await\s+checkImages?\(|await\s+checkImage\(/.test(code)) set.add('security.imgSecCheck')
  if (/sendSubscribe\(/.test(code)) set.add('subscribeMessage.send')
  return [...set].sort()
}

test('凡是运行时会调 openapi 的入口，其部署函数都必须声明该权限', () => {
  const required = new Map() // deployName -> Set(api)
  for (const unit of U.unitNames()) {
    const need = neededApis(unit)
    if (!need.length) continue
    const deploy = U.deployOf(unit)
    if (!required.has(deploy)) required.set(deploy, new Set())
    for (const a of need) required.get(deploy).add(a)
  }
  const missing = []
  for (const [deploy, need] of required) {
    const declared = declaredApis(deploy)
    if (declared === null) {
      missing.push(`${deploy}(无 config.json，需要 ${[...need].join('/')})`)
      continue
    }
    const gap = [...need].filter((a) => !declared.includes(a))
    if (gap.length) missing.push(`${deploy}(未声明 ${gap.join('/')})`)
  }
  assert.deepEqual(missing, [], `云调用权限缺失会导致发布全被拒：${missing.join('; ')}`)
})

test('权限声明不得过度授予（最小权限）', () => {
  const over = []
  for (const deploy of U.deployNames()) {
    const declared = declaredApis(deploy)
    if (!declared || !declared.length) continue
    // 该部署函数被允许的 api = 其所有成员的并集
    const allowed = new Set()
    for (const unit of U.unitNames()) {
      if (U.deployOf(unit) !== deploy) continue
      for (const a of neededApis(unit)) allowed.add(a)
    }
    const extra = declared.filter((a) => !allowed.has(a))
    if (extra.length) over.push(`${deploy}(多声明 ${extra.join('/')})`)
  }
  assert.deepEqual(over, [], `无谓的权限授予扩大了被滥用面：${over.join('; ')}`)
})

test('定时触发器必须留在独立函数上（收敛不能吞掉触发器）', () => {
  const path = require('path')
  const timers = { 'task-expire': 'expireTasks', 'backup-db': 'dailyBackup' }
  for (const [fn, name] of Object.entries(timers)) {
    assert.equal(U.deployOf(fn), fn, `${fn} 必须仍是独立部署函数`)
    const cfg = JSON.parse(fs.readFileSync(path.join(U.CF, fn, 'config.json'), 'utf8'))
    const t = (cfg.triggers || []).find((x) => x.name === name)
    assert.ok(t, `${fn} 缺少触发器 ${name}`)
    assert.equal(t.type, 'timer')
    assert.match(t.config, /^\d+\s+\S+\s+\S+\s+\S+\s+\S+/)
  }
})
