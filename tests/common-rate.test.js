// common-rate.test.js — 原子限频（v0.9.2 核心安全模块）
const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const path = require('path')

const COMMON_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
const originalLoad = Module._load

// 内存模拟 rate_limits 集合：记录 _id → { count }
function makeRateMock() {
  const records = new Map()
  let _idCounter = 0
  const db = {
    command: { inc: (n) => ({ $inc: n }) },
    collection(name) {
      if (name !== 'rate_limits') throw new Error(`unexpected collection: ${name}`)
      return {
        add: async ({ data }) => {
          if (records.has(data._id)) {
            const e = new Error('duplicate key')
            e.errCode = -502001
            throw e
          }
          records.set(data._id, { ...data })
        },
        doc(_id) {
          return {
            update: async ({ data: { count: _count } }) => {
              const r = records.get(_id)
              if (!r) return { stats: { updated: 0 } }
              r.count = (r.count || 0) + 1
              return { stats: { updated: 1 } }
            },
            get: async () => {
              const r = records.get(_id)
              return { data: r ? { ...r } : null }
            }
          }
        }
      }
    }
  }
  const fakeSdk = {
    DYNAMIC_CURRENT_ENV: 'test', init() {},
    database() { return db },
    getWXContext: () => ({ OPENID: 'test' })
  }
  return { db, records, fakeSdk, nextId: () => `id_${++_idCounter}` }
}

function loadRate(fakeSdk) {
  Module._load = function (request, _parent, _isMain) {
    if (request === 'wx-server-sdk') return fakeSdk
    return originalLoad.apply(this, arguments)
  }
  delete require.cache[path.join(COMMON_DIR, 'common-db.js')]
  delete require.cache[path.join(COMMON_DIR, 'common-rate.js')]
  delete require.cache[path.join(COMMON_DIR, 'common-error.js')]
  const rate = require(path.join(COMMON_DIR, 'common-rate.js'))
  Module._load = originalLoad
  return rate
}

beforeEach(() => { delete process.env.ADMIN_OPENIDS })
afterEach(() => { Module._load = originalLoad })

test('rateLimit：max=1 时窗口内首请求放行，第二次拒绝', async () => {
  const { rateLimit } = loadRate(makeRateMock().fakeSdk)
  // 首请求 → 放行
  await rateLimit({ collection: 'posts', match: { userId: 'u1' }, windowMs: 30000, max: 1, now: 100000 })
  // 第二次 → 限频拒绝
  await assert.rejects(
    rateLimit({ collection: 'posts', match: { userId: 'u1' }, windowMs: 30000, max: 1, now: 100500 }),
    (err) => err.code === 'RATE_LIMITED'
  )
})

test('rateLimit：不同 userId 各自独立限频', async () => {
  const { rateLimit } = loadRate(makeRateMock().fakeSdk)
  await rateLimit({ collection: 'posts', match: { userId: 'u1' }, windowMs: 30000, max: 1, now: 200000 })
  // 不同用户不受影响
  await rateLimit({ collection: 'posts', match: { userId: 'u2' }, windowMs: 30000, max: 1, now: 200000 })
})

test('rateLimit：窗口过期后重新放行（固定窗口边界）', async () => {
  const { rateLimit } = loadRate(makeRateMock().fakeSdk)
  await rateLimit({ collection: 'posts', match: { userId: 'u1' }, windowMs: 10000, max: 1, now: 0 })
  // 同一窗口内被拒
  await assert.rejects(
    rateLimit({ collection: 'posts', match: { userId: 'u1' }, windowMs: 10000, max: 1, now: 5000 }),
    (err) => err.code === 'RATE_LIMITED'
  )
  // 新窗口重新放行
  await rateLimit({ collection: 'posts', match: { userId: 'u1' }, windowMs: 10000, max: 1, now: 10000 })
})

test('rateLimit：max=3 时允许窗口内 3 次，第 4 次拒绝', async () => {
  const { rateLimit } = loadRate(makeRateMock().fakeSdk)
  const opts = { collection: 'comments', match: { userId: 'u1' }, windowMs: 30000, max: 3 }
  await rateLimit({ ...opts, now: 300000 })
  await rateLimit({ ...opts, now: 300100 })
  await rateLimit({ ...opts, now: 300200 })
  // 第 4 次 → 限频
  await assert.rejects(
    rateLimit({ ...opts, now: 300300 }),
    (err) => err.code === 'RATE_LIMITED'
  )
})

test('rateLimit：缺少 collection 时 throw CONFIG_ERROR（fail-closed，M1 修复）', async () => {
  const { rateLimit } = loadRate(makeRateMock().fakeSdk)
  await assert.rejects(
    rateLimit({ match: { userId: 'u1' }, windowMs: 30000, max: 1 }),
    (err) => err.code === 'CONFIG_ERROR' && /缺少 collection/.test(err.message)
  )
})
