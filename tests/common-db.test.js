// common-db.test.js — isDuplicateKeyError / insertIdempotent 幂等语义（防并发去重回归）
// 通过拦截 require('wx-server-sdk') 注入 mock，真实加载 common-db.js。
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const path = require('path')

const COMMON_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
const originalLoad = Module._load

function loadCommonDb({ addImpl } = {}) {
  const addImplUsed = addImpl || (async () => {})
  const db = {
    command: { gt: (v) => ({ $gt: v }) },
    collection() {
      return {
        add: async ({ data }) => addImplUsed(data),
        where: () => ({ count: async () => ({ total: 0 }) })
      }
    }
  }
  const fakeSdk = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database() {
      return db
    },
    getWXContext() {
      return { OPENID: 'test' }
    }
  }
  Module._load = function (request, _parent, _isMain) {
    if (request === 'wx-server-sdk') return fakeSdk
    return originalLoad.apply(this, arguments)
  }
  delete require.cache[path.join(COMMON_DIR, 'common-db.js')]
  const mod = require(path.join(COMMON_DIR, 'common-db.js'))
  Module._load = originalLoad
  return mod
}

afterEach(() => {
  Module._load = originalLoad
})

test('isDuplicateKeyError 识别唯一索引冲突（含微信云开发错误码）', () => {
  const { isDuplicateKeyError } = loadCommonDb()
  assert.equal(isDuplicateKeyError({ errMsg: 'duplicate key error' }), true)
  assert.equal(isDuplicateKeyError({ message: 'E11000 duplicate key' }), true)
  assert.equal(isDuplicateKeyError({ errMsg: 'document already exists (-502001)' }), true)
  assert.equal(isDuplicateKeyError({ message: 'network error' }), false)
  assert.equal(isDuplicateKeyError(null), false)
})

test('insertIdempotent：插入成功返回 true，唯一键冲突返回 false，其他异常原样抛出', async () => {
  let call = 0
  const { insertIdempotent } = loadCommonDb({
    addImpl: async () => {
      call++
      if (call === 2) {
        const e = new Error('duplicate key')
        e.errCode = -502001
        throw e
      }
      if (call === 3) throw new Error('db down')
    }
  })
  assert.equal(await insertIdempotent('likes', {}), true)
  assert.equal(await insertIdempotent('likes', {}), false) // 冲突 → 幂等 false
  await assert.rejects(() => insertIdempotent('likes', {}), /db down/) // 真实故障 → 抛出
})


/* ---------------- v0.12.0 分页参数收敛 ---------------- */

test('pageParams：非法页码/页宽回落默认值，并夹在合法区间内', () => {
  const { pageParams } = loadCommonDb()
  assert.deepEqual(pageParams({ page: 'abc', pageSize: 'xyz' }), {
    page: 1,
    pageSize: 20,
    skip: 0
  })
  assert.deepEqual(pageParams({ page: 0, pageSize: 0 }, { defaultSize: 20, maxSize: 100 }), {
    page: 1,
    pageSize: 1,
    skip: 0
  })
  assert.deepEqual(pageParams({ page: -5, pageSize: 999 }, { defaultSize: 20, maxSize: 50 }), {
    page: 1,
    pageSize: 50,
    skip: 0
  })
  assert.deepEqual(pageParams({ page: 3, pageSize: 10 }), { page: 3, pageSize: 10, skip: 20 })
  // 小数向下取整，避免 skip 出现非整数
  assert.deepEqual(pageParams({ page: 2.9, pageSize: 7.8 }), { page: 2, pageSize: 7, skip: 7 })
})

test('clampInt：边界与 NaN/Infinity 行为固定', () => {
  const { clampInt } = loadCommonDb()
  assert.equal(clampInt(undefined, 20, 1, 100), 20)
  assert.equal(clampInt(NaN, 20, 1, 100), 20)
  assert.equal(clampInt(Infinity, 20, 1, 100), 20)
  assert.equal(clampInt(-Infinity, 20, 1, 100), 20)
  assert.equal(clampInt(0, 20, 1, 100), 1)
  assert.equal(clampInt(1000, 20, 1, 100), 100)
})
