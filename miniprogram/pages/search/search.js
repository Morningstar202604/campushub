// pages/search/search.js
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    keyword: '',
    searched: false,
    activeResult: 'posts',
    posts: [],
    products: [],
    guides: [],
    history: [],
    hotSearch: ['二手教材', '考研', '校园网', '宿舍', '食堂', '选修课']
  },

  onLoad() {
    const history = wx.getStorageSync('searchHistory') || []
    this.setData({ history })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  clearInput() {
    this.setData({ keyword: '', searched: false })
  },

  async onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) return
    
    // 保存历史
    let history = wx.getStorageSync('searchHistory') || []
    history = [keyword, ...history.filter(h => h !== keyword)].slice(0, 10)
    wx.setStorageSync('searchHistory', history)
    this.setData({ history, searched: true })
    
    wx.showLoading({ title: '搜索中...' })
    
    try {
      const res = await callFunction('search', { keyword })
      if (res.success) {
        this.setData({
          posts: res.posts,
          products: res.products,
          guides: res.guides
        })
      }
    } catch (err) {
      console.error('搜索失败', err)
    }
    
    wx.hideLoading()
  },

  onResultTab(e) {
    this.setData({ activeResult: e.currentTarget.dataset.key })
  },

  onHistoryTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.key })
    this.onSearch()
  },

  clearHistory() {
    wx.removeStorageSync('searchHistory')
    this.setData({ history: [] })
  },

  goPostDetail(e) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
  },

  goProductDetail(e) {
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${e.currentTarget.dataset.id}` })
  },

  goGuideDetail(e) {
    wx.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${e.currentTarget.dataset.id}` })
  }
})
