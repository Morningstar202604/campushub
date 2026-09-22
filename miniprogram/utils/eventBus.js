// utils/eventBus.js — 轻量事件总线
//
// 替代 app.globalData.needRefresh 全局标志：后者在「发布成功后置 true、各页 onShow 读一次即清零」
// 的模型下存在竞态——第一个进入的页消费掉标志，其余页（如同时打开的 tab）不再刷新。
// 改为：发布页 emit('data-changed', { type }) ，各页在 onLoad 期间 on 订阅、onUnload 时 off，
// 按事件类型（post / product）判断是否需刷新，互不干扰。
const listeners = {}

// 订阅；返回取消订阅函数，便于 onUnload 直接调用清理
function on(event, fn) {
  if (!listeners[event]) listeners[event] = []
  listeners[event].push(fn)
  return () => off(event, fn)
}

function off(event, fn) {
  if (!listeners[event]) return
  listeners[event] = listeners[event].filter((f) => f !== fn)
}

// 发布；复制一份再遍历，避免回调内增删订阅导致迭代异常
function emit(event, payload) {
  if (!listeners[event]) return
  listeners[event].slice().forEach((fn) => {
    try { fn(payload) } catch (e) { console.error('[eventBus]', event, e) }
  })
}

module.exports = { on, off, emit }
