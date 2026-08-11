// pages/notifications/notifications.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { formatTime } = require('../../utils/auth.js')

Page({
  data: {
    list: [],
    loading: true,
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.loadList(true)
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadList(false)
  },

  async loadList(reset) {
    if (this.data.loading && !reset) return
    if (!reset && !this.data.hasMore) return
    this.setData({ loading: true })
    try {
      const page = reset ? 1 : this.data.page
      const res = await callFunction('notification', { action: 'list', page, pageSize: 20 })
      if (res.success) {
        const list = (res.list || []).map(n => ({ ...n, timeText: formatTime(n.createdAt) }))
        this.setData({
          list: reset ? list : [...this.data.list, ...list],
          page: page + 1,
          hasMore: res.hasMore,
          loading: false
        })
        // 首次加载后标记全部已读
        if (reset && res.unreadCount > 0) {
          await callFunction('notification', { action: 'markAllRead' })
        }
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.targetId) return
    // 根据通知类型跳转
    if (item.type === 'follow') {
      wx.navigateTo({ url: `/pages/user-profile/user-profile?id=${item.targetId}` })
    } else {
      // like/comment → 帖子或商品详情（需要判断类型，这里简化为帖子详情）
      wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${item.targetId}` })
    }
  }
})
