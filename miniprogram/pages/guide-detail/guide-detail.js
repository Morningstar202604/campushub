// pages/guide-detail/guide-detail.js
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    guide: null,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.loadGuide(options.id)
    }
  },

  async loadGuide(guideId) {
    try {
      const res = await callFunction('guide-detail', { guideId })
      if (res.success) {
        this.setData({
          guide: res.guide,
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

  onShareAppMessage() {
    const guide = this.data.guide
    if (!guide) return { title: 'CampusHub', path: '/pages/index/index' }
    return {
      title: guide.title,
      path: `/pages/guide-detail/guide-detail?id=${guide._id}`,
      imageUrl: guide.coverImage
    }
  }
})
