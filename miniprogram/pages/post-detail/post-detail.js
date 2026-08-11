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
    canEdit: false,
    isFollowing: false,
    currentUserId: '',
    commentText: '',
    replyTo: '',
    replyToUserId: '',
    replyToCommentId: '', // 楼中楼回复的父评论 id
    loading: true,
    formatCreateTime: '',
    categoryText: '',
    isTask: false,
    isResolved: false,
    isExpired: false,
    canResolve: false,
    // 展开的楼中楼
    expandedReplies: {}
  },

  onLoad(options) {
    this.postId = options.id
    if (options.id) {
      this.loadPost(options.id)
      this.loadComments(options.id)
    }
  },

  onShow() {
    if (this.postId && app.globalData.needRefresh) {
      app.globalData.needRefresh = false
      this.loadPost(this.postId)
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
        const isTask = post.kind === 'task'
        const isResolved = !!post.resolved
        const isExpired = post.status === 'expired'
        const isAuthor = !!getUserId() && getUserId() === post.userId

        this.setData({
          post,
          isLiked: res.isLiked,
          isCollected: res.isCollected,
          canDelete: isAuthor,
          canEdit: isAuthor && !isExpired,
          currentUserId: getUserId() || '',
          formatCreateTime: formatTime(post.createdAt),
          categoryText: post.category || '',
          isTask,
          isResolved,
          isExpired,
          canResolve: isAuthor && isTask && !isResolved && !isExpired,
          loading: false
        })

        // 检查关注状态（非作者时）
        if (!isAuthor && app.globalData.isLoggedIn) {
          this.checkFollowing(post.userId)
        }
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载帖子失败', err)
      this.setData({ loading: false })
    }
  },

  async checkFollowing(targetUserId) {
    try {
      const res = await callFunction('follow', { action: 'check', targetUserId })
      if (res.success) this.setData({ isFollowing: res.isFollowing })
    } catch (e) {}
  },

  async loadComments(targetId) {
    try {
      const res = await callFunction('comment-list', { targetId })
      if (res.success) {
        const comments = res.list.map(c => ({
          ...c,
          timeText: formatTime(c.createdAt),
          replies: (c.replies || []).map(r => ({
            ...r,
            timeText: formatTime(r.createdAt)
          }))
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
          'post.likeCount': (this.data.post.likeCount || 0) + (res.liked ? 1 : -1)
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
          'post.collectCount': (this.data.post.collectCount || 0) + (res.collected ? 1 : -1)
        })
        wx.showToast({ title: res.collected ? '已收藏' : '已取消', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 关注作者
  async onFollow() {
    if (!app.ensureLogin()) return
    const { isFollowing, post } = this.data
    try {
      const res = await callFunction('follow', {
        action: isFollowing ? 'unfollow' : 'follow',
        targetUserId: post.userId
      })
      if (res.success) {
        this.setData({ isFollowing: res.following })
        wx.showToast({ title: res.following ? '已关注' : '已取关', icon: 'none' })
      } else {
        wx.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 跳转作者主页
  goUserProfile() {
    if (this.data.post.isAnonymous) return
    wx.navigateTo({
      url: `/pages/user-profile/user-profile?id=${this.data.post.userId}`
    })
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true })
  },

  onEdit() {
    if (!this.data.canEdit) return
    wx.navigateTo({ url: `/pages/post-publish/post-publish?id=${this.data.post._id}` })
  },

  onReport() {
    if (!app.ensureLogin()) return
    const reportReasons = ['垃圾广告', '违法违规', '色情低俗', '辱骂攻击', '隐私泄露', '其他']
    wx.showActionSheet({
      itemList: reportReasons,
      success: async (res) => {
        const reason = reportReasons[res.tapIndex]
        try {
          const r = await callFunction('report', {
            targetId: this.data.post._id,
            targetType: 'post',
            reason
          })
          if (r.success) {
            wx.showToast({ title: '举报已提交', icon: 'success' })
          } else {
            wx.showToast({ title: r.message || '举报失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '举报失败', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    const post = this.data.post
    if (!post) return { title: 'CampusHub', path: '/pages/index/index' }
    return {
      title: post.title,
      path: `/pages/post-detail/post-detail?id=${post._id}`
    }
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

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

  onResolve() {
    if (!this.data.canResolve) return
    wx.showModal({
      title: '标记为已解决',
      content: '确认该任务/请求已解决？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await callFunction('resolve', { postId: this.data.post._id })
          if (r.success) {
            this.setData({ isResolved: true, canResolve: false, 'post.resolved': true })
            wx.showToast({ title: '已标记为已解决', icon: 'success' })
          } else {
            wx.showToast({ title: r.message || '操作失败', icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
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
        await this.loadComments(this.postId)
        this.setData({ 'post.commentCount': Math.max(0, (this.data.post.commentCount || 1) - 1) })
        wx.showToast({ title: '已删除', icon: 'none' })
      } else {
        wx.showToast({ title: r.message || '删除失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  // 回复主楼层评论
  onReply(e) {
    const { userid, nickname, commentid } = e.currentTarget.dataset
    this.setData({
      replyTo: nickname,
      replyToUserId: userid,
      replyToCommentId: commentid
    })
  },

  // 取消回复
  cancelReply() {
    this.setData({
      replyTo: '',
      replyToUserId: '',
      replyToCommentId: ''
    })
  },

  async sendComment() {
    if (!app.ensureLogin()) return
    const { commentText, post, replyTo, replyToUserId, replyToCommentId } = this.data
    
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
        replyToNickname: replyTo,
        parentId: replyToCommentId || undefined
      })
      
      if (res.success) {
        this.setData({
          commentText: '',
          replyTo: '',
          replyToUserId: '',
          replyToCommentId: '',
          'post.commentCount': (post.commentCount || 0) + 1
        })
        await this.loadComments(this.postId)
        wx.showToast({ title: '评论成功', icon: 'success' })
      } else {
        wx.showToast({ title: res.message || '评论失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '评论失败', icon: 'none' })
    }
  },

  // 展开折叠楼中楼
  toggleReplies(e) {
    const commentId = e.currentTarget.dataset.id
    const expanded = { ...this.data.expandedReplies }
    expanded[commentId] = !expanded[commentId]
    this.setData({ expandedReplies: expanded })
  },

  // 评论点赞
  async onCommentLike(e) {
    if (!app.ensureLogin()) return
    const { id, liked } = e.currentTarget.dataset
    const comments = [...this.data.comments]
    // 找到评论并更新
    for (const c of comments) {
      if (c._id === id) {
        try {
          const res = await callFunction('like', {
            targetId: id,
            type: 'comment',
            action: liked ? 'unlike' : 'like'
          })
          if (res.success) {
            c.likeCount = (c.likeCount || 0) + (res.liked ? 1 : -1)
            c._liked = res.liked
            this.setData({ comments })
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
        return
      }
      // 在子回复中查找
      if (c.replies) {
        for (const r of c.replies) {
          if (r._id === id) {
            try {
              const res = await callFunction('like', {
                targetId: id,
                type: 'comment',
                action: liked ? 'unlike' : 'like'
              })
              if (res.success) {
                r.likeCount = (r.likeCount || 0) + (res.liked ? 1 : -1)
                r._liked = res.liked
                this.setData({ comments })
              }
            } catch (err) {
              wx.showToast({ title: '操作失败', icon: 'none' })
            }
            return
          }
        }
      }
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
