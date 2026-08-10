// pages/post-publish/post-publish.js
const app = getApp()
const { callFunction, uploadImages } = require('../../utils/request.js')

Page({
  data: {
    title: '',
    content: '',
    images: [],
    tags: [],
    tagInput: '',
    isAnonymous: false,
    submitting: false,
    // 多级分类
    categoryId: '',
    categoryPath: [],
    categoryName: '',
    showCatPicker: false,
    // 类型：普通帖 / 任务帖（任务帖带过期时间）
    kind: 'post',
    expireDays: 7,
    expireOptions: [3, 7, 15, 30]
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

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
    } catch (err) {
      console.log('用户取消选择')
    }
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = [...this.data.images]
    images.splice(idx, 1)
    this.setData({ images })
  },

  onTagInput(e) {
    this.setData({ tagInput: e.detail.value })
  },

  addTag(e) {
    const tag = this.data.tagInput.trim()
    if (!tag) return
    if (this.data.tags.includes(tag)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    if (this.data.tags.length >= 5) {
      wx.showToast({ title: '最多5个标签', icon: 'none' })
      return
    }
    this.setData({
      tags: [...this.data.tags, tag],
      tagInput: ''
    })
  },

  removeTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = this.data.tags.filter(t => t !== tag)
    this.setData({ tags })
  },

  onAnonymousChange(e) {
    this.setData({ isAnonymous: e.detail.value })
  },

  // 打开多级分类选择器
  onCategoryTap() {
    this.setData({ showCatPicker: true })
  },
  onCatSelect(e) {
    const { categoryId, categoryPath, categoryName } = e.detail
    this.setData({ categoryId, categoryPath, categoryName, showCatPicker: false })
  },
  onCatClose() {
    this.setData({ showCatPicker: false })
  },

  // 类型切换
  onKindChange(e) {
    this.setData({ kind: e.currentTarget.dataset.kind })
  },
  onExpireChange(e) {
    this.setData({ expireDays: Number(e.currentTarget.dataset.days) })
  },

  async submit() {
    const {
      title, content, images, tags, categoryId, categoryPath, kind, expireDays, isAnonymous
    } = this.data

    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim() && images.length === 0) {
      wx.showToast({ title: '请输入内容或上传图片', icon: 'none' })
      return
    }
    if (!categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '发布中...' })

    try {
      let uploadedImages = []
      if (images.length > 0) {
        uploadedImages = await uploadImages(images, 'posts')
      }

      const res = await callFunction('post-create', {
        title,
        content,
        images: uploadedImages,
        tags,
        categoryId,
        categoryPath,
        kind,
        expireDays,
        isAnonymous
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
      console.error('发布失败', err)
      wx.showToast({ title: '发布失败', icon: 'none' })
    }

    this.setData({ submitting: false })
  }
})
