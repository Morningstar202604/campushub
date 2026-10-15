// gateway-dispatch.test.js — 直接对构建产物做分发行为验证
// 前面几条用例锁的是源码结构；本文件加载 dist/ 里那个**真正会被上传到云端的文件**，
// 断言它的路由行为，防止"结构看起来对、产物里其实接不上"。
const { test } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const fs = require('fs')
const path = require('path')

const DIST = path.resolve(__dirname, '..', 'dist', 'cloudfunctions')
const originalLoad = Module._load

// 最小云环境桩：只满足"进入 handler 前的那几步"——取身份、拿 db 引用。
// 断言点不落在桩的行为上，而落在网关是否把请求交给了正确的 handler。
function stubSdk({ openid = '' } = {}) {
  const db = {
    command: {
      neq: (v) => ({ $neq: v }),
      inc: (n) => ({ $inc: n }),
      in: (a) => ({ $in: a }),
      gte: (v) => ({ $gte: v }),
      lt: (v) => ({ $lt: v }),
      and: (a) => ({ $and: a }),
      or: (a) => ({ $or: a })
    },
    collection: () => ({
      doc: () => ({ get: async () => ({ data: null }), update: async () => ({ stats: { updated: 0 } }) }),
      where: () => ({ get: async () => ({ data: [] }), count: async () => ({ total: 0 }) }),
      add: async () => ({ _id: 'x' })
    })
  }
  Module._load = function (request) {
    if (request === 'wx-server-sdk') {
      return {
        DYNAMIC_CURRENT_ENV: 'test',
        init() {},
        getWXContext: () => (openid ? { OPENID: openid } : {}),
        database: () => db,
        openapi: { security: {} }
      }
    }
    return originalLoad.apply(this, arguments)
  }
}

function loadGateway(gw) {
  const file = path.join(DIST, gw, 'index.js')
  assert.ok(fs.existsSync(file), `产物不存在：dist/cloudfunctions/${gw}/index.js（先跑 npm run build:functions）`)
  delete require.cache[require.resolve(file)]
  const mod = require(file)
  Module._load = originalLoad
  return mod
}

test('未知 fn 必须被拒绝，且不得落到任何 handler 上', async () => {
  stubSdk({ openid: 'o_attacker' })
  const gw = loadGateway('api-post')
  const r = await gw.main({ fn: 'init-db' }, {})
  assert.equal(r.success, false)
  assert.equal(r.code, 'UNKNOWN_FUNCTION')
})

test('缺 fn 与 fn 类型伪装（对象/数组）都不能被当作合法入口', async () => {
  stubSdk({ openid: 'o1' })
  const gw = loadGateway('api-post')
  for (const bad of [undefined, null, '', 123, {}, [], 'post-create-extra']) {
    const r = await gw.main({ fn: bad }, {})
    assert.equal(r.code, 'UNKNOWN_FUNCTION', `fn=${JSON.stringify(bad)} 应被拒绝`)
  }
})

test('登记过的 fn 必须真正进入对应 handler（而不是被网关吞掉）', async () => {
  // 不给 OPENID：进入 handler 后 requireActiveUser 会抛 AUTH_REQUIRED。
  // 出现 AUTH_REQUIRED 就说明请求确实穿过了网关、执行到了业务代码，
  // 而不是停在路由层（停在路由层只会得到 UNKNOWN_FUNCTION）。
  stubSdk({ openid: '' })
  const gw = loadGateway('api-post')
  const r = await gw.main({ fn: 'post-create', title: 't', content: 'c' }, {})
  assert.equal(r.success, false)
  assert.equal(r.code, 'AUTH_REQUIRED', `期望走到 handler（AUTH_REQUIRED），实际：${JSON.stringify(r)}`)
})

test('跨网关不可越权：api-post 不认得 admin 的入口', async () => {
  stubSdk({ openid: 'o1' })
  const gw = loadGateway('api-post')
  const r = await gw.main({ fn: 'admin' }, {})
  assert.equal(r.code, 'UNKNOWN_FUNCTION')
})
