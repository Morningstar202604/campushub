// cloudfunctions/report/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  const { targetId, targetType = 'post', reason, description = '' } = event
  
  if (!targetId || !reason) {
    return { success: false, message: '缺少必要参数' }
  }
  
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  await db.collection('reports').add({
    data: {
      targetId,
      targetType,
      reporterId: userRes.data[0]._id,
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    }
  })
  
  return { success: true, message: '举报已提交，我们会尽快处理' }
}
