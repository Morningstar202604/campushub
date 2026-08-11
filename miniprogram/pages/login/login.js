// pages/login/login.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    statusBarHeight: 0,
    nickname: '',
    college: '',
    major: '',
    grade: '',
    loading: false,
    agreed: false,
    selectedTags: [],
    gradeOptions: ['2020级', '2021级', '2022级', '2023级', '2024级', '2025级', '研究生'],
    tagOptions: ['学习', '考研', '摄影', '篮球', '音乐', '美食', '旅行', '游戏', '阅读', '运动', '追剧', '兼职']
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: sysInfo.statusBarHeight })
    
    // 如果已登录，直接返回
    if (app.globalData.isLoggedIn) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onCollegeInput(e) {
    this.setData({ college: e.detail.value })
  },

  onMajorInput(e) {
    this.setData({ major: e.detail.value })
  },

  onGradeChange(e) {
    this.setData({ grade: this.data.gradeOptions[e.detail.value] })
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = [...this.data.selectedTags]
    const idx = tags.indexOf(tag)
    if (idx > -1) {
      tags.splice(idx, 1)
    } else {
      tags.push(tag)
    }
    this.setData({ selectedTags: tags })
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  async onLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' })
      return
    }
    if (this.data.loading) return
    
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      // 1. 先调 login 云函数创建/获取用户
      const loginRes = await callFunction('login', {})
      
      if (!loginRes.success) {
        wx.showToast({ title: '登录失败', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      // 2. 更新用户信息
      const updateRes = await callFunction('user-update', {
        nickname: this.data.nickname,
        college: this.data.college,
        major: this.data.major,
        grade: this.data.grade,
        tags: this.data.selectedTags
      })

      if (updateRes.success) {
        app.setUserInfo(updateRes.user)
        wx.showToast({ title: '欢迎来到 CampusHub', icon: 'success' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 1500)
      } else {
        // 即使更新失败也用 login 返回的数据
        app.setUserInfo(loginRes.user)
        wx.switchTab({ url: '/pages/index/index' })
      }
    } catch (err) {
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  }
})
