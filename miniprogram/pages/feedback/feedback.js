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
    
    this.setData({ submitting: true })
    
    try {
      // 直接写入数据库
      const db = wx.cloud.database()
      await db.collection('feedbacks').add({
        data: {
          content: this.data.content.trim(),
          contact: this.data.contact.trim(),
          createdAt: new Date()
        }
      })
      
      wx.showToast({ title: '提交成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
    
    this.setData({ submitting: false })
  }
})
