// miniprogram/utils/cache.js
// 本地 TTL 缓存（降本 C2）：减少首屏云函数调用次数。
// key 统一加前缀存储，便于一键清理；所有操作静默失败，不影响主流程。
const PREFIX = 'cache_'

/**
 * 写入缓存
 * @param {string} key 业务键名（自动加前缀）
 * @param {*} data 任意可序列化数据
 * @param {number} ttlMs 有效期（毫秒），默认 5 分钟
 */
function setCache(key, data, ttlMs = 5 * 60 * 1000) {
  try {
    wx.setStorageSync(PREFIX + key, { data, expiresAt: Date.now() + ttlMs })
  } catch (e) {
    // 存储满/异常时静默放弃缓存
  }
}

/**
 * 读取缓存，过期或不存在返回 null
 */
function getCache(key) {
  try {
    const wrapped = wx.getStorageSync(PREFIX + key)
    if (wrapped && typeof wrapped === 'object' && wrapped.expiresAt && Date.now() < wrapped.expiresAt) {
      return wrapped.data
    }
    // 过期数据顺手清理
    if (wrapped) wx.removeStorageSync(PREFIX + key)
  } catch (e) {
    // ignore
  }
  return null
}

/**
 * 清除指定缓存；不传 key 时清除全部带前缀的缓存
 */
function clearCache(key) {
  try {
    if (key) {
      wx.removeStorageSync(PREFIX + key)
      return
    }
    const info = wx.getStorageInfoSync()
    ;(info.keys || []).forEach((k) => {
      if (k.indexOf(PREFIX) === 0) wx.removeStorageSync(k)
    })
  } catch (e) {
    // ignore
  }
}

module.exports = { setCache, getCache, clearCache, PREFIX }
