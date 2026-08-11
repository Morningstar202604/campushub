// app.js
App({
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    statusBarHeight: 0,
    navBarHeight: 0,
    screenHeight: 0,
    safeAreaBottom: 0,
    needRefresh: false
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'campushub', // 替换为你的云开发环境ID
        traceUser: true
      })
    }

    // 获取系统信息
    const sysInfo = wx.getWindowInfo()
    const menuInfo = wx.getMenuButtonBoundingClientRect()
    
    this.globalData.statusBarHeight = sysInfo.statusBarHeight
    this.globalData.navBarHeight = (menuInfo.top - sysInfo.statusBarHeight) * 2 + menuInfo.height
    this.globalData.screenHeight = sysInfo.screenHeight
    this.globalData.safeAreaBottom = sysInfo.screenHeight - sysInfo.safeArea.bottom

    // 检查登录状态
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

  // 检查是否登录，未登录跳转登录页
  ensureLogin() {
    if (!this.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/login' })
      return false
    }
    return true
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
