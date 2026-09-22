// app.js
const { getSchoolConfig } = require('./config/school.js')

App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    statusBarHeight: 0,
    navBarHeight: 0,
    screenHeight: 0,
    safeAreaBottom: 0,
    loginRedirect: ''
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      // 多校隔离：env 由 config/school.js 的 envId 决定（每校 clone 后只改这一个文件）。
      // 所有 callFunction 经 utils/request.js 收口，env 在 init 时即定，无需改动分散的调用点。
      wx.cloud.init({
        env: getSchoolConfig().envId,
        traceUser: true
      })
    }

    // 获取系统信息（独立 try/catch：低版本基础库/异常机型抛错时不阻断登录态恢复）
    try {
      const sysInfo = wx.getWindowInfo()
      const menuInfo = wx.getMenuButtonBoundingClientRect()

      this.globalData.statusBarHeight = sysInfo.statusBarHeight
      this.globalData.navBarHeight = (menuInfo.top - sysInfo.statusBarHeight) * 2 + menuInfo.height
      this.globalData.screenHeight = sysInfo.screenHeight
      this.globalData.safeAreaBottom = sysInfo.screenHeight - sysInfo.safeArea.bottom
    } catch (e) {
      console.error('系统信息获取失败(已跳过):', e)
    }

    // 检查登录状态（必须在异常兜底之外保证执行）
    this.checkLogin()
  },

  checkLogin() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.isLoggedIn = true
    }
  },

  // 设置用户信息
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.isLoggedIn = true
    wx.setStorageSync('userInfo', userInfo)
  },

  // 清除登录状态
  clearUserInfo() {
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    wx.removeStorageSync('userInfo')
  },

  // 检查是否登录，未登录跳转登录页（记录来源页，登录成功后自动回跳）
  ensureLogin() {
    const { ensureLogin } = require('./utils/auth.js')
    return ensureLogin()
  },

  // 刷新用户统计数据（发布/收藏后调用）
  async refreshUserInfo() {
    if (!this.globalData.userInfo) return
    try {
      const { callFunction } = require('./utils/request.js')
      const res = await callFunction('login', {})
      if (res.success && res.user) {
        this.setUserInfo(res.user)
      }
    } catch (e) {
      // 静默失败，不影响用户操作
    }
  }
})
