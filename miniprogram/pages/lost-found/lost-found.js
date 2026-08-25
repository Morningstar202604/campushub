// pages/lost-found/lost-found.js
// 失物招领：kind=lost(我丢了)/found(我捡到)，复用帖子体系；resolved=已找回/已归还
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { ensureLogin, formatTime, firstChar } = require('../../utils/auth.js')

Page({
  data: {
    chips: [
      { key: 'all', name: '全部' },
      { key: 'lost', name: '🔍 我丢了' },
      { key: 'found', name: '🎁 我捡到' }
    ],
    activeKind: 'all',
    list: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad(options) {
    if (options.kind === 'lost' || options.kind === 'found') {
      this.setData({ activeKind: options.kind })
    }
    this.loadList(true)
  },

  onShow() {
    if (app.globalData.needRefresh) {
      app.globalData.needRefresh = false
      this.setData({ page: 1, list: [], hasMore: true })
      this.loadList(true)
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [], hasMore: true })
    this.loadList(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadList()
  },

  onChipTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeKind) return
    this.setData({ activeKind: key, page: 1, list: [], hasMore: true })
    this.loadList(true)
  },

  async loadList(reset = false) {
    if (this.data.loading && !reset) return
    this._seq = (this._seq || 0) + 1
    const seq = this._seq
    this.setData({ loading: true })

    try {
      const params = {
        tab: 'latest',
        page: reset ? 1 : this.data.page,
        pageSize: 20
      }
      if (this.data.activeKind !== 'all') params.kind = this.data.activeKind

      const res = await callFunction('post-list', params)
      if (seq !== this._seq) { wx.stopPullDownRefresh(); return }

      if (res.success) {
        const items = (res.list || []).map(it => ({
          ...it,
          timeText: formatTime(it.createdAt),
          nicknameFirst: firstChar(it.userNickname),
          images: it.images || []
        }))
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
      console.error('失物招领加载失败', err)
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  goPublish(e) {
    if (!ensureLogin()) return
    const kind = e.currentTarget.dataset.kind || 'lost'
    wx.navigateTo({ url: `/pages/post-publish/post-publish?kind=${kind}` })
  },

  onItemClick(e) {
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}` })
  }
})
