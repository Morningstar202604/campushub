// pages/admin/admin.js — 管理员审核台
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    reports: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    total: 0,
    banTarget: '',
    banLoading: false
  },

  onLoad() {
    this.loadReports(true)
  },

  onPullDownRefresh() {
    this.loadReports(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadReports(false)
  },

  async loadReports(reset) {
    if (this.data.loading) return
    if (!reset && !this.data.hasMore) return
    this.setData({ loading: true })
    try {
      const page = reset ? 1 : this.data.page
      const res = await callFunction('admin', { action: 'list-reports', page, pageSize: this.data.pageSize })
      if (res.success) {
        const incoming = res.list || []
        this.setData({
          reports: reset ? incoming : this.data.reports.concat(incoming),
          page: page + 1,
          hasMore: incoming.length >= this.data.pageSize,
          total: res.total || 0
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  async onDelete(e) {
    const { id, type } = e.currentTarget.dataset
    wx.showModal({
      title: '删除内容',
      content: '将删除该内容并回收图片，操作不可恢复',
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '处理中' })
        const res = await callFunction('admin', { action: 'delete', targetType: type, targetId: id })
        wx.hideLoading()
        if (res.success) {
          wx.showToast({ title: '已删除', icon: 'success' })
          const reports = this.data.reports.filter(r => !(r.targetType === type && r.targetId === id))
          this.setData({ reports, total: Math.max(0, this.data.total - 1) })
        } else {
          wx.showToast({ title: res.message || '删除失败', icon: 'none' })
        }
      }
    })
  },

  async onBanAuthor(e) {
    const { ownerid, nickname } = e.currentTarget.dataset
    wx.showModal({
      title: '封禁作者',
      content: `确认封禁 ${nickname || ownerid}？该用户将无法发帖/评论/发布商品。`,
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '处理中' })
        const res = await callFunction('admin', { action: 'ban', targetUserId: ownerid })
        wx.hideLoading()
        wx.showToast({ title: res.success ? '已封禁' : (res.message || '失败'), icon: res.success ? 'success' : 'none' })
      }
    })
  },

  async onResolve(e) {
    const { reportid } = e.currentTarget.dataset
    wx.showLoading({ title: '处理中' })
    const res = await callFunction('admin', { action: 'resolve', reportId: reportid })
    wx.hideLoading()
    if (res.success) {
      const reports = this.data.reports.filter(r => r.reportId !== reportid)
      this.setData({ reports, total: Math.max(0, this.data.total - 1) })
      wx.showToast({ title: '已标记处理', icon: 'success' })
    } else {
      wx.showToast({ title: res.message || '失败', icon: 'none' })
    }
  },

  onBanInput(e) {
    this.setData({ banTarget: e.detail.value })
  },

  async doBan() {
    const t = (this.data.banTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入用户ID', icon: 'none' })
    this.setData({ banLoading: true })
    const res = await this.banCall('ban', t)
    this.setData({ banLoading: false })
    if (res.success) {
      wx.showToast({ title: '已封禁', icon: 'success' })
      this.setData({ banTarget: '' })
    } else {
      wx.showToast({ title: res.message || '失败', icon: 'none' })
    }
  },

  async doUnban() {
    const t = (this.data.banTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入用户ID', icon: 'none' })
    this.setData({ banLoading: true })
    const res = await this.banCall('unban', t)
    this.setData({ banLoading: false })
    if (res.success) {
      wx.showToast({ title: '已解封', icon: 'success' })
      this.setData({ banTarget: '' })
    } else {
      wx.showToast({ title: res.message || '失败', icon: 'none' })
    }
  },

  // 按输入特征自动区分 userId(24位hex) 与 openid
  async banCall(action, text) {
    const payload = { action }
    if (/^[0-9a-fA-F]{24}$/.test(text)) payload.targetUserId = text
    else payload.targetOpenid = text
    wx.showLoading({ title: '处理中' })
    const res = await callFunction('admin', payload)
    wx.hideLoading()
    return res
  }
})
