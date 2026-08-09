// cloudfunctions/collect/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { targetId, type = 'post', action = 'collect' } = event
  
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
  
  if (action === 'collect') {
    const existing = await db.collection('collects').where({
      userId: user._id, targetId, type
    }).count()
    
    if (existing.total > 0) {
      return { success: false, message: '已收藏过' }
    }
    
    await db.collection('collects').add({
      data: {
        userId: user._id, targetId, type,
        createdAt: new Date()
      }
    })
    
    await db.collection(collection).doc(targetId).update({
      data: { collectCount: _.inc(1) }
    })
    
    return { success: true, collected: true }
  } else {
    await db.collection('collects').where({
      userId: user._id, targetId, type
    }).remove()
    
    await db.collection(collection).doc(targetId).update({
      data: { collectCount: _.inc(-1) }
    })
    
    return { success: true, collected: false }
  }
}
