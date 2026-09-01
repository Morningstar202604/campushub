// pages/my-list/my-list.js
const { callFunction } = require('../../utils/request.js')
const { formatTime } = require('../../utils/auth.js')

Page({
  data: {
    type: 'posts',
    list: [],
    loading: true,
    page: 1,
    hasMore: true
  },

  onLoad(options) {
    const type = options.type || 'posts'
    const titles = { posts: '我的帖子', products: '我的商品', collects: '我的收藏' }
    wx.setNavigationBarTitle({ title: titles[type] || '我的列表' })
    this.setData({ type })
    this.loadList(true)
  },

  async loadList(reset = false) {
    if (this.data.loading && !reset) return
    this.setData({ loading: true })

    try {
      const res = await callFunction('my-list', {
        type: this.data.type,
        page: reset ? 1 : this.data.page,
        pageSize: 20
      })

      if (res.success) {
        const list = res.list.map(item => ({
          ...item,
          timeText: formatTime(item.createdAt)
        }))
        this.setData({
          list: reset ? list : [...this.data.list, ...list],
          hasMore: res.hasMore,
          page: (reset ? 1 : this.data.page) + 1,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('加载失败', err)
      this.setData({ loading: false })
    }
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList()
    }
  },

  onItemClick(e) {
    const id = e.currentTarget.dataset.id
    // 用服务端口径判类型（旧写法 dataset.price 对 0 元商品是 falsy，会路由错页面）
    const itemType = e.currentTarget.dataset.itemType
    if (itemType === 'product') {
      wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${id}` })
    } else {
      wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
    }
  },

  // 收藏 tab：取消收藏
  async onUncollect(e) {
    const id = e.currentTarget.dataset.id
    const targetType = e.currentTarget.dataset.targetType || 'post'
    try {
      const r = await callFunction('collect', { targetId: id, type: targetType, action: 'uncollect' })
      if (r.success) {
        this.setData({ list: this.data.list.filter(it => it._id !== id) })
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      } else {
        wx.showToast({ title: (r && r.message) || '操作失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 编辑帖子/商品
  onEdit(e) {
    const id = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type
    if (type === 'product') {
      wx.navigateTo({ url: `/pages/product-publish/product-publish?id=${id}` })
    } else {
      wx.navigateTo({ url: `/pages/post-publish/post-publish?id=${id}` })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, list: [], hasMore: true })
    this.loadList(true)
  },

  // 删除我的帖子/商品（"我的"列表直接管理）
  onDelete(e) {
    const id = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type // 'product' | 'post'
    if (!id || type === 'collects') return
    wx.showModal({
      title: type === 'product' ? '下架商品' : '删除帖子',
      content: '删除后不可恢复，确定吗？',
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const fn = type === 'product' ? 'product-delete' : 'post-delete'
          const arg = type === 'product' ? { productId: id } : { postId: id }
          const r = await callFunction(fn, arg)
          if (r.success) {
            this.setData({ list: this.data.list.filter(it => it._id !== id) })
            wx.showToast({ title: '已删除', icon: 'success' })
          } else {
            wx.showToast({ title: (r && r.message) || '删除失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },
  onShareAppMessage() {
    return { title: '我的列表 · CampusHub', path: '/pages/my-list/my-list' }
  }
})
