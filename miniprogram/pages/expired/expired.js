// pages/expired/expired.js
// 过期任务归档：超时未解决的任务帖(status='expired')在此集中查看，不再推上主页
const { callFunction } = require('../../utils/request.js')
const { formatTime } = require('../../utils/auth.js')

Page({
  data: {
    list: [],
    loading: false,
    page: 1,
    hasMore: true
  },

  onLoad() {
    this.loadList(true)
  },

  async loadList(reset = false) {
    // reset（首次/下拉）允许打断在途请求；仅翻页受 loading 守卫
    if (this.data.loading && !reset) return
    this.setData({ loading: true })
    try {
      const res = await callFunction('post-list', {
        tab: 'latest',
        status: 'expired',
        page: reset ? 1 : this.data.page,
        pageSize: 20
      })
      if (res.success) {
        const items = (res.list || []).map(item => ({
          ...item,
          timeText: formatTime(item.createdAt)
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
      console.error('加载过期列表失败', err)
      this.setData({ loading: false })
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadList()
  },

  onItemTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` })
  },
  onShareAppMessage() {
    return { title: '过期任务归档', path: '/pages/expired/expired' }
  }
})
