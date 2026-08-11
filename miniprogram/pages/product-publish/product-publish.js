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
    isBargain: false,
    submitting: false,
    isEdit: false,
    editId: '',
    draftKey: 'product_draft',
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

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      wx.setNavigationBarTitle({ title: '编辑商品' })
      this.loadProduct(options.id)
    } else {
      this.restoreDraft()
    }
  },

  onUnload() {
    if (!this.data.isEdit && (this.data.title || this.data.images.length)) {
      this.saveDraft()
    }
  },

  saveDraft() {
    const { title, description, price, category, condition, tradeType, location, contactInfo } = this.data
    wx.setStorageSync(this.data.draftKey, { title, description, price, category, condition, tradeType, location, contactInfo, savedAt: Date.now() })
  },

  restoreDraft() {
    const draft = wx.getStorageSync(this.data.draftKey)
    if (draft && draft.savedAt) {
      this.setData(draft)
    }
  },

  clearDraft() {
    wx.removeStorageSync(this.data.draftKey)
  },

  async loadProduct(productId) {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await callFunction('product-detail', { productId })
      wx.hideLoading()
      if (res.success && res.product) {
        const p = res.product
        this.setData({
          title: p.title || '',
          description: p.description || '',
          images: p.images || [],
          price: String(p.price || ''),
          originalPrice: p.originalPrice ? String(p.originalPrice) : '',
          category: p.category || 'digital',
          condition: p.condition || 'good',
          tradeType: p.tradeType || 'face',
          location: p.location || '',
          contactInfo: p.contactInfo || ''
        })
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onDescInput(e) { this.setData({ description: e.detail.value }) },
  onPriceInput(e) { this.setData({ price: e.detail.value }) },
  onOriginalPriceInput(e) { this.setData({ originalPrice: e.detail.value }) },
  onLocationInput(e) { this.setData({ location: e.detail.value }) },
  onContactInput(e) { this.setData({ contactInfo: e.detail.value }) },
  onBargainChange(e) { this.setData({ isBargain: e.detail.value }) },

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
      const oversized = res.tempFiles.filter(f => f.size > 9 * 1024 * 1024)
      if (oversized.length) {
        wx.showToast({ title: '单张图片不能超过9MB', icon: 'none' })
        return
      }
      const newPaths = res.tempFiles.map(f => f.tempFilePath)
      this.setData({ images: [...this.data.images, ...newPaths] })
    } catch (err) {}
  },

  previewImage(e) {
    const idx = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.images[idx],
      urls: this.data.images
    })
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
    const { title, description, images, price, originalPrice, category, condition, tradeType, location, contactInfo, isEdit, editId } = this.data

    if (!title.trim()) { wx.showToast({ title: '请输入标题', icon: 'none' }); return }
    if (images.length === 0) { wx.showToast({ title: '请至少上传一张图片', icon: 'none' }); return }
    if (!price || isNaN(Number(price)) || Number(price) < 0) { wx.showToast({ title: '请输入有效价格', icon: 'none' }); return }

    this.setData({ submitting: true })
    wx.showLoading({ title: isEdit ? '保存中...' : '发布中...' })

    try {
      // 分离已上传和本地图片
      const existingImages = images.filter(img => typeof img === 'string' && img.startsWith('cloud://'))
      const localImages = images.filter(img => typeof img === 'string' && !img.startsWith('cloud://'))
      let uploadedImages = existingImages
      if (localImages.length > 0) {
        const newUploaded = await uploadImages(localImages, 'products')
        uploadedImages = [...existingImages, ...newUploaded]
      }

      if (isEdit) {
        const res = await callFunction('product-update', {
          productId: editId,
          title, description, images: uploadedImages,
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : null,
          category, condition, tradeType, location, contactInfo
        })
        wx.hideLoading()
        if (res.success) {
          app.globalData.needRefresh = true
          wx.showToast({ title: '修改成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          wx.showToast({ title: res.message || '修改失败', icon: 'none' })
        }
      } else {
        const res = await callFunction('product-create', {
          title, description, images: uploadedImages,
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : null,
          category, condition, tradeType, location, contactInfo
        })
        wx.hideLoading()
        if (res.success) {
          this.clearDraft()
          app.globalData.needRefresh = true
          wx.showToast({ title: '发布成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          wx.showToast({ title: res.message || '发布失败', icon: 'none' })
        }
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }

    this.setData({ submitting: false })
  }
})
