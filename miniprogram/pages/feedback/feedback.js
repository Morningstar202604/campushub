// pages/feedback/feedback.js
const { callFunction } = require('../../utils/request.js')

Page({
  data: {
    content: '',
    contact: '',
    submitting: false
  },

  onContentInput(e) { this.setData({ content: e.detail.value }) },
  onContactInput(e) { this.setData({ contact: e.detail.value }) },

  async onSubmit() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }
    if (this.data.submitting) return

    this.setData({ submitting: true })

    try {
      // 统一经云函数写入（含内容安全 + 频率限制）
      const res = await callFunction('feedback-create', {
        content: this.data.content.trim(),
        contact: this.data.contact.trim(),
        type: 'suggest'
      })

      if (res && res.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: (res && res.message) || '提交失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '提交失败', icon: 'none' })
    }

    this.setData({ submitting: false })
  }
})
