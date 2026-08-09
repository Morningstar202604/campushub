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
    category: 'daily',
    isAnonymous: false,
    submitting: false,
    categories: [
      { value: 'daily', label: '日常', emoji: '☀️' },
      { value: 'study', label: '学习', emoji: '📚' },
      { value: 'life', label: '生活', emoji: '🌿' },
      { value: 'rant', label: '吐槽', emoji: '😤' },
      { value: 'help', label: '求助', emoji: '🆘' },
      { value: 'share', label: '分享', emoji: '✨' }
    ]
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

  onCategoryChange(e) {
    this.setData({ category: e.currentTarget.dataset.value })
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

  async submit() {
    const { title, content, images, tags, category, isAnonymous } = this.data
    
    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!content.trim() && images.length === 0) {
      wx.showToast({ title: '请输入内容或上传图片', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    wx.showLoading({ title: '发布中...' })
    
    try {
      // 上传图片
      let uploadedImages = []
      if (images.length > 0) {
        uploadedImages = await uploadImages(images, 'posts')
      }
      
      // 调用云函数
      const res = await callFunction('post-create', {
        title,
        content,
        images: uploadedImages,
        tags,
        category,
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
