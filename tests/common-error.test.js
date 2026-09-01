// common-error.test.js — 统一错误模型与响应格式（纯逻辑，无外部依赖）
const { test } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const { AppError, ok, fail, wrap } = require(path.resolve(__dirname, '..', 'cloudfunctions', 'common', 'common-error.js'))

test('AppError 携带 code/status', () => {
  const e = new AppError('内容包含敏感信息', 'CONTENT_RISKY')
  assert.equal(e.message, '内容包含敏感信息')
  assert.equal(e.code, 'CONTENT_RISKY')
  assert.equal(e.status, 400)
  assert.ok(e instanceof Error)
})

test('ok() 返回 success 并合并数据', () => {
  const r = ok({ list: [1] }, { extra: 2 })
  assert.deepEqual(r, { success: true, list: [1], extra: 2 })
})

test('fail() 返回失败结构', () => {
  const r = fail('操作失败', 'BUSINESS_ERROR', { detail: 'x' })
  assert.equal(r.success, false)
  assert.equal(r.message, '操作失败')
  assert.equal(r.code, 'BUSINESS_ERROR')
  assert.equal(r.detail, 'x')
})

test('wrap 把 AppError 收敛为 { success:false }', async () => {
  const handler = wrap(async () => { throw new AppError('已关注该用户', 'ALREADY') })
  const r = await handler()
  assert.equal(r.success, false)
  assert.equal(r.message, '已关注该用户')
  assert.equal(r.code, 'ALREADY')
})

test('wrap 把未知异常收敛为 INTERNAL_ERROR，不泄漏内部信息', async () => {
  const handler = wrap(async () => { throw new Error('数据库连接串 password=secret 泄漏') })
  const r = await handler()
  assert.equal(r.success, false)
  assert.equal(r.code, 'INTERNAL_ERROR')
  assert.equal(r.message, '服务异常，请稍后再试')
  assert.ok(!JSON.stringify(r).includes('password'))
})

test('wrap 透传成功结果', async () => {
  const handler = wrap(async () => ({ success: true, id: 'abc' }))
  const r = await handler()
  assert.equal(r.success, true)
  assert.equal(r.id, 'abc')
})
