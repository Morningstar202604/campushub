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

      // 2. 更新用户信息（昵称 trim 后提交，避免首尾空格入库）
      const updateRes = await callFunction('user-update', {
        nickname: this.data.nickname.trim(),
        college: this.data.college,
        major: this.data.major,
        grade: this.data.grade,
        tags: this.data.selectedTags
      })

      if (updateRes.success) {
        app.setUserInfo(updateRes.user)
        wx.showToast({ title: '欢迎来到 CampusHub', icon: 'success' })
        setTimeout(() => this.redirectAfterLogin(), 1500)
      } else {
        // 资料更新失败也放行登录，但要给出可见提示而非静默
        wx.showToast({ title: '资料保存失败，可稍后在"我的"页补全', icon: 'none' })
        app.setUserInfo(loginRes.user)
        setTimeout(() => this.redirectAfterLogin(), 1500)
      }
    } catch (err) {
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }

    this.setData({ loading: false })
  },

  /**
   * 登录后回跳：优先回来源页（ensureLogin 记录）；
   * 来源页是 tabBar 页用 switchTab，非 tab 页直接 navigateBack 回到它。
   */
  redirectAfterLogin() {
    const redirect = getApp().globalData.loginRedirect
    getApp().globalData.loginRedirect = ''
    const TAB_ROUTES = [
      'pages/index/index', 'pages/market/market', 'pages/guide/guide', 'pages/profile/profile'
    ]
    if (redirect && TAB_ROUTES.some(r => redirect.indexOf(r) !== -1)) {
      wx.switchTab({ url: '/' + (redirect.replace(/^\//, '')) })
    } else if (redirect) {
      // 非 tab 页来源：navigateBack 即回到发起登录的页面
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' })
  }
})
