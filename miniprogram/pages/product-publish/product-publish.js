// pages/product-publish/product-publish.js
const app = getApp()
const { callFunction, uploadImages } = require('../../utils/request.js')

Page({
  data: {
    title: '',
    description: '',
    images: [],
    price: '',
    originalPrice: '',
    category: 'digital',
    condition: 'good',
    tradeType: 'face',
    location: '',
    contactInfo: '',
    submitting: false,
    categories: [
      { value: 'digital', label: '数码电子' },
      { value: 'book', label: '书籍教材' },
      { value: 'daily', label: '生活用品' },
      { value: 'clothing', label: '服饰鞋包' },
      { value: 'cosmetic', label: '美妆护肤' },
      { value: 'food', label: '食品零食' },
      { value: 'other', label: '其他' }
    ],
    conditions: [
      { value: 'new', label: '全新' },
      { value: 'almost_new', label: '几乎全新' },
      { value: 'good', label: '8成新' },
      { value: 'fair', label: '5成新' }
    ],
    tradeTypes: [
      { value: 'face', label: '当面交易' },
      { value: 'mail', label: '邮寄' },
      { value: 'both', label: '都可' }
    ]
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onDescInput(e) { this.setData({ description: e.detail.value }) },
  onPriceInput(e) { this.setData({ price: e.detail.value }) },
  onOriginalPriceInput(e) { this.setData({ originalPrice: e.detail.value }) },
  onLocationInput(e) { this.setData({ location: e.detail.value }) },
  onContactInput(e) { this.setData({ contactInfo: e.detail.value }) },

  async chooseImage() {
    const remaining = 9 - this.data.images.length
    if (remaining <= 0) return
    try {
      const res = await wx.chooseMedia({
        count: remaining,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      })
      const newPaths = res.tempFiles.map(f => f.tempFilePath)
      this.setData({ images: [...this.data.images, ...newPaths] })
    } catch (err) {}
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = [...this.data.images]
    images.splice(idx, 1)
    this.setData({ images })
  },

  onCategoryChange(e) { this.setData({ category: e.currentTarget.dataset.value }) },
  onConditionChange(e) { this.setData({ condition: e.currentTarget.dataset.value }) },
  onTradeTypeChange(e) { this.setData({ tradeType: e.currentTarget.dataset.value }) },

  async submit() {
    const { title, description, images, price, originalPrice, category, condition, tradeType, location, contactInfo } = this.data
    
    if (!title.trim()) { wx.showToast({ title: '请输入标题', icon: 'none' }); return }
    if (images.length === 0) { wx.showToast({ title: '请至少上传一张图片', icon: 'none' }); return }
    if (!price || isNaN(Number(price)) || Number(price) < 0) { wx.showToast({ title: '请输入有效价格', icon: 'none' }); return }
    
    this.setData({ submitting: true })
    wx.showLoading({ title: '发布中...' })
    
    try {
      const uploadedImages = await uploadImages(images, 'products')
      
      const res = await callFunction('product-create', {
        title, description, images: uploadedImages,
        price: Number(price),
        originalPrice: originalPrice ? Number(originalPrice) : null,
        category, condition, tradeType, location, contactInfo
      })
      
      wx.hideLoading()
      
      if (res.success) {
        app.globalData.needRefresh = true
        wx.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: res.message || '发布失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '发布失败', icon: 'none' })
    }
    
    this.setData({ submitting: false })
  }
})
