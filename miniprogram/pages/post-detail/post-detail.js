// pages/post-detail/post-detail.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { formatTime, getUserId } = require('../../utils/auth.js')

Page({
  data: {
    post: null,
    comments: [],
    isLiked: false,
    isCollected: false,
    canDelete: false,
    currentUserId: '',
    commentText: '',
    replyTo: '',
    replyToUserId: '',
    loading: true,
    formatCreateTime: '',
    categoryText: ''
  },

  onLoad(options) {
    if (options.id) {
      this.loadPost(options.id)
      this.loadComments(options.id)
    }
  },

  async loadPost(postId) {
    try {
      const res = await callFunction('post-detail', {
        postId,
        userId: getUserId()
      })
      
      if (res.success) {
        const post = res.post
        const categoryMap = {
          daily: '日常', study: '学习', life: '生活',
          rant: '吐槽', help: '求助', share: '分享'
        }
        
        this.setData({
          post,
          isLiked: res.isLiked,
          isCollected: res.isCollected,
          canDelete: !!getUserId() && getUserId() === post.userId,
          currentUserId: getUserId() || '',
          formatCreateTime: formatTime(post.createdAt),
          categoryText: categoryMap[post.category] || post.category,
          loading: false
        })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载帖子失败', err)
      this.setData({ loading: false })
    }
  },

  async loadComments(targetId) {
    try {
      const res = await callFunction('comment-list', { targetId })
      if (res.success) {
        const comments = res.list.map(c => ({
          ...c,
          timeText: formatTime(c.createdAt)
        }))
        this.setData({ comments })
      }
    } catch (err) {
      console.error('加载评论失败', err)
    }
  },

  previewImage(e) {
    const idx = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.post.images[idx],
      urls: this.data.post.images
    })
  },

  async onLike() {
    if (!app.ensureLogin()) return
    
    try {
      const res = await callFunction('like', {
        targetId: this.data.post._id,
        type: 'post',
        action: this.data.isLiked ? 'unlike' : 'like'
      })
      
      if (res.success) {
        this.setData({
          isLiked: res.liked,
          'post.likeCount': this.data.post.likeCount + (res.liked ? 1 : -1)
        })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async onCollect() {
    if (!app.ensureLogin()) return
    
    try {
      const res = await callFunction('collect', {
        targetId: this.data.post._id,
        type: 'post',
        action: this.data.isCollected ? 'uncollect' : 'collect'
      })
      
      if (res.success) {
        this.setData({
          isCollected: res.collected,
          'post.collectCount': this.data.post.collectCount + (res.collected ? 1 : -1)
        })
        wx.showToast({
          title: res.collected ? '已收藏' : '已取消',
          icon: 'none'
        })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true })
  },

  onShareAppMessage() {
    return {
      title: this.data.post.title,
      path: `/pages/post-detail/post-detail?id=${this.data.post._id}`
    }
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  // 删除帖子（仅作者）
  onDeletePost() {
    if (!this.data.canDelete) return
    wx.showModal({
      title: '删除帖子',
      content: '删除后不可恢复，确定吗？',
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await callFunction('post-delete', { postId: this.data.post._id })
          if (r.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 800)
          } else {
            wx.showToast({ title: r.message || '删除失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // 删除自己的评论
  async onDeleteComment(e) {
    const commentId = e.currentTarget.dataset.id
    try {
      const r = await callFunction('comment-delete', { commentId })
      if (r.success) {
        this.setData({
          comments: this.data.comments.filter(c => c._id !== commentId),
          'post.commentCount': Math.max(0, (this.data.post.commentCount || 1) - 1)
        })
        wx.showToast({ title: '已删除', icon: 'none' })
      } else {
        wx.showToast({ title: r.message || '删除失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  onReply(e) {
    const { userid, nickname } = e.currentTarget.dataset
    this.setData({
      replyTo: nickname,
      replyToUserId: userid
    })
  },

  async sendComment() {
    if (!app.ensureLogin()) return
    
    const { commentText, post, replyTo, replyToUserId } = this.data
    
    if (!commentText.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    
    try {
      const res = await callFunction('comment-create', {
        targetId: post._id,
        targetType: 'post',
        content: commentText,
        replyToUserId: replyToUserId,
        replyToNickname: replyTo
      })
      
      if (res.success) {
        const newComment = {
          ...res.comment,
          timeText: '刚刚'
        }
        this.setData({
          comments: [...this.data.comments, newComment],
          commentText: '',
          replyTo: '',
          replyToUserId: '',
          'post.commentCount': (post.commentCount || 0) + 1
        })
        wx.showToast({ title: '评论成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.message || '评论失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '评论失败', icon: 'none' })
    }
  },

  scrollToComment() {
    wx.createSelectorQuery()
      .select('#comment-section')
      .boundingClientRect()
      .selectViewport()
      .scrollOffset()
      .exec(res => {
        if (res[0] && res[1]) {
          wx.pageScrollTo({
            scrollTop: res[0].top + res[1].scrollTop - 100,
            duration: 300
          })
        }
      })
  }
})
