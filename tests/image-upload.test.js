// image-upload.test.js — 上传侧必须把图片压到审核接口上限之内（D4 前端部分）
// 后端同步 imgSecCheck 只接受 ≤1MB（微信硬限制）并会在超限时抛 IMAGE_TOO_LARGE。
// 若前端仍按 10MB 放行，用户会经历「上传成功 → 发布失败」，
// 而且 9 图发布里有大图时整条发布都会被拒。所以上限必须在两端一致。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const API = fs.readFileSync(
  path.resolve(__dirname, '..', 'uni-app', 'src', 'utils', 'api.ts'),
  'utf8'
)

test('上传上限必须等于后端审核上限 1MB，且不得残留 10MB 旧口径', () => {
  assert.match(API, /1024\s*\*\s*1024/, '必须存在 1MB 上限常量')
  assert.equal(
    /10\s*\*\s*1024\s*\*\s*1024/.test(API),
    false,
    '不得再按 10MB 放行（后端只审 1MB 以内）'
  )
})

test('小程序端必须按质量阶梯反复压缩直到达标，而不是只压一次', () => {
  assert.match(API, /COMPRESS_QUALITY_LADDER\s*=\s*\[[^\]]*\]/, '缺少质量阶梯')
  const ladder = API.match(/COMPRESS_QUALITY_LADDER\s*=\s*\[([^\]]*)\]/)[1]
  const steps = ladder.split(',').map((s) => s.trim()).filter(Boolean)
  assert.ok(steps.length >= 3, `阶梯至少 3 档，当前 ${steps.length} 档`)
  assert.match(API, /for\s*\(/, '阶梯必须有循环收敛，单次压缩无法保证 ≤1MB')
})

test('H5/App 端不得把原图裸传上去（必须有 canvas 或 uni.compressImage 压缩）', () => {
  // 必须精确取 uploadImage 里的 #ifndef MP 分支：文件其他位置也有同名条件编译标记，
  // 用首次出现的位置会把小程序分支一起圈进来，导致本用例假通过。
  const fnStart = API.indexOf('export async function uploadImage')
  assert.ok(fnStart > 0, '缺少 uploadImage 入口')
  const body = API.slice(fnStart)
  const from = body.indexOf('#ifndef MP')
  assert.ok(from > 0, 'uploadImage 必须有 #ifndef MP 分支')
  const seg = body.slice(from, body.indexOf('#endif', from))
  assert.match(seg, /uni\.compressImage|canvas|toBlob|createImageBitmap/, 'H5/App 分支必须做压缩')
})

test('压缩后仍超限必须就地报错，不能等后端审核才失败', () => {
  assert.match(API, /IMAGE_TOO_LARGE|图片过大|超过\s*1MB/, '缺少超限拦截')
})

test('GIF 等不支持压缩的格式必须走大小校验后拒绝，而不是静默上传', () => {
  // 后端图片白名单：jpg/jpeg/png/gif/bmp；wx.compressImage 仅支持 jpeg/png。
  // 因此不可压缩的格式必须显式判大小。
  assert.match(API, /不支持压缩|compressImage 不可用|无法压缩|skipCompress/, '需说明不可压缩格式的处置')
})
