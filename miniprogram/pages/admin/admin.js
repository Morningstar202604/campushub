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
    banLoading: false,
    pinTarget: '',
    pinLoading: false,
    verifyList: [],
    verifyPage: 1,
    verifyHasMore: true,
    verifyLoading: false,
    verifyTotal: 0,
    activeTab: 'reports'
  },

  onLoad() {
    this.loadReports(true)
  },

  onPullDownRefresh() {
    this.loadReports(true).then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.activeTab === 'reports') this.loadReports(false)
    if (this.data.activeTab === 'verify') this.loadVerifies(false)
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'verify' && !this.data.verifyList.length && !this.data.verifyLoading) {
      this.loadVerifies(true)
    }
    this.setData({ activeTab: key })
  },

  async loadReports(reset) {
    if (this.data.loading && !reset) return // 下拉刷新放行，不被在途请求吞掉
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
        try {
          const res = await callFunction('admin', { action: 'delete', targetType: type, targetId: id })
          if (res.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            const reports = this.data.reports.filter(r => !(r.targetType === type && r.targetId === id))
            this.setData({ reports, total: Math.max(0, this.data.total - 1) })
          } else {
            wx.showToast({ title: res.message || '删除失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        } finally {
          wx.hideLoading()
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
        try {
          const res = await callFunction('admin', { action: 'ban', targetUserId: ownerid })
          wx.showToast({ title: res.success ? '已封禁' : (res.message || '失败'), icon: res.success ? 'success' : 'none' })
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  async onResolve(e) {
    const { reportid } = e.currentTarget.dataset
    wx.showModal({
      title: '标记为已处理',
      content: '确认将该举报标记为已处理？',
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '处理中' })
        try {
          const res = await callFunction('admin', { action: 'resolve', reportId: reportid })
          if (res.success) {
            const reports = this.data.reports.filter(r => r.reportId !== reportid)
            this.setData({ reports, total: Math.max(0, this.data.total - 1) })
            wx.showToast({ title: '已标记处理', icon: 'success' })
          } else {
            wx.showToast({ title: res.message || '失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  onBanInput(e) {
    this.setData({ banTarget: e.detail.value })
  },

  async doBan() {
    const t = (this.data.banTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入用户ID', icon: 'none' })
    // 手输 ID 封禁属高危操作：与列表内封禁一致，先二次确认
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认封禁',
        content: `将封禁用户 ${t}，确定执行？`,
        confirmColor: '#e64340',
        success: r => resolve(r.confirm),
        fail: () => resolve(false)
      })
    })
    if (!confirm) return
    this.setData({ banLoading: true })
    try {
      const res = await this.banCall('ban', t)
      if (res.success) {
        wx.showToast({ title: '已封禁', icon: 'success' })
        this.setData({ banTarget: '' })
      } else {
        wx.showToast({ title: res.message || '失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
    this.setData({ banLoading: false })
  },

  async doUnban() {
    const t = (this.data.banTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入用户ID', icon: 'none' })
    this.setData({ banLoading: true })
    try {
      const res = await this.banCall('unban', t)
      if (res.success) {
        wx.showToast({ title: '已解封', icon: 'success' })
        this.setData({ banTarget: '' })
      } else {
        wx.showToast({ title: res.message || '失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
    this.setData({ banLoading: false })
  },

  // 按输入特征自动区分 userId(24位hex) 与 openid
  async banCall(action, text) {
    const payload = { action }
    if (/^[0-9a-fA-F]{24}$/.test(text)) payload.targetUserId = text
    else payload.targetOpenid = text
    wx.showLoading({ title: '处理中' })
    try {
      const res = await callFunction('admin', payload)
      return res
    } catch (err) {
      return { success: false, message: '操作失败' }
    } finally {
      wx.hideLoading()
    }
  },

  // ---- 置顶/加精 ----
  onPinInput(e) {
    this.setData({ pinTarget: e.detail.value })
  },

  async doPin() {
    const t = (this.data.pinTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入帖子ID', icon: 'none' })
    this.setData({ pinLoading: true })
    try {
      const res = await callFunction('admin', { action: 'pin', postId: t })
      wx.showToast({ title: res.success ? '已置顶' : (res.message || '失败'), icon: res.success ? 'success' : 'none' })
      if (res.success) this.setData({ pinTarget: '' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
    this.setData({ pinLoading: false })
  },

  async doUnpin() {
    const t = (this.data.pinTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入帖子ID', icon: 'none' })
    this.setData({ pinLoading: true })
    try {
      const res = await callFunction('admin', { action: 'unpin', postId: t })
      wx.showToast({ title: res.success ? '已取消置顶' : (res.message || '失败'), icon: res.success ? 'success' : 'none' })
      if (res.success) this.setData({ pinTarget: '' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
    this.setData({ pinLoading: false })
  },

  async doEssence() {
    const t = (this.data.pinTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入帖子ID', icon: 'none' })
    this.setData({ pinLoading: true })
    try {
      const res = await callFunction('admin', { action: 'essence', postId: t })
      wx.showToast({ title: res.success ? '已加精' : (res.message || '失败'), icon: res.success ? 'success' : 'none' })
      if (res.success) this.setData({ pinTarget: '' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
    this.setData({ pinLoading: false })
  },

  async doUnessence() {
    const t = (this.data.pinTarget || '').trim()
    if (!t) return wx.showToast({ title: '请输入帖子ID', icon: 'none' })
    this.setData({ pinLoading: true })
    try {
      const res = await callFunction('admin', { action: 'unessence', postId: t })
      wx.showToast({ title: res.success ? '已取消加精' : (res.message || '失败'), icon: res.success ? 'success' : 'none' })
      if (res.success) this.setData({ pinTarget: '' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
    this.setData({ pinLoading: false })
  },

  // ---- 校园认证审核 ----
  loadVerifies(reset) {
    if (this.data.verifyLoading) return
    this.setData({ verifyLoading: true })
    const page = reset ? 1 : this.data.verifyPage
    callFunction('admin', { action: 'list-verifies', status: 'pending', page, pageSize: 20 })
      .then(res => {
        if (res.success) {
          this.setData({
            verifyList: reset ? res.list : [...this.data.verifyList, ...res.list],
            verifyTotal: res.total || 0,
            verifyPage: page + 1,
            verifyHasMore: (res.list || []).length === 20,
            verifyLoading: false
          })
        } else {
          this.setData({ verifyLoading: false })
        }
      })
      .catch(() => this.setData({ verifyLoading: false }))
  },

  previewVerifyImage(e) {
    wx.previewImage({ current: e.currentTarget.dataset.url, urls: [e.currentTarget.dataset.url] })
  },

  async onVerifyReview(e) {
    const { id, approve } = e.currentTarget.dataset
    if (!id) return
    let reason = ''
    if (!approve) {
      reason = await new Promise(resolve => {
        wx.showModal({
          title: '驳回原因',
          editable: true,
          placeholderText: '如：照片模糊 / 信息不一致',
          success: r => resolve(r.confirm ? (r.content || '资料不符合要求') : ''),
          fail: () => resolve('')
        })
      })
      if (!reason) return
    } else {
      const okGo = await new Promise(resolve => {
        wx.showModal({ title: '确认通过', content: '通过后该用户将获得校园认证标识', success: r => resolve(r.confirm), fail: () => resolve(false) })
      })
      if (!okGo) return
    }

    const idx = this.data.verifyList.findIndex(v => v._id === id)
    if (idx !== -1) this.setData({ ['verifyList[' + idx + ']._loading']: true })

    try {
      const res = await callFunction('admin', { action: 'verify-review', requestId: id, approve: !!approve, reason })
      if (res.success) {
        wx.showToast({ title: approve ? '已通过' : '已驳回', icon: 'success' })
        const rest = this.data.verifyList.filter(v => v._id !== id)
        this.setData({ verifyList: rest, verifyTotal: Math.max(0, this.data.verifyTotal - 1) })
      } else {
        wx.showToast({ title: res.message || '操作失败', icon: 'none' })
        if (idx !== -1) this.setData({ ['verifyList[' + idx + ']._loading']: false })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
      if (idx !== -1) this.setData({ ['verifyList[' + idx + ']._loading']: false })
    }
  },
  goCategoryAdmin() {
    wx.navigateTo({ url: '/pages/category-admin/category-admin' })
  }
})
