// common-scope.js — 请求作用域（零依赖）
//
// 为什么单独一层：请求身份必须按请求隔离，而 wrap() 位于 common-error.js ——
// 那是纯逻辑模块，不能反过来依赖 common-db/wx-server-sdk，否则任何只想用
// ok/fail 的地方都被拖上数据库依赖链（单测里直接报 Cannot find module）。
// 本文件只依赖 node 内置模块，谁都能安全引入。
//
// 为什么需要隔离：云函数实例会并发处理多个请求。用模块级变量存"当前请求"，
// 在 handler 的 await 间隙会被另一个请求覆写 —— 等于把 A 的身份借给 B，
// 比"未登录"严重得多。AsyncLocalStorage 每个异步链各自持有一份，天然不串号。
const { AsyncLocalStorage } = require('async_hooks')

const _als = new AsyncLocalStorage()

// 无 ALS 上下文时的退化存储：仅测试直调 / 单请求脚本可达
let _legacyEvent = null

/** 在绑定好 event 的异步作用域内执行 fn */
function runWithEvent(event, fn) {
  return _als.run({ event: event || null }, fn)
}

/** 兼容入口：网关在调用 handler 前绑定 */
function bindEvent(event) {
  _legacyEvent = event || null
}

/** 取当前请求 event（可能在 ALS 作用域外，返回退化值） */
function getCurrentEvent() {
  const store = _als.getStore()
  return store ? store.event : _legacyEvent
}

module.exports = { runWithEvent, bindEvent, getCurrentEvent }
