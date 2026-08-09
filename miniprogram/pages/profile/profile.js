// pages/profile/profile.js
const app = getApp()
const { logout, ensureLogin } = require('../../utils/auth.js')

Page({
  data: {
    user: null
  },

  onShow() {
    if (app.globalData.isLoggedIn) {
      this.setData({ user: app.globalData.userInfo })
    } else {
      this.setData({ user: null })
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
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
      title: '关于韩师校园通',
      content: '韩师校园通是面向韩山师范学院师生的校园信息平台，提供校园贴吧、二手交易、校园指南等功能。\n\n平台仅提供信息展示，不参与交易担保。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
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
