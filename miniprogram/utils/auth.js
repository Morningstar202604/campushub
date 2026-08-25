// utils/auth.js — 登录态管理
// 注意：不能在模块顶层调用 getApp()，因为 require 时 app 可能尚未初始化

/**
 * 获取 App 实例（延迟获取）
 */
function getAppInstance() {
  return getApp()
}

/**
 * 检查登录状态
 */
function isLoggedIn() {
  return getAppInstance().globalData.isLoggedIn
}

/**
 * 获取当前用户信息
 */
function getUserInfo() {
  return getAppInstance().globalData.userInfo
}

/**
 * 获取用户ID
 */
function getUserId() {
  const user = getAppInstance().globalData.userInfo
  return user ? user._id : null
}

/**
 * 确保已登录，否则记录来源页并跳转登录页。
 * 登录成功后按来源页回跳（tabBar 页用 switchTab，其余 navigateBack 兜底）。
 */
function ensureLogin() {
  if (!isLoggedIn()) {
    const pages = getCurrentPages()
    const current = pages && pages.length ? pages[pages.length - 1] : null
    if (current) {
      getAppInstance().globalData.loginRedirect = '/' + current.route
    }
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  }
  return true
}

/**
 * 退出登录
 */
function logout() {
  getAppInstance().clearUserInfo()
  wx.reLaunch({ url: '/pages/index/index' })
}

/**
 * 格式化时间
 */
function formatTime(time) {
  if (!time) return ''
  const date = new Date(time)
  const now = Date.now()
  const diff = now - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前'
  
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}月${day}日`
}

/**
 * 格式化数字
 */
function formatNumber(num) {
  if (num < 1000) return String(num)
  if (num < 10000) return (num / 1000).toFixed(1) + 'k'
  return (num / 10000).toFixed(1) + 'w'
}

/**
 * 取昵称首字符（emoji/代理对安全，WXML 的 str[0] 会截半个字符显示乱码）
 */
function firstChar(str) {
  const s = String(str || '').trim()
  if (!s) return ''
  return Array.from(s)[0] || s[0]
}

module.exports = {
  isLoggedIn,
  getUserInfo,
  getUserId,
  ensureLogin,
  logout,
  formatTime,
  formatNumber,
  firstChar
}
