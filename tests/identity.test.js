// identity.test.js — 跨端身份解析（HMAC 设备令牌）
//
// 这组测试守的是「H5/App 能不能登录」这条上线阻塞项：
//   - 令牌必须能正确还原身份；
//   - 伪造/篡改的令牌必须被拒绝（否则任何人可冒充他人）；
//   - 没令牌时写接口必须 fail-closed。
const { test, before, after } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const mem = require('./lib/memory-db')

const COMMON = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
let identity

before(() => {
  process.env.IDENTITY_SECRET = 'test-secret-at-least-16-chars-long'
  mem.reset()
  // 必须先装 wx-server-sdk 桩：common-identity → common-db → wx-server-sdk，
  // 未装桩时 require 会直接失败（Cannot find module 'wx-server-sdk'）。
  mem.install({ wxContext: {} })
  mem.purge('cloudfunctions')
  identity = require(path.join(COMMON, 'common-identity.js'))
})

after(() => {
  delete process.env.IDENTITY_SECRET
})

test('令牌往返：签发后能还原同一 uid', () => {
  const token = identity.issueToken('abc123')
  const payload = identity.verifyToken(token)
  assert.ok(payload, '有效令牌应通过校验')
  assert.equal(payload.uid, 'abc123')
})

test('篡改 payload 后签名失效', () => {
  const token = identity.issueToken('abc123')
  const sig = token.split('.')[1]
  // 换掉 payload（模拟把 uid 改成别人），签名仍是旧的
  const forged = Buffer.from(
    JSON.stringify({ uid: 'victim', iat: Date.now(), exp: Date.now() + 1e9 })
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  assert.equal(identity.verifyToken(`${forged}.${sig}`), null, '改 uid 必须被拒绝')
})

test('篡改签名后校验失败', () => {
  const token = identity.issueToken('abc123')
  const [p] = token.split('.')
  assert.equal(identity.verifyToken(`${p}.deadbeef`), null)
})

test('过期令牌被拒绝', () => {
  const past = Date.now() - identity.TOKEN_TTL_MS - 1000
  const token = identity.issueToken('abc123', past)
  assert.equal(identity.verifyToken(token), null, '过期令牌必须拒绝')
})

test('空/畸形令牌返回 null 而不是抛错', () => {
  for (const bad of ['', null, undefined, 'abc', '.', 'a.b.c', 123]) {
    assert.equal(identity.verifyToken(bad), null)
  }
})

test('resolveIdentity：无 OPENID 且无令牌时为 anon', () => {
  mem.install({ wxContext: {} })
  const r = identity.resolveIdentity({})
  assert.equal(r.kind, 'anon')
  assert.equal(r.openid, '')
})

test('resolveIdentity：有效令牌还原为 dev_ 前缀的 openid', () => {
  mem.install({ wxContext: {} })
  const token = identity.issueToken('uid-xyz')
  const r = identity.resolveIdentity({ __identity: token })
  assert.equal(r.kind, 'device')
  assert.equal(r.openid, 'dev_uid-xyz')
})

test('resolveIdentity：小程序 OPENID 优先于设备令牌', () => {
  // 换桩后必须重载 common-db，否则 getWXContext 仍绑定上一份桩的闭包
  mem.install({ wxContext: { OPENID: 'wx-openid-real' } })
  mem.purge('cloudfunctions')
  identity = require(path.join(COMMON, 'common-identity.js'))
  const token = identity.issueToken('uid-xyz')
  const r = identity.resolveIdentity({ __identity: token })
  assert.equal(r.kind, 'wx')
  assert.equal(r.openid, 'wx-openid-real', '有平台身份时不能被设备令牌覆盖')
})

test('requireOpenid：匿名调用抛 AUTH_REQUIRED（fail-closed）', () => {
  // 每个用例自己装桩并重载模块：测试文件内共享模块缓存，不重载会沿用上个用例的 wxContext
  mem.install({ wxContext: {} })
  mem.purge('cloudfunctions')
  identity = require(path.join(COMMON, 'common-identity.js'))
  assert.throws(
    () => identity.requireOpenid({}),
    (e) => e.code === 'AUTH_REQUIRED',
    '没有身份必须拒绝，不能放行'
  )
})

test('不同密钥签发的令牌互不通用', () => {
  const token = identity.issueToken('abc123')
  process.env.IDENTITY_SECRET = 'another-secret-different-value'
  mem.install({ wxContext: {} })
  mem.purge('cloudfunctions')
  const other = require(path.join(COMMON, 'common-identity.js'))
  assert.equal(other.verifyToken(token), null, '换密钥后旧令牌必须失效')
  process.env.IDENTITY_SECRET = 'test-secret-at-least-16-chars-long'
  mem.install({ wxContext: {} })
  mem.purge('cloudfunctions')
  identity = require(path.join(COMMON, 'common-identity.js'))
})

// ── 并发隔离：两个不同身份的请求交错执行，不得串号 ──
test('并发请求的身份上下文互相隔离（AsyncLocalStorage）', async () => {
  const { runWithEvent, getOpenid } = require(path.join(COMMON, 'common-context.js'))

  const a = runWithEvent({ __identity: identity.issueToken('user-a') }, async () => {
    const first = await getOpenid()
    await new Promise((r) => setTimeout(r, 30))
    const second = await getOpenid()
    return [first, second]
  })

  const b = runWithEvent({ __identity: identity.issueToken('user-b') }, async () => {
    await new Promise((r) => setTimeout(r, 10))
    const seen = await getOpenid()
    await new Promise((r) => setTimeout(r, 30))
    return [seen, await getOpenid()]
  })

  const [ra, rb] = await Promise.all([a, b])
  assert.deepEqual(ra, ['dev_user-a', 'dev_user-a'])
  assert.deepEqual(rb, ['dev_user-b', 'dev_user-b'])
})
