// pages/profile-edit/profile-edit.js
const app = getApp()
const { callFunction, uploadImage } = require('../../utils/request.js')
const { firstChar } = require('../../utils/auth.js')

Page({
  data: {
    user: null,
    avatar: '',
    avatarChanged: false,
    nickname: '',
    bio: '',
    college: '',
    major: '',
    grade: '',
    selectedTags: [],
    gradeOptions: ['2020级', '2021级', '2022级', '2023级', '2024级', '2025级', '研究生'],
    tagOptions: ['学习', '考研', '摄影', '篮球', '音乐', '美食', '旅行', '游戏', '阅读', '运动', '追剧', '兼职'],
    saving: false
  },

  onLoad() {
    const user = app.globalData.userInfo
    if (user) {
      this.setData({
        user: { ...user, nicknameFirst: firstChar(user.nickname) },
        avatar: user.avatar || '',
        nickname: user.nickname || '',
        bio: user.bio || '',
        college: user.college || '',
        major: user.major || '',
        grade: user.grade || '',
        selectedTags: user.tags || []
      })
    }
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }) },
  onBioInput(e) { this.setData({ bio: e.detail.value }) },
  onCollegeInput(e) { this.setData({ college: e.detail.value }) },
  onMajorInput(e) { this.setData({ major: e.detail.value }) },

  // 微信头像选择器：返回临时路径，需上传云存储后保存 fileID
  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return
    wx.showLoading({ title: '上传头像中...' })
    try {
      const fileID = await uploadImage(avatarUrl, 'avatars')
      this.setData({ avatar: fileID, avatarChanged: true })
    } catch (err) {
      wx.showToast({ title: '头像上传失败', icon: 'none' })
    }
    wx.hideLoading()
  },

  onGradeChange(e) {
    this.setData({ grade: this.data.gradeOptions[e.detail.value] })
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag
    const tags = [...this.data.selectedTags]
    const idx = tags.indexOf(tag)
    if (idx > -1) tags.splice(idx, 1)
    else tags.push(tag)
    this.setData({ selectedTags: tags })
  },

  async onSave() {
    if (this.data.saving) return
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      const payload = {
        nickname: this.data.nickname,
        bio: this.data.bio,
        college: this.data.college,
        major: this.data.major,
        grade: this.data.grade,
        tags: this.data.selectedTags
      }
      if (this.data.avatarChanged) payload.avatar = this.data.avatar

      const res = await callFunction('user-update', payload)

      if (res.success) {
        app.setUserInfo(res.user)
        wx.showToast({ title: '保存成功', icon: 'success' })
        // 保持 saving=true 并提前返回：跳转空窗期防重复保存
        setTimeout(() => wx.navigateBack(), 1500)
        return
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
    this.setData({ saving: false })
  }
})
