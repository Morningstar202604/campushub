// pages/verify/verify.js
// 校园身份认证：提交 学校+学号+校卡照片 → 管理员人工审核
// 通过后发帖/发布二手会带上「已认证」标识，提升交易信任度
const app = getApp()
const { callFunction, uploadImage } = require('../../utils/request.js')
const { ensureLogin } = require('../../utils/auth.js')

Page({
  data: {
    campusVerified: false,
    status: 'none',        // none | pending | approved | rejected
    request: null,
    school: '',
    studentId: '',
    imageFileID: '',       // 已上传的 cloud:// 路径
    localPreview: '',      // 本地预览路径
    submitting: false,
    loading: true
  },

  onLoad() {
    if (!ensureLogin()) return
    this.loadStatus()
  },

  async loadStatus() {
    try {
      const res = await callFunction('verify', { action: 'status' })
      if (res.success) {
        this.setData({
          campusVerified: res.campusVerified,
          status: res.status || 'none',
          request: res.request || null,
          school: (res.request && res.request.school) || ''
        })
      }
    } catch (e) {
      console.error('认证状态加载失败', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  onSchoolInput(e) { this.setData({ school: e.detail.value }) },
  onStudentIdInput(e) { this.setData({ studentId: e.detail.value }) },

  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      const filePath = res.tempFiles[0].tempFilePath
      wx.showLoading({ title: '上传中...' })
      const fileID = await uploadImage(filePath, 'verify')
      wx.hideLoading()
      this.setData({ imageFileID: fileID, localPreview: filePath })
    } catch (e) {
      wx.hideLoading()
      if (e && e.message) wx.showToast({ title: e.message, icon: 'none' })
    }
  },

  removeImage() {
    this.setData({ imageFileID: '', localPreview: '' })
  },

  async submit() {
    if (this.data.submitting) return
    const { school, studentId, imageFileID } = this.data

    if (!school.trim()) { wx.showToast({ title: '请填写学校名称', icon: 'none' }); return }
    if (!/^[A-Za-z0-9]{4,20}$/.test(studentId.trim())) {
      wx.showToast({ title: '学号需为 4~20 位字母或数字', icon: 'none' }); return
    }
    if (!imageFileID) { wx.showToast({ title: '请上传校园卡/学生证照片', icon: 'none' }); return }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })
    try {
      const res = await callFunction('verify', {
        action: 'submit',
        school: school.trim(),
        studentId: studentId.trim(),
        imageFileID
      })
      wx.hideLoading()
      if (res.success) {
        wx.showToast({ title: '已提交，等待审核', icon: 'success' })
        this.loadStatus()
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
