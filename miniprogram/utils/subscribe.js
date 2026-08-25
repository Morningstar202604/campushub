// utils/subscribe.js — 微信订阅消息（客户端）
// 模板 ID 由云端下发（管理员在云函数环境变量配置 TMPL_COMMENT/TMPL_LIKE/TMPL_FOLLOW），
// 未配置时本工具静默跳过，不影响任何流程。
const { callFunction } = require('./request.js')

let _tmplIds = null

async function fetchTmplIds() {
  if (_tmplIds) return _tmplIds
  try {
    const res = await callFunction('notification', { action: 'tmplIds' })
    if (res.success && res.tmplIds) {
      _tmplIds = res.tmplIds
      return _tmplIds
    }
  } catch (e) { /* 静默 */ }
  return {}
}

/**
 * 请求订阅指定类别的消息（在用户点击行为后调用，符合微信规范）。
 * @param {string[]} keys 如 ['comment'] / ['comment','like']
 */
async function requestSubscribe(keys = []) {
  try {
    const ids = await fetchTmplIds()
    const tmplIds = keys.map(k => ids[k]).filter(Boolean)
    if (!tmplIds.length) return false
    await wx.requestSubscribeMessage({ tmplIds })
    return true
  } catch (e) {
    // 用户拒绝/基础库不支持等，静默
    return false
  }
}

module.exports = { requestSubscribe }
