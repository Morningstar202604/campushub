// pages/user-profile/user-profile.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')
const { formatTime, formatNumber, firstChar } = require('../../utils/auth.js')

Page({
  data: {
    userId: '',
    profile: null,
    isFollowing: false,
    posts: [],
    loading: true,
    isSelf: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ userId: options.id })
      this.loadProfile(options.id)
    } else {
      // 无 id 直接进入错误态，避免骨架屏永不消失
      this.setData({ loading: false })
    }
  },

  async loadProfile(userId) {
    try {
      const res = await callFunction('user-profile', { userId })
      if (res.success) {
        const myId = app.globalData.userInfo ? app.globalData.userInfo._id : ''
        const posts = (res.posts || []).map(p => ({
          ...p,
          timeText: formatTime(p.createdAt),
          likeCountText: formatNumber(p.likeCount || 0)
        }))
        this.setData({
          profile: { ...res.profile, nicknameFirst: firstChar(res.profile.nickname) },
          isFollowing: res.isFollowing,
          posts,
          isSelf: myId === userId,
          loading: false
        })
        wx.setNavigationBarTitle({ title: res.profile.nickname + '的主页' })
      } else {
        this.setData({ loading: false })
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      }
    } catch (err) {
      console.error('加载用户主页失败', err)
      this.setData({ loading: false })
    }
  },

  async onFollow() {
    if (!app.ensureLogin()) return
    if (this._followLock) return // 在途锁：连点不重复发请求
    this._followLock = true
    const { isFollowing, userId } = this.data
    try {
      const res = await callFunction('follow', {
        action: isFollowing ? 'unfollow' : 'follow',
        targetUserId: userId
      })
      if (res.success) {
        this.setData({
          isFollowing: res.following,
          'profile.followerCount': Math.max(0, (this.data.profile.followerCount || 0) + (res.following ? 1 : -1))
        })
        wx.showToast({ title: res.following ? '已关注' : '已取关', icon: 'none' })
      } else {
        wx.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      this._followLock = false
    }
  },

  onPostTap(e) {
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${e.currentTarget.dataset.id}`
    })
  }
})
