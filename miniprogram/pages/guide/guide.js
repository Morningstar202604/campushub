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
      console.error('加载指南失败', err)
      this.setData({ loading: false })
    }
  },

  onCategoryChange(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id })
    this.loadGuides(id)
  },

  onGuideTap(e) {
    wx.navigateTo({
      url: `/pages/guide-detail/guide-detail?id=${e.currentTarget.dataset.id}`
    })
  }
})
