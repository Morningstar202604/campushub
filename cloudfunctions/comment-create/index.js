// cloudfunctions/comment-create/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { targetId, targetType = 'post', content, replyToUserId, replyToNickname } = event
  
  if (!targetId || !content || !content.trim()) {
    return { success: false, message: '请输入评论内容' }
  }
  if (content.length > 500) {
    return { success: false, message: '评论不能超过500字' }
  }
  
  // 敏感词检查
  try {
    const msgCheck = await cloud.openapi.security.msgSecCheck({ content })
    if (msgCheck.errCode !== 0) {
      return { success: false, message: '评论包含敏感信息' }
    }
  } catch (e) {
    console.warn('[安全检查] 跳过')
  }
  
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  const comment = {
    targetId,
    targetType,
    userId: user._id,
    userNickname: user.nickname,
    userAvatar: user.avatar,
    content: content.trim(),
    replyToUserId: replyToUserId || '',
    replyToNickname: replyToNickname || '',
    likeCount: 0,
    status: 'normal',
    createdAt: new Date()
  }
  
  const addRes = await db.collection('comments').add({ data: comment })
  
  // 更新帖子/商品的评论数
  const collection = targetType === 'post' ? 'posts' : 'products'
  await db.collection(collection).doc(targetId).update({
    data: { commentCount: _.inc(1) }
  })
  
  return { success: true, commentId: addRes._id, comment }
}
