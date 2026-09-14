// pages/product-detail/product-detail.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { formatTime, getUserId, firstChar } = require('../../utils/auth.js')

Page({
  data: {
    product: null,
    isCollected: false,
    canDelete: false,
    canEdit: false,
    isSold: false,
    loading: true,
    formatCreateTime: '',
    conditionText: '',
    tradeTypeText: ''
  },

  onLoad(options) {
    this.productId = options.id
    if (options.id) {
      this.loadProduct(options.id)
    }
  },

  onShow() {
    // 编辑后返回刷新
    if (this.productId && app.globalData.needRefresh) {
      app.globalData.needRefresh = false
      this.loadProduct(this.productId)
    }
  },

  async loadProduct(productId) {
    try {
      const res = await callFunction('product-detail', {
        productId,
        userId: getUserId()
      })
      
      if (res.success) {
        const p = res.product
        p.userNicknameFirst = firstChar(p.userNickname)
        const conditionMap = { new: '全新', almost_new: '几乎全新', good: '8成新', fair: '5成新' }
        const tradeMap = { face: '当面交易', mail: '邮寄', both: '当面/邮寄' }
        const isOwner = !!getUserId() && getUserId() === p.userId

        this.setData({
          product: p,
          isCollected: res.isCollected,
          canDelete: isOwner,
          canEdit: isOwner,
          isSold: p.status === 'sold',
          formatCreateTime: formatTime(p.createdAt),
          conditionText: conditionMap[p.condition] || p.condition,
          tradeTypeText: tradeMap[p.tradeType] || p.tradeType,
          loading: false
        })
      } else {
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('加载商品失败', err)
      this.setData({ loading: false, loadFail: true })
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  },

  retryLoad() {
    if (this.productId) {
      this.setData({ loadFail: false })
      this.loadProduct(this.productId)
    }
  },

  previewImage(e) {
    const idx = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.product.images[idx],
      urls: this.data.product.images
    })
  },

  async onCollect() {
    if (!app.ensureLogin()) return
    if (this._collectLock) return
    this._collectLock = true
    // 乐观更新：点击立即反馈，失败回滚
    const prev = this.data.isCollected
    const next = !prev
    this.setData({ isCollected: next, 'product.collectCount': Math.max(0, (this.data.product.collectCount || 0) + (next ? 1 : -1)) })
    try {
      const res = await callFunction('collect', {
        targetId: this.data.product._id,
        type: 'product',
        action: prev ? 'uncollect' : 'collect'
      })
      if (res.success) {
        this.setData({ isCollected: res.collected })
        wx.showToast({ title: res.collected ? '已收藏' : '已取消', icon: 'none' })
      } else {
        this.setData({ isCollected: prev, 'product.collectCount': this.data.product.collectCount })
        wx.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      this.setData({ isCollected: prev, 'product.collectCount': this.data.product.collectCount })
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      this._collectLock = false
    }
  },

  goSellerProfile() {
    const { product } = this.data
    if (!product || !product.userId) return
    if (product.isAnonymous) return
    wx.navigateTo({ url: `/pages/user-profile/user-profile?userId=${product.userId}` })
  },

  onContact() {
    const { product, isSold } = this.data
    if (isSold) {
      wx.showToast({ title: '该商品已售出', icon: 'none' })
      return
    }
    if (product.contactInfo) {
      wx.showModal({
        title: '联系方式',
        content: product.contactInfo,
        confirmText: '复制',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: product.contactInfo,
              success: () => wx.showToast({ title: '已复制', icon: 'success' })
            })
          }
        }
      })
    } else {
      wx.showModal({
        title: '暂无联系方式',
        content: '卖家未留下联系方式，可以到 ta 的主页看看其他商品',
        confirmText: '看主页',
        cancelText: '知道了',
        success: (r) => {
          if (r.confirm) {
            wx.navigateTo({ url: `/pages/user-profile/user-profile?userId=${product.userId}` })
          }
        }
      })
    }
  },

  // 编辑商品（仅作者）
  onEdit() {
    if (!this.data.canEdit) return
    wx.navigateTo({
      url: `/pages/product-publish/product-publish?id=${this.data.product._id}`
    })
  },

  // 标记已售 / 重新上架
  onMarkSold() {
    if (!this.data.canEdit) return
    const newSold = !this.data.isSold
    wx.showModal({
      title: newSold ? '标记为已售' : '重新上架',
      content: newSold ? '标记后商品不再展示在在售列表' : '商品将重新展示在在售列表',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await callFunction('product-update', {
            productId: this.data.product._id,
            markSold: newSold
          })
          if (r.success) {
            this.setData({ isSold: newSold, 'product.status': r.status })
            wx.showToast({ title: newSold ? '已标记为已售' : '已重新上架', icon: 'success' })
          } else {
            wx.showToast({ title: r.message || '操作失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  onReport() {
    if (!app.ensureLogin()) return
    wx.showActionSheet({
      itemList: ['垃圾广告', '虚假信息', '违规商品', '其他'],
      success: async (res) => {
        const reasons = ['垃圾广告', '虚假信息', '违规商品', '其他']
        try {
          const result = await callFunction('report', {
            targetId: this.data.product._id,
            targetType: 'product',
            reason: reasons[res.tapIndex]
          })
          if (result.success) {
            wx.showToast({ title: '已举报', icon: 'success' })
          }
        } catch (err) {
          wx.showToast({ title: '举报失败', icon: 'none' })
        }
      }
    })
  },

  // 删除商品（仅作者）
  onDeleteProduct() {
    if (!this.data.canDelete) return
    wx.showModal({
      title: '下架商品',
      content: '下架后不可恢复，确定吗？',
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await callFunction('product-delete', { productId: this.data.product._id })
          if (r.success) {
            wx.showToast({ title: '已下架', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 800)
          } else {
            wx.showToast({ title: r.message || '操作失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    const product = this.data.product
    if (!product) return { title: 'CampusHub', path: '/pages/index/index' }
    return {
      title: product.title,
      path: `/pages/product-detail/product-detail?id=${product._id}`,
      imageUrl: product.images && product.images[0]
    }
  }
})
