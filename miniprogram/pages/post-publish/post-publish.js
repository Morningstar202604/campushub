// pages/post-publish/post-publish.js
const app = getApp()
const { callFunction, uploadImage } = require('../../utils/request.js')
const { requestSubscribe } = require('../../utils/subscribe.js')

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
    expireOptions: [3, 7, 15, 30],
    location: '',
    // 编辑模式
    isEdit: false,
    editId: '',
    // 草稿
    draftKey: 'post_draft'
  },

  onLoad(options) {
    // 支持从入口预设类型：?kind=confession / lost / found
    const PRESET_KINDS = ['lost', 'found', 'confession']
    if (options.kind && PRESET_KINDS.includes(options.kind)) {
      this.setData({ kind: options.kind })
      wx.setNavigationBarTitle({ title: options.kind === 'confession' ? '表白墙' : (options.kind === 'lost' ? '发布失物' : '发布招领') })
    }
    if (options.id) {
      // 编辑模式
      this.setData({ isEdit: true, editId: options.id })
      wx.setNavigationBarTitle({ title: '编辑帖子' })
      this.loadPost(options.id)
    } else {
      // 新建模式 — 恢复草稿
      this.restoreDraft()
    }
  },

  onUnload() {
    // 非编辑模式下自动保存草稿；已发布成功则不再"复活"草稿
    if (!this.data.isEdit && !this._published &&
        (this.data.title || this.data.content || this.data.images.length)) {
      this.saveDraft()
    }
  },

  // ---- 草稿 ----
  // 注意：images 为临时路径，重启后失效，不入草稿
  saveDraft() {
    const { title, content, tags, kind, expireDays, isAnonymous, categoryId, categoryPath, categoryName } = this.data
    wx.setStorageSync(this.data.draftKey, {
      title, content, tags, kind, expireDays, isAnonymous,
      categoryId, categoryPath, categoryName, savedAt: Date.now()
    })
  },

  restoreDraft() {
    const draft = wx.getStorageSync(this.data.draftKey)
    if (draft && draft.savedAt) {
      this.setData({
        title: draft.title || '',
        content: draft.content || '',
        tags: draft.tags || [],
        kind: draft.kind || 'post',
        expireDays: draft.expireDays || 7,
        isAnonymous: !!draft.isAnonymous,
        categoryId: draft.categoryId || '',
        categoryPath: draft.categoryPath || [],
        categoryName: draft.categoryName || ''
      })
    }
  },

  clearDraft() {
    wx.removeStorageSync(this.data.draftKey)
  },

  // ---- 编辑模式：加载已有帖子 ----
  async loadPost(postId) {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await callFunction('post-detail', { postId })
      wx.hideLoading()
      if (res.success && res.post) {
        const p = res.post
        this.setData({
          title: p.title || '',
          content: p.content || '',
          images: p.images || [],
          tags: p.tags || [],
          categoryId: p.categoryId || '',
          categoryPath: p.categoryPath || [],
          categoryName: p.category || '',
          kind: p.kind || 'post',
          isAnonymous: p.isAnonymous || false
        })
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' })
        // 加载失败立即退出：停留在一个"空白可提交"的表单会用残缺内容覆盖原帖
        setTimeout(() => wx.navigateBack(), 1500)
      }
    } catch (err) {
      wx.hideLoading()
      console.error('加载帖子失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
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
      // 用户取消选择，静默处理
    }
  },

  // 图片预览
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
    // 编辑模式下不允许切换匿名
    if (this.data.isEdit) {
      wx.showToast({ title: '编辑时不能切换匿名状态', icon: 'none' })
      return
    }
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
    // 编辑模式下不允许切换类型
    if (this.data.isEdit) {
      wx.showToast({ title: '编辑时不能切换帖子类型', icon: 'none' })
      return
    }
    this.setData({ kind: e.currentTarget.dataset.kind })
  },
  onExpireChange(e) {
    this.setData({ expireDays: Number(e.currentTarget.dataset.days) })
  },
  onLocationInput(e) {
    this.setData({ location: e.detail.value })
  },

  async submit() {
    if (this.data.submitting) return // JS 级防重入（不依赖按钮 loading 态）
    const {
      title, content, images, tags, categoryId, categoryPath, kind, expireDays, isAnonymous, location,
      isEdit, editId
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
    wx.showLoading({ title: isEdit ? '保存中...' : '发布中...' })

    try {
      // 分离已上传的 cloud:// 图片和本地待上传图片
      const existingImages = images.filter(img => typeof img === 'string' && img.startsWith('cloud://'))
      const localImages = images.filter(img => typeof img === 'string' && !img.startsWith('cloud://'))
      const uploadedImages = [...existingImages]
      // 逐张上传：中途失败时把"已成功 + 未上传"写回页面，重试不重复上传（不产生孤儿文件）
      for (let i = 0; i < localImages.length; i++) {
        try {
          const fileID = await uploadImage(localImages[i], 'posts')
          uploadedImages.push(fileID)
        } catch (e) {
          this.setData({ images: [...uploadedImages, ...localImages.slice(i)] })
          throw e
        }
      }

      if (isEdit) {
        // 编辑模式
        const res = await callFunction('post-update', {
          postId: editId,
          title,
          content,
          images: uploadedImages,
          tags,
          categoryId,
          categoryPath
        })
        wx.hideLoading()
        if (res.success) {
          app.globalData.needRefresh = true
          wx.showToast({ title: '修改成功', icon: 'success' })
          // 成功后不复位 submitting：跳转空窗期内按钮保持禁用，防重复保存
          setTimeout(() => wx.navigateBack(), 1500)
          return
        } else {
          wx.showToast({ title: res.message || '修改失败', icon: 'none' })
        }
      } else {
        // 新建模式
        const res = await callFunction('post-create', {
          title, content, images: uploadedImages, tags,
          categoryId, categoryPath, kind, expireDays, isAnonymous, location
        })
        wx.hideLoading()
        if (res.success) {
          // 标记已发布：onUnload 不再回写草稿；submitting 保持 true 防空窗期双击重发
          this._published = true
          this.clearDraft()
          app.globalData.needRefresh = true
          wx.showToast({ title: '发布成功', icon: 'success' })
          // 请求订阅「评论/回复」提醒（未配置模板时静默）
          requestSubscribe(['comment'])
          // 有 id 则跳详情页立即看效果，否则返回列表
          setTimeout(() => {
            if (res.postId) wx.redirectTo({ url: `/pages/post-detail/post-detail?id=${res.postId}` })
            else wx.navigateBack()
          }, 1000)
          return
        } else {
          wx.showToast({ title: res.message || '发布失败', icon: 'none' })
        }
      }
    } catch (err) {
      wx.hideLoading()
      console.error('操作失败', err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }

    // 只有失败路径才会走到这里复位，允许用户修改后重试
    this.setData({ submitting: false })
  }
})
