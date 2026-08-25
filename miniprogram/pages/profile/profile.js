// pages/profile/profile.js
const app = getApp()
const { logout, ensureLogin, firstChar } = require('../../utils/auth.js')
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    user: null,
    isAdmin: false,
    unreadCount: 0
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      const u = app.globalData.userInfo; this.setData({ user: u ? { ...u, nicknameFirst: firstChar(u.nickname) } : null })
      this.checkAdmin()
      this.refreshUserData()
      this.loadUnreadCount()
    } else {
      this.setData({ user: null, isAdmin: false, unreadCount: 0 })
    }
  },

  // 从服务端刷新用户统计数据
  async refreshUserData() {
    try {
      const res = await callFunction('login', {})
      if (res.success && res.user) {
        app.setUserInfo(res.user)
        this.setData({ user: { ...res.user, nicknameFirst: firstChar(res.user.nickname) }, campusVerified: res.user.campusVerified === true })
      }
    } catch (e) {}
  },

  // 未读通知数
  async loadUnreadCount() {
    try {
      const res = await callFunction('notification', { action: 'unreadCount' })
      if (res.success) this.setData({ unreadCount: res.unreadCount })
    } catch (e) {}
  },

  // 仅用于前端显示/隐藏"管理后台"入口；真实权限始终在云函数校验
  async checkAdmin() {
    try {
      const res = await callFunction('admin', { action: 'check' })
      if (res.success) this.setData({ isAdmin: !!res.isAdmin })
    } catch (e) {
      // 忽略：非管理员或网络异常都不应影响个人页
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  goEdit() {
    if (!ensureLogin()) return
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  goMyList(e) {
    if (!ensureLogin()) return
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: `/pages/my-list/my-list?type=${type}` })
  },

  goAbout() {
    wx.showModal({
      title: '关于 CampusHub',
      content: 'CampusHub 是一个全国性校园/兴趣内容社区，提供社区贴吧、二手交易、校园指南等功能。\n\n平台仅提供信息展示，不参与交易担保。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
  },

  goNotification() {
    wx.navigateTo({ url: '/pages/notifications/notifications' })
  },

  // 每日签到
  async onCheckin() {
    if (!ensureLogin()) return
    if (this._checkinLock) return // 在途锁：连点不重复发请求（服务端另有唯一索引兜底）
    this._checkinLock = true
    try {
      const res = await callFunction('checkin', {})
      if (res.success) {
        wx.showToast({ title: res.message, icon: 'success' })
        // 刷新用户数据
        await this.refreshUserData()
      } else {
        wx.showToast({ title: res.message || '签到失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '签到失败', icon: 'none' })
    } finally {
      this._checkinLock = false
    }
  },

  goVerify() {
    if (!ensureLogin()) return
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success(res) {
        if (res.confirm) {
          logout()
        }
      }
    })
  }
})
