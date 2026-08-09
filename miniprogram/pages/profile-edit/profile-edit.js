// pages/profile-edit/profile-edit.js
const app = getApp()
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    user: null,
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
        user,
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
      const res = await callFunction('user-update', {
        nickname: this.data.nickname,
        bio: this.data.bio,
        college: this.data.college,
        major: this.data.major,
        grade: this.data.grade,
        tags: this.data.selectedTags
      })

      if (res.success) {
        app.setUserInfo(res.user)
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
    this.setData({ saving: false })
  }
})
