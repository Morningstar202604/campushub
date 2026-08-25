// pages/search/search.js
const { callFunction } = require('../../utils/request.js')
const { formatTime, formatNumber } = require('../../utils/auth.js')

Page({
  data: {
    keyword: '',
    searched: false,
    activeResult: 'posts',
    posts: [],
    products: [],
    guides: [],
    history: [],
    hotSearch: ['二手教材', '考研', '校园网', '宿舍', '食堂', '选修课'],
    searchError: false
  },

  onLoad() {
    const history = wx.getStorageSync('searchHistory') || []
    this.setData({ history })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  clearInput() {
    this.setData({ keyword: '', searched: false, searchError: false })
    this._lastKeyword = ''
  },

  async onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) return

    // 相同关键词且已有结果：直接复用，不重复请求（搜索是正则全表扫，成本高）
    if (this._lastKeyword === keyword && this.data.searched && !this.data.searchError) return

    // 客户端限频（降本 C7）：2 秒内只放行一次真实搜索
    const now = Date.now()
    if (this._lastSearchAt && now - this._lastSearchAt < 2000) {
      wx.showToast({ title: '搜索太频繁啦，休息一下', icon: 'none' })
      return
    }
    this._lastSearchAt = now
    this._lastKeyword = keyword
    // 竞态防护：慢请求晚到不覆盖新关键词的结果
    this._seq = (this._seq || 0) + 1
    const seq = this._seq

    // 保存历史
    let history = wx.getStorageSync('searchHistory') || []
    history = [keyword, ...history.filter(h => h !== keyword)].slice(0, 10)
    wx.setStorageSync('searchHistory', history)
    this.setData({ history, searched: true, searchError: false })

    wx.showLoading({ title: '搜索中...' })

    try {
      const res = await callFunction('search', { keyword })
      if (seq !== this._seq) { wx.hideLoading(); return } // 旧请求晚到，丢弃
      wx.hideLoading()
      if (res.success) {
        // 为每个结果添加高亮分段 + 时间格式化
        const posts = (res.posts || []).map(p => ({
          ...p,
          segments: this.highlightSegments(p.title, keyword),
          timeText: formatTime(p.createdAt),
          likeCountText: formatNumber(p.likeCount || 0)
        }))
        const products = (res.products || []).map(p => ({
          ...p,
          segments: this.highlightSegments(p.title, keyword),
          timeText: formatTime(p.createdAt)
        }))
        const guides = (res.guides || []).map(g => ({
          ...g,
          segments: this.highlightSegments(g.title, keyword)
        }))

        this.setData({ posts, products, guides })
      } else {
        this.setData({ searchError: true })
      }
    } catch (err) {
      console.error('搜索失败', err)
      wx.hideLoading()
      this.setData({ searchError: true })
    }
  },

  // 将文本按关键词分段，返回 [{text, highlight}] 数组用于高亮渲染
  highlightSegments(text, keyword) {
    if (!text || !keyword) return [{ text: text || '', highlight: false }]
    const safeKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const reg = new RegExp(safeKw, 'gi')
    const segments = []
    let lastIndex = 0
    let match
    while ((match = reg.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.substring(lastIndex, match.index), highlight: false })
      }
      segments.push({ text: match[0], highlight: true })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex), highlight: false })
    }
    return segments
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
  },

  // 点击搜索建议词
  onHotSearch(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.onSearch()
  }
})
