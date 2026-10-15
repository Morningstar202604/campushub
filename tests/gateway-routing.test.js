// gateway-routing.test.js — 云函数收敛为资源型网关的结构约束（D6 治理）
// 动机：37 个云函数逼近微信云开发 50 个函数配额，且每个函数都要独立部署、独立声明 openapi 权限、
// 独立冷启动。收敛为「按资源分组的网关 + 独立定时/初始化管理函数」把数量降到 10，
// 同时必须保证：不丢权限、不丢触发器、不丢任何一个调用入口、业务逻辑仍然只有一份源码。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const CF = path.join(ROOT, 'cloudfunctions')
const U = require('./lib/unit-paths')
const ROUTES = JSON.parse(fs.readFileSync(path.join(ROOT, 'gateway-routes.json'), 'utf8'))

function dirs(base) {
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'common' && d.name !== 'node_modules')
    .map((d) => d.name)
}

const fnDirs = dirs(CF)
const gateways = fnDirs.filter((d) => d.startsWith('api-'))
const standalone = fnDirs.filter((d) => !d.startsWith('api-'))

test('路由表必须覆盖全部现存函数，且不留孤儿（双向一致）', () => {
  const routed = Object.keys(ROUTES.routes).sort()
  // 源码里的"可调用单元" = 网关的 handler + 独立函数
  const units = []
  for (const gw of gateways) {
    for (const h of fs.readdirSync(path.join(CF, gw, 'handlers'))) {
      if (h.endsWith('.js')) units.push(h.replace(/\.js$/, ''))
    }
  }
  for (const s of standalone) if (fs.existsSync(path.join(CF, s, 'index.js'))) units.push(s)
  units.sort()

  assert.deepEqual(routed, units, '路由表与源码可调用单元不一致')
  const missing = units.filter((u) => !ROUTES.routes[u])
  assert.deepEqual(missing, [], `有函数未登记进路由表：${missing.join(', ')}`)
})

test('云函数总量必须显著下降（配额是 50 个）', () => {
  assert.ok(gateways.length >= 1, '未发现网关目录')
  assert.ok(fnDirs.length <= 12, `云函数目录 ${fnDirs.length} 个，收敛未生效`)
  // 每个网关都必须在路由表里作为目标出现
  const targets = new Set(Object.values(ROUTES.routes))
  for (const gw of gateways) assert.ok(targets.has(gw), `${gw} 没有任何路由指向它`)
})

test('网关的 openapi 权限必须等于组内成员原权限的并集（合并不得丢权限）', () => {
  const offenders = []
  for (const gw of gateways) {
    const members = Object.keys(ROUTES.routes).filter((k) => ROUTES.routes[k] === gw)
    const cfg = JSON.parse(fs.readFileSync(path.join(CF, gw, 'config.json'), 'utf8'))
    const declared = (cfg.permissions && cfg.permissions.openapi) || []
    // 组内任一成员代码里出现的 cloud.openapi.* 都必须被网关声明
    const need = new Set()
    for (const m of members) {
      const code = fs.readFileSync(path.join(CF, gw, 'handlers', `${m}.js`), 'utf8')
      for (const x of code.matchAll(/cloud\.openapi\.([a-zA-Z]+\.[a-zA-Z]+)/g)) need.add(x[1])
      if (/await\s+checkContents?\(/.test(code)) need.add('security.msgSecCheck')
      if (/await\s+checkImages?\(|await\s+checkImage\(/.test(code)) need.add('security.imgSecCheck')
      if (/sendSubscribe\(/.test(code)) need.add('subscribeMessage.send')
    }
    const gap = [...need].filter((a) => !declared.includes(a))
    if (gap.length) offenders.push(`${gw}(缺 ${gap.join('/')})`)
  }
  assert.deepEqual(
    offenders,
    [],
    `权限并集缺失会让 fail-closed 审核拒掉全部发布：${offenders.join('; ')}`
  )
})

test('定时触发器与管理员守卫函数必须保持独立，不能被网关吞掉', () => {
  for (const fn of ['task-expire', 'backup-db']) {
    assert.ok(standalone.includes(fn), `${fn} 应保持为独立云函数（定时触发器绑定在函数上）`)
    const cfg = JSON.parse(fs.readFileSync(path.join(CF, fn, 'config.json'), 'utf8'))
    assert.ok(
      (cfg.triggers || []).some((t) => t.type === 'timer'),
      `${fn} 缺少 timer 触发器`
    )
  }
  assert.equal(ROUTES.routes['task-expire'], 'task-expire')
  assert.equal(ROUTES.routes['backup-db'], 'backup-db')
})

test('网关入口必须由路由表生成且与之一致（防止手工改出第二套真相）', () => {
  for (const gw of gateways) {
    const code = fs.readFileSync(path.join(CF, gw, 'index.js'), 'utf8')
    const members = Object.keys(ROUTES.routes).filter((k) => ROUTES.routes[k] === gw)
    for (const m of members) {
      // 按 handler 引用路径校验，而不是按引号形式：键名带不带引号是 Prettier 的排版选择
      // （合法标识符会被去引号），锁引号等于把测试绑在格式器上。
      assert.ok(
        code.includes(`'./handlers/${m}'`) || code.includes(`\"./handlers/${m}\"`),
        `${gw}/index.js 未引用 handler：${m}`
      )
    }
    // 不得分发未登记的名称（越权/参数污染）
    assert.match(code, /UNKNOWN_FUNCTION|INVALID_PARAM/, `${gw} 必须拒绝未知 fn`)
  }
})

test('业务逻辑只有一份源码：不得同时存在 legacy 函数目录与其 handler 副本', () => {
  const dup = []
  for (const gw of gateways) {
    for (const h of fs.readdirSync(path.join(CF, gw, 'handlers'))) {
      const name = h.replace(/\.js$/, '')
      if (fs.existsSync(path.join(CF, name, 'index.js'))) dup.push(name)
    }
  }
  assert.deepEqual(dup, [], `业务逻辑出现两份源码：${dup.join(', ')}`)
})

test('前端必须通过路由表寻址，并保留可回退的 legacy 模式', () => {
  const api = fs.readFileSync(path.join(ROOT, 'uni-app', 'src', 'utils', 'api.ts'), 'utf8')
  assert.match(api, /gateway-routes|GATEWAY_ROUTES|gatewayRoutes/, 'api.ts 未接入路由表')
  assert.match(api, /USE_GATEWAY|useGateway|gatewayEnabled/, 'api.ts 缺少灰度/回滚开关')
  assert.match(api, /fn/, '网关模式下必须注入 fn 字段')
})

test('fn 只用于分发，不得污染业务数据（防止落库出现内部路由字段）', () => {
  const offenders = []
  for (const unit of U.unitNames()) {
    const code = U.readSource(unit)
    // ① handler 不得读取 event.fn（那是网关的字段）
    if (/(event|ev)\.fn\b/.test(code)) offenders.push(`${unit}(读取了 event.fn)`)
    // ② 不得把整个 event 扩散进文档 —— 一旦这样，网关注入的 fn 会被写进数据库
    if (/\.\.\.event\b/.test(code)) offenders.push(`${unit}(...event 扩散)`)
  }
  assert.deepEqual(offenders, [], `路由字段可能进入业务数据：${offenders.join(', ')}`)
})
