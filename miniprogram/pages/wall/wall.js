// pages/wall/wall.js
// 表白墙：kind=confession 的强匿名短内容流（服务端强制匿名，前端不显示任何身份信息）
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { ensureLogin, formatTime, firstChar } = require('../../utils/auth.js')
const { getCache, setCache } = require('../../utils/cache.js')

const FEED_CACHE_KEY = 'wall_feed_v1'
const FEED_CACHE_TTL = 3 * 60 * 1000

Page({
  data: {
    list: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadList(true)
  },

  onShow() {
    if (app.globalData.needRefresh) {
      app.globalData.needRefresh = false
      this.setData({ page: 1, list: [], hasMore: true })
      this.loadList(true, { force: true })
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [], hasMore: true })
    this.loadList(true, { force: true })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadList()
  },

  async loadList(reset = false, opts = {}) {
    if (this.data.loading && !reset) return
    this._seq = (this._seq || 0) + 1
    const seq = this._seq
    this.setData({ loading: true })

    const force = !!opts.force
    if (reset && !force) {
      const cachedItems = getCache(FEED_CACHE_KEY)
      if (cachedItems && cachedItems.length) {
        // 与网络路径一致的字段水合（timeText 等）
        const hydrated = cachedItems.map(it => ({ ...it, timeText: formatTime(it.createdAt) }))
        this.setData({ list: hydrated, page: 2, hasMore: cachedItems.length >= 20, loading: false })
        wx.stopPullDownRefresh()
        return
      }
    }

    try {
      const res = await callFunction('post-list', {
        tab: 'latest', kind: 'confession',
        page: reset ? 1 : this.data.page, pageSize: 20
      })
      if (seq !== this._seq) { wx.stopPullDownRefresh(); return }
      if (res.success) {
        const items = (res.list || []).map(it => ({
          ...it,
          timeText: formatTime(it.createdAt),
          nicknameFirst: firstChar('匿')
        }))
        if (reset) setCache(FEED_CACHE_KEY, res.list || [], FEED_CACHE_TTL)
        this.setData({
          list: reset ? items : [...this.data.list, ...items],
          hasMore: res.hasMore,
          page: (reset ? 1 : this.data.page) + 1,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      if (seq !== this._seq) { wx.stopPullDownRefresh(); return }
      console.error('表白墙加载失败', err)
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  goPublish() {
    if (!ensureLogin()) return
    wx.navigateTo({ url: '/pages/post-publish/post-publish?kind=confession' })
  },

  onItemClick(e) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
  }
})
