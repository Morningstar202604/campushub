// pages/guide/guide.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    categories: [],
    guides: [],
    activeCategory: '',
    loading: true
  },

  onLoad() {
    this.loadGuides()
  },

  onPullDownRefresh() {
    this.loadGuides(this.data.activeCategory).finally(() => wx.stopPullDownRefresh())
  },

  async loadGuides(categoryId = '') {
    this.setData({ loading: true })
    try {
      const res = await callFunction('guide-list', {
        schoolId: app.globalData.userInfo ? app.globalData.userInfo.schoolId || undefined : undefined,
        categoryId: categoryId || undefined
      })
      if (res.success) {
        this.setData({
          categories: res.categories,
          guides: res.guides,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      this.setData({ loadFail: true })
      console.error('加载指南失败', err)
      this.setData({ loading: false })
    }
  },

  onImgError(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ [`guides[${idx}]._coverFail`]: true })
  },
  reloadGuides() {
    this.setData({ loadFail: false })
    this.loadGuides(this.data.activeCategory)
  },
  onCategoryChange(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id, guides: [], loading: true })
    this.loadGuides(id)
  },

  onGuideTap(e) {
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?id=${e.currentTarget.dataset.id}`
    })
  },
  onShareAppMessage() {
    return { title: '校园指南 · 新生必备攻略', path: '/pages/guide/guide' }
  }
})
