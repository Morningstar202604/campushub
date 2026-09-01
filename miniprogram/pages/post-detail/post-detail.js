// pages/post-detail/post-detail.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { formatTime, getUserId, firstChar } = require('../../utils/auth.js')
const { requestSubscribe } = require('../../utils/subscribe.js')

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
    expandedReplies: {},
    // 评论分页
    commentPage: 1,
    commentHasMore: false
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
        post.userNicknameFirst = firstChar(post.userNickname) // emoji 安全首字符
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
          canResolve: isAuthor && (isTask || post.kind === 'lost' || post.kind === 'found') && !isResolved && !isExpired,
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

  async loadComments(targetId, { reset = true } = {}) {
    if (this._loadingComments) return
    this._loadingComments = true
    const page = reset ? 1 : this.data.commentPage
    try {
      const res = await callFunction('comment-list', { targetId, page, pageSize: 20 })
      if (res.success) {
        // 服务端已回填 liked；≤2 条子回复默认展开，更多的默认折叠
        const items = res.list.map(c => ({
          ...c,
          liked: !!c.liked,
          userNicknameFirst: firstChar(c.userNickname),
          timeText: formatTime(c.createdAt),
          replies: (c.replies || []).map(r => ({
            ...r,
            liked: !!r.liked,
            userNicknameFirst: firstChar(r.userNickname),
            timeText: formatTime(r.createdAt)
          }))
        }))
        this.setData({
          comments: reset ? items : [...this.data.comments, ...items],
          commentPage: page + 1,
          commentHasMore: !!res.hasMore
        })
      }
    } catch (err) {
      console.error('加载评论失败', err)
    } finally {
      this._loadingComments = false
    }
  },

  // 触底加载下一页评论
  onReachBottom() {
    if (this.postId && this.data.commentHasMore) {
      this.loadComments(this.postId, { reset: false })
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
    if (this._likeLock) return
    this._likeLock = true
    const next = !this.data.isLiked
    // 乐观更新：先翻状态，失败再回滚
    this.setData({
      isLiked: next,
      'post.likeCount': Math.max(0, (this.data.post.likeCount || 0) + (next ? 1 : -1))
    })
    try {
      const res = await callFunction('like', {
        targetId: this.data.post._id,
        type: 'post',
        action: next ? 'like' : 'unlike'
      })
      if (!res.success) throw new Error(res.message || '操作失败')
    } catch (err) {
      this.setData({
        isLiked: !next,
        'post.likeCount': Math.max(0, (this.data.post.likeCount || 0) + (next ? -1 : 1))
      })
      wx.showToast({ title: err.message === '操作失败' ? '操作失败' : (err.message || '操作失败'), icon: 'none' })
    } finally {
      this._likeLock = false
    }
  },

  async onCollect() {
    if (!app.ensureLogin()) return
    if (this._collectLock) return
    this._collectLock = true
    const next = !this.data.isCollected
    this.setData({
      isCollected: next,
      'post.collectCount': Math.max(0, (this.data.post.collectCount || 0) + (next ? 1 : -1))
    })
    try {
      const res = await callFunction('collect', {
        targetId: this.data.post._id,
        type: 'post',
        action: next ? 'collect' : 'uncollect'
      })
      if (!res.success) throw new Error('操作失败')
      wx.showToast({ title: res.collected ? '已收藏' : '已取消', icon: 'none' })
    } catch (err) {
      this.setData({
        isCollected: !next,
        'post.collectCount': Math.max(0, (this.data.post.collectCount || 0) + (next ? -1 : 1))
      })
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      this._collectLock = false
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
      path: `/pages/post-detail/post-detail?id=${post._id}`,
      imageUrl: post.images && post.images[0]
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
        requestSubscribe(['comment'])
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

  // 评论点赞（liked 由 comment-list 服务端回填；失败给出可见提示）
  async onCommentLike(e) {
    if (!app.ensureLogin()) return
    const { id, liked } = e.currentTarget.dataset
    if (this._commentLikeLock) return
    this._commentLikeLock = true
    try {
      const res = await callFunction('like', {
        targetId: id,
        type: 'comment',
        action: liked ? 'unlike' : 'like'
      })
      if (res.success) {
        const comments = this.data.comments.map(c => {
          let nc = c
          if (c._id === id) {
            nc = { ...c, liked: res.liked, likeCount: Math.max(0, (c.likeCount || 0) + (res.liked ? 1 : -1)) }
          } else if (c.replies && c.replies.length) {
            const replies = c.replies.map(r =>
              r._id === id
                ? { ...r, liked: res.liked, likeCount: Math.max(0, (r.likeCount || 0) + (res.liked ? 1 : -1)) }
                : r
            )
            if (replies.some((r, i) => r !== c.replies[i])) nc = { ...c, replies }
          }
          return nc
        })
        this.setData({ comments })
      } else {
        wx.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      this._commentLikeLock = false
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
