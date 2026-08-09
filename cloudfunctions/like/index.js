// cloudfunctions/like/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { targetId, type = 'post', action = 'like' } = event
  
  if (!targetId) {
    return { success: false, message: '缺少目标ID' }
  }
  
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  const collection = type === 'post' ? 'posts' : 'products'
  
  if (action === 'like') {
    // 检查是否已点赞
    const existing = await db.collection('likes').where({
      userId: user._id, targetId, type
    }).count()
    
    if (existing.total > 0) {
      return { success: false, message: '已点赞过' }
    }
    
    await db.collection('likes').add({
      data: {
        userId: user._id, targetId, type,
        createdAt: new Date()
      }
    })
    
    await db.collection(collection).doc(targetId).update({
      data: { likeCount: _.inc(1) }
    })
    
    return { success: true, liked: true }
  } else {
    // 取消点赞
    await db.collection('likes').where({
      userId: user._id, targetId, type
    }).remove()
    
    await db.collection(collection).doc(targetId).update({
      data: { likeCount: _.inc(-1) }
    })
    
    return { success: true, liked: false }
  }
}
