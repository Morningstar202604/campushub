// image-check.test.js — 图片审核必须走同步 imgSecCheck + Buffer（D4 回归防护）
// 微信口径：同步 imgSecCheck 的入参是 media:{contentType,value:Buffer}，图片 ≤1MB；
// 带 media_url 的是异步 mediaCheckAsync（且 media_type 图片=2）。
// 旧实现把两者混用（imgSecCheck + version:'2' + media:{type:1, media_url}），
// 在 fail-closed 策略下的后果是：所有带图发布被当作"审核服务不可用"拒绝。
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const fs = require('fs')
const os = require('os')
const path = require('path')

const COMMON_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
const originalLoad = Module._load

const calls = []

function makeMockCloud({
  ext = 'png',
  bytes = 1024,
  downloadFail = false,
  secError = null,
  secErrCode = null
} = {}) {
  const mk = () => {
    const p = path.join(
      os.tmpdir(),
      `campushub-img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    )
    fs.writeFileSync(p, Buffer.alloc(bytes, 0x42))
    return p
  }
  const tmp = mk()
  calls.length = 0
  return {
    // checkImage 审核完会 unlink 临时文件，因此每次下载都必须给一个新文件，
    // 否则第 2 张起会读到已删除的路径（夹具问题，不是被测代码问题）
    tmp,
    fresh: mk,
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    getWXContext: () => ({ OPENID: 'test_openid' }),
    downloadFile: async ({ fileID }) => {
      if (downloadFail) throw new Error('download failed')
      calls.push({ api: 'downloadFile', fileID })
      return { tempFilePath: mk(), statusCode: 200 }
    },
    getTempFileURL: async () => ({ fileList: [{ tempFileURL: 'https://tmp.example.com/a.png' }] }),
    openapi: {
      security: {
        imgSecCheck: async (args) => {
          calls.push({ api: 'imgSecCheck', args })
          if (secError) {
            const e = new Error(secError)
            if (secErrCode) e.errCode = secErrCode
            throw e
          }
          return { errCode: 0 }
        },
        msgSecCheck: async () => ({ errCode: 0 })
      }
    },
    database: () => ({
      collection: () => ({ doc: () => ({ get: async () => ({ data: null }) }) }),
      command: {}
    })
  }
}

function loadSecurity(mockCloud) {
  Module._load = function (request) {
    if (request === 'wx-server-sdk') return mockCloud
    return originalLoad.apply(this, arguments)
  }
  for (const f of ['common-db.js', 'common-security.js', 'common-error.js']) {
    delete require.cache[path.join(COMMON_DIR, f)]
  }
  const security = require(path.join(COMMON_DIR, 'common-security.js'))
  Module._load = originalLoad
  return security
}

afterEach(() => {
  Module._load = originalLoad
})

test('checkImage：必须以同步 imgSecCheck 传 Buffer，禁止把 media_url 交给同步接口', async () => {
  const mock = makeMockCloud()
  const { checkImage } = loadSecurity(mock)
  await checkImage({ fileID: 'cloud://env-x.abc/campus/1.png', openid: 'o1' })
  const sec = calls.find((c) => c.api === 'imgSecCheck')
  assert.ok(sec, '必须调用 imgSecCheck')
  assert.equal(Buffer.isBuffer(sec.args.media.value), true, 'media.value 必须是 Buffer')
  assert.equal(sec.args.media.contentType, 'image/png')
  assert.equal(sec.args.media.media_url, undefined, '同步接口不接受 media_url')
  assert.equal(sec.args.media_url, undefined)
})

test('checkImage：外链/非 cloud:// fileID 一律拒绝（审核后门）', async () => {
  const mock = makeMockCloud()
  const { checkImage } = loadSecurity(mock)
  await assert.rejects(
    checkImage({ fileID: 'https://evil.example.com/a.png', openid: 'o1' }),
    (e) => e.code === 'INVALID_PARAM'
  )
})

test('checkImage：超过微信同步接口 1MB 上限时给出明确错误码，而不是笼统的"服务不可用"', async () => {
  const mock = makeMockCloud({ bytes: 1024 * 1024 + 10 })
  const { checkImage } = loadSecurity(mock)
  await assert.rejects(
    checkImage({ fileID: 'cloud://env-x.abc/campus/big.png', openid: 'o1' }),
    (e) => e.code === 'IMAGE_TOO_LARGE'
  )
})

test('checkImage：非白名单图片格式拒绝', async () => {
  const mock = makeMockCloud({ ext: 'svg' })
  const { checkImage } = loadSecurity(mock)
  await assert.rejects(
    checkImage({ fileID: 'cloud://env-x.abc/campus/a.svg', openid: 'o1' }),
    (e) => e.code === 'IMAGE_TYPE_UNSUPPORTED'
  )
})

test('checkImage：下载失败仍 fail-closed（不得放行未审核图片）', async () => {
  const mock = makeMockCloud({ downloadFail: true })
  const { checkImage } = loadSecurity(mock)
  await assert.rejects(
    checkImage({ fileID: 'cloud://env-x.abc/campus/a.png', openid: 'o1' }),
    (e) => e.code === 'CONTENT_CHECK_UNAVAILABLE'
  )
})

test('checkImage：87014 判定为内容违规', async () => {
  const mock = makeMockCloud({ secError: 'risky', secErrCode: 87014 })
  const { checkImage } = loadSecurity(mock)
  await assert.rejects(
    checkImage({ fileID: 'cloud://env-x.abc/campus/a.png', openid: 'o1' }),
    (e) => e.code === 'CONTENT_RISKY'
  )
})

test('checkImages：并发必须有上限，避免 9 张图瞬时打穿审核接口配额', async () => {
  let inFlight = 0
  let peak = 0
  const mock = makeMockCloud()
  mock.downloadFile = async ({ fileID }) => ({
    tempFilePath: mock.fresh(),
    statusCode: 200,
    fileID
  })
  mock.openapi.security.imgSecCheck = async () => {
    inFlight++
    peak = Math.max(peak, inFlight)
    await new Promise((r) => setTimeout(r, 10))
    inFlight--
    return { errCode: 0 }
  }
  const { checkImages } = loadSecurity(mock)
  await checkImages(
    Array.from({ length: 9 }, (_, i) => `cloud://env-x.abc/campus/${i}.png`),
    { openid: 'o1' }
  )
  assert.ok(peak <= 4, `并发峰值 ${peak} 应 ≤4`)
})
