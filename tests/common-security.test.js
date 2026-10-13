// common-security.test.js — 内容安全与管理员识别（fail-closed 回归防护）
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const fs = require('fs')
const os = require('os')
const path = require('path')

const COMMON_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
const originalLoad = Module._load

// 构造 mock 云环境
// 图片审核走「downloadFile → 本地 Buffer → 同步 imgSecCheck」链路，
// 因此 mock 必须提供 downloadFile 并返回一个真实存在的临时文件。
function makeMockCloud({ msgSecResult = null, msgSecError = null, imgSecResult = null, imgSecError = null, imgBytes = 1024, downloadFail = null } = {}) {
  return {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    getWXContext() { return { OPENID: 'test_openid' } },
    openapi: {
      security: {
        msgSecCheck: async () => { if (msgSecError) throw msgSecError; return msgSecResult },
        imgSecCheck: async () => { if (imgSecError) throw imgSecError; return imgSecResult }
      }
    },
    getTempFileURL: async () => ({ fileList: [{ tempFileURL: 'https://tmp.example.com/img.jpg' }] }),
    downloadFile: async () => {
      if (downloadFail) throw downloadFail
      const p = path.join(os.tmpdir(), `campushub-sec-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`)
      fs.writeFileSync(p, Buffer.alloc(imgBytes, 0x41))
      return { tempFilePath: p, statusCode: 200 }
    },
    database() {
      return {
        collection: () => ({ doc: () => ({ get: async () => ({ data: { adminOpenids: [] } }) }) }),
        command: {}
      }
    }
  }
}

function loadSecurity(mockCloud) {
  Module._load = function (request, _parent, _isMain) {
    if (request === 'wx-server-sdk') return mockCloud
    return originalLoad.apply(this, arguments)
  }
  delete require.cache[path.join(COMMON_DIR, 'common-db.js')]
  delete require.cache[path.join(COMMON_DIR, 'common-security.js')]
  delete require.cache[path.join(COMMON_DIR, 'common-error.js')]
  const security = require(path.join(COMMON_DIR, 'common-security.js'))
  Module._load = originalLoad
  return security
}

afterEach(() => {
  Module._load = originalLoad
  delete process.env.ADMIN_OPENIDS
})

// ---------- checkAdmin ----------

test('checkAdmin：环境变量 ADMIN_OPENIDS 命中时返回 true', async () => {
  process.env.ADMIN_OPENIDS = 'openid_admin,openid_extra'
  const { checkAdmin } = loadSecurity(makeMockCloud())
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: null }) }) }) }
  assert.equal(await checkAdmin(db, 'openid_admin'), true)
})

test('checkAdmin：不在环境变量 + DB 无配置时返回 false', async () => {
  delete process.env.ADMIN_OPENIDS
  const { checkAdmin } = loadSecurity(makeMockCloud())
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: null }) }) }) }
  assert.equal(await checkAdmin(db, 'openid_unknown'), false)
})

test('checkAdmin：DB 文档不存在时返回 false（非异常，正常降级）', async () => {
  delete process.env.ADMIN_OPENIDS
  const { checkAdmin } = loadSecurity(makeMockCloud())
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => { const e = new Error('document not exists'); e.errCode = -1; throw e }
      })
    })
  }
  assert.equal(await checkAdmin(db, 'openid_unknown'), false)
})

test('checkAdmin：DB 异常（非"不存在"）时 fail-closed 抛出 ADMIN_CONFIG_ERROR', async () => {
  delete process.env.ADMIN_OPENIDS
  const { checkAdmin } = loadSecurity(makeMockCloud())
  const db = {
    collection: () => ({
      doc: () => ({ get: async () => { throw new Error('ETIMEDOUT network error') } })
    })
  }
  await assert.rejects(
    checkAdmin(db, 'openid_any'),
    (err) => err.code === 'ADMIN_CONFIG_ERROR'
  )
})

// ---------- checkImage (fail-closed) ----------

test('checkImage：非 cloud:// fileID 直接拒绝（INVALID_PARAM）', async () => {
  const { checkImage } = loadSecurity(makeMockCloud())
  await assert.rejects(
    checkImage({ fileID: 'https://evil.com/porn.jpg', openid: 'o1' }),
    (err) => err.code === 'INVALID_PARAM'
  )
})

test('checkImage：空 fileID 直接拒绝', async () => {
  const { checkImage } = loadSecurity(makeMockCloud())
  await assert.rejects(
    checkImage({ fileID: '', openid: 'o1' }),
    (err) => err.code === 'INVALID_PARAM'
  )
})

test('checkImage：图片命中违规（errCode 87014）拒绝（CONTENT_RISKY）', async () => {
  const cloud = makeMockCloud({ imgSecError: { errCode: 87014, errMsg: 'risky content' } })
  const { checkImage } = loadSecurity(cloud)
  await assert.rejects(
    checkImage({ fileID: 'cloud://test.bucket/abc.jpg', openid: 'o1' }),
    (err) => err.code === 'CONTENT_RISKY' && /敏感/.test(err.message)
  )
})

test('checkImage：imgSecCheck 不可用时 fail-closed 拒绝（CONTENT_CHECK_UNAVAILABLE）', async () => {
  const cloud = makeMockCloud({ imgSecError: { errCode: 40001, errMsg: 'api not authorized' } })
  const { checkImage } = loadSecurity(cloud)
  await assert.rejects(
    checkImage({ fileID: 'cloud://test.bucket/abc.jpg', openid: 'o1' }),
    (err) => err.code === 'CONTENT_CHECK_UNAVAILABLE'
  )
})

// ---------- checkContent (fail-closed) ----------

test('checkContent：命中违规文本（errCode 87014）拒绝', async () => {
  const cloud = makeMockCloud({ msgSecError: { errCode: 87014 } })
  const { checkContent } = loadSecurity(cloud)
  await assert.rejects(
    checkContent({ content: '违规内容', openid: 'o1' }),
    (err) => err.code === 'CONTENT_RISKY'
  )
})

test('checkContent：msgSecCheck 异常时 fail-closed 拒绝', async () => {
  const cloud = makeMockCloud({ msgSecError: { errMsg: 'network unreachable' } })
  const { checkContent } = loadSecurity(cloud)
  await assert.rejects(
    checkContent({ content: '正常内容', openid: 'o1' }),
    (err) => err.code === 'CONTENT_CHECK_UNAVAILABLE'
  )
})

test('checkContent：空字符串不调用 API（正常放行）', async () => {
  let called = false
  const cloud = makeMockCloud()
  cloud.openapi.security.msgSecCheck = async () => { called = true }
  const { checkContent } = loadSecurity(cloud)
  await checkContent({ content: '   ', openid: 'o1' })
  assert.equal(called, false, '空内容不应调用 msgSecCheck')
})
