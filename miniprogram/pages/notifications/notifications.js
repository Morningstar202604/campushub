// pages/notifications/notifications.js
// 站内通知：进入页面只拉列表，不再"一进来就全部已读"；
// 点开某条才标记该条已读（跨分页的未读保持未读，badge 语义正确）。
// 路由：按 targetType 分流到帖子/商品/用户主页（旧数据无 targetType 时回退帖子详情）。
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

  onShow() {
    // 从详情页返回时刷新 badge
    this.refreshUnreadBadge()
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadList(false)
  },

  async refreshUnreadBadge() {
    try {
      const res = await callFunction('notification', { action: 'unreadCount' })
      if (res.success) {
        app.globalData.unreadCount = res.unreadCount || 0
      }
    } catch (e) { /* 静默 */ }
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
        if (reset) app.globalData.unreadCount = res.unreadCount || 0
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  async onItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return

    // 点开才标记该条已读（幂等，服务端带属主校验）
    if (!item.isRead) {
      item.isRead = true
      const idx = this.data.list.findIndex(n => n._id === item._id)
      if (idx !== -1) this.setData({ [`list[${idx}].isRead`]: true })
      try {
        await callFunction('notification', { action: 'markRead', notificationId: item._id })
        await this.refreshUnreadBadge()
      } catch (err) { /* 标记失败不影响跳转 */ }
    }

    if (!item.targetId) return
    // 按类型路由；旧数据没有 targetType 时按旧约定回退
    if (item.type === 'follow') {
      wx.navigateTo({ url: `/pages/user-profile/user-profile?id=${item.targetId}` })
    } else if (item.targetType === 'product') {
      wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${item.targetId}` })
    } else if (item.targetType === 'post' || !item.targetType) {
      wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${item.targetId}` })
    }
  }
})
