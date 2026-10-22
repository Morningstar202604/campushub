// cross-platform-identity.test.ts — H5/APK 设备令牌的前端链路
//
// 守的是上线阻塞项：H5 与 APK 走 REST 没有 OPENID，必须
//   ① 首次 login 后把服务端签发的令牌落到本地存储；
//   ② 之后每个请求体都带上 __identity；
//   ③ 退出登录时清掉令牌。
// 任一条断了，用户就会看到"能打开页面但什么都做不了"。
import { test, beforeEach } from 'node:test'
import assert from 'node:assert'
import { loadModule, resetStores } from './_harness.ts'

const memory = new Map<string, any>()

function installUni() {
  globalThis.uni = {
    showToast() {},
    // 复刻 uni 的真实行为：对象会被包成 { type, data }，这是本项目踩过多次的坑
    getStorageSync: (k: string) => {
      const v = memory.get(k)
      if (v === undefined) return ''
      if (typeof v === 'string') return { type: 'string', data: v }
      return v
    },
    setStorageSync: (k: string, v: any) => memory.set(k, v),
    removeStorageSync: (k: string) => memory.delete(k),
    navigateTo() {},
    showModal() {}
  } as any
}

let api: any

beforeEach(async () => {
  memory.clear()
  resetStores()
  installUni()
  delete (globalThis as any).__CALL_STUB__
  api = await loadModule('utils/api.ts')
})

test('setIdentityToken 后能原样读回（穿得透 uni 的 {type,data} 信封）', () => {
  api.setIdentityToken('tok_abc.def')
  assert.equal(api.getIdentityToken(), 'tok_abc.def')
})

test('clearIdentityToken 后读回空串', () => {
  api.setIdentityToken('tok_abc.def')
  api.clearIdentityToken()
  assert.equal(api.getIdentityToken(), '')
})

test('没有令牌时读回空串而不是抛错', () => {
  assert.equal(api.getIdentityToken(), '')
})

test('login 响应里的 identityToken 会被持久化（H5/APK 首登）', async () => {
  // 用 __CALL_STUB__ 拦截真实调用，返回带令牌的 login 响应
  ;(globalThis as any).__CALL_STUB__ = async (name: string) => {
    if (name === 'login') return { success: true, user: { _id: 'u1' }, identityToken: 'issued.tok' }
    return { success: true }
  }
  await api.callFunction('login', {})
  assert.equal(api.getIdentityToken(), 'issued.tok', 'login 必须落盘 identityToken')
})

test('非 login 接口的响应不得覆盖已有令牌', async () => {
  api.setIdentityToken('keep.me')
  ;(globalThis as any).__CALL_STUB__ = async () => ({ success: true, identityToken: 'evil.tok' })
  await api.callFunction('post-list', { page: 1 })
  assert.equal(api.getIdentityToken(), 'keep.me')
})
