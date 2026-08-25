// pages/product-publish/product-publish.js
const app = getApp()
const { callFunction, uploadImage } = require('../../utils/request.js')

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
    // 已发布成功则不再"复活"草稿
    if (!this.data.isEdit && !this._published &&
        (this.data.title || this.data.images.length)) {
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
      // 白名单式恢复，避免草稿对象里的元字段（savedAt 等）串进 data
      const { title, description, price, category, condition, tradeType, location, contactInfo } = draft
      this.setData({
        title: title || '', description: description || '', price: price || '',
        category: category || 'digital', condition: condition || 'good',
        tradeType: tradeType || 'face', location: location || '', contactInfo: contactInfo || ''
      })
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
        // 加载失败立即退出：空白表单提交会覆盖原商品
        setTimeout(() => wx.navigateBack(), 1500)
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
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
    if (this.data.submitting) return // JS 级防重入
    const { title, description, images, price, originalPrice, category, condition, tradeType, location, contactInfo, isEdit, editId } = this.data

    if (!title.trim()) { wx.showToast({ title: '请输入标题', icon: 'none' }); return }
    if (images.length === 0) { wx.showToast({ title: '请至少上传一张图片', icon: 'none' }); return }
    // 价格允许 0（免费赠送），但必须是有限数字
    const numPrice = Number(price)
    if (!Number.isFinite(numPrice) || numPrice < 0) { wx.showToast({ title: '请输入有效价格', icon: 'none' }); return }
    let numOriginal = null
    if (originalPrice !== '' && originalPrice !== undefined && originalPrice !== null) {
      numOriginal = Number(originalPrice)
      if (!Number.isFinite(numOriginal)) { wx.showToast({ title: '原价格式不正确', icon: 'none' }); return }
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: isEdit ? '保存中...' : '发布中...' })

    try {
      // 分离已上传和本地图片；逐张上传，失败保留进度防孤儿文件
      const existingImages = images.filter(img => typeof img === 'string' && img.startsWith('cloud://'))
      const localImages = images.filter(img => typeof img === 'string' && !img.startsWith('cloud://'))
      const uploadedImages = [...existingImages]
      for (let i = 0; i < localImages.length; i++) {
        try {
          const fileID = await uploadImage(localImages[i], 'products')
          uploadedImages.push(fileID)
        } catch (e) {
          this.setData({ images: [...uploadedImages, ...localImages.slice(i)] })
          throw e
        }
      }

      if (isEdit) {
        const res = await callFunction('product-update', {
          productId: editId,
          title, description, images: uploadedImages,
          price: numPrice,
          originalPrice: numOriginal,
          category, condition, tradeType, location, contactInfo
        })
        wx.hideLoading()
        if (res.success) {
          app.globalData.needRefresh = true
          wx.showToast({ title: '修改成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
          return
        } else {
          wx.showToast({ title: res.message || '修改失败', icon: 'none' })
        }
      } else {
        const res = await callFunction('product-create', {
          title, description, images: uploadedImages,
          price: numPrice,
          originalPrice: numOriginal,
          category, condition, tradeType, location, contactInfo
        })
        wx.hideLoading()
        if (res.success) {
          this._published = true
          this.clearDraft()
          app.globalData.needRefresh = true
          wx.showToast({ title: '发布成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
          return
        } else {
          wx.showToast({ title: res.message || '发布失败', icon: 'none' })
        }
      }
    } catch (err) {
      wx.hideLoading()
      console.error('商品提交失败', err)
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    }

    // 仅失败路径复位，允许修改后重试
    this.setData({ submitting: false })
  }
})
