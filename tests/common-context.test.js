// common-context.test.js — 用户上下文与鉴权
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const path = require('path')

const COMMON_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
const originalLoad = Module._load

function makeUserDb(userDoc) {
  const db = {
    collection(name) {
      if (name !== 'users') throw new Error(`unexpected: ${name}`)
      return {
        where: () => ({
          field: () => ({
            get: async () => ({ data: userDoc ? [userDoc] : [] })
          })
        })
      }
    }
  }
  return db
}

function loadContext(wxContext, userDoc) {
  const db = makeUserDb(userDoc)
  const fakeSdk = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database() {
      return db
    },
    getWXContext: () => wxContext
  }
  Module._load = function (request, _parent, _isMain) {
    if (request === 'wx-server-sdk') return fakeSdk
    return originalLoad.apply(this, arguments)
  }
  // 必须连 common-identity 一起清：它在模块加载时就把 cloud 捕获下来了，
  // 少清一个会让下一个用例继续用上一个用例的 wxContext（该拒的没拒）。
  for (const f of [
    'common-db.js',
    'common-context.js',
    'common-error.js',
    'common-identity.js',
    'common-scope.js'
  ]) {
    delete require.cache[path.join(COMMON_DIR, f)]
  }
  const ctx = require(path.join(COMMON_DIR, 'common-context.js'))
  Module._load = originalLoad
  return ctx
}

afterEach(() => {
  Module._load = originalLoad
})

test('getOpenid：有 WXContext 时返回 OPENID', async () => {
  const { getOpenid } = loadContext({ OPENID: 'openid_abc' })
  assert.equal(await getOpenid(), 'openid_abc')
})

test('getOpenid：无 OPENID 时 throw AUTH_REQUIRED', async () => {
  const { getOpenid } = loadContext({})
  await assert.rejects(getOpenid, (err) => err.code === 'AUTH_REQUIRED')
})

test('getCurrentUser：用户存在时返回文档', async () => {
  const { getCurrentUser } = loadContext({ OPENID: 'o1' }, { _id: 'u1', nickname: 'test' })
  const user = await getCurrentUser()
  assert.equal(user._id, 'u1')
  assert.equal(user.nickname, 'test')
})

test('getCurrentUser：用户不存在时 throw USER_NOT_FOUND', async () => {
  const { getCurrentUser } = loadContext({ OPENID: 'ghost' }, null)
  await assert.rejects(getCurrentUser, (err) => err.code === 'USER_NOT_FOUND')
})

test('requireActive：正常用户放行', () => {
  const { requireActive } = loadContext({})
  const user = { _id: 'u1', verifyStatus: 'verified' }
  assert.equal(requireActive(user), user)
})

test('requireActive：verifyStatus=banned 时 throw USER_BANNED', () => {
  const { requireActive } = loadContext({})
  assert.throws(
    () => requireActive({ _id: 'u1', verifyStatus: 'banned' }),
    (err) => err.code === 'USER_BANNED' && /限制/.test(err.message)
  )
})

test('requireActive：空用户 throw USER_NOT_FOUND', () => {
  const { requireActive } = loadContext({})
  assert.throws(
    () => requireActive(null),
    (err) => err.code === 'USER_NOT_FOUND'
  )
})
