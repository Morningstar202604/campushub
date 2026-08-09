// cloudfunctions/post-detail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  const { postId, userId } = event
  
  if (!postId) {
    return { success: false, message: '缺少帖子ID' }
  }
  
  try {
    // 获取帖子详情
    const postRes = await db.collection('posts').doc(postId).get()
    const post = postRes.data
    
    if (!post || post.status !== 'normal') {
      return { success: false, message: '帖子不存在或已删除' }
    }
    
    // 增加浏览量
    await db.collection('posts').doc(postId).update({
      data: { viewCount: _.inc(1) }
    })
    post.viewCount = (post.viewCount || 0) + 1
    
    // 查用户是否点赞/收藏
    let isLiked = false
    let isCollected = false
    
    if (userId) {
      const likeRes = await db.collection('likes').where({
        userId, targetId: postId, type: 'post'
      }).count()
      isLiked = likeRes.total > 0
      
      const collectRes = await db.collection('collects').where({
        userId, targetId: postId
      }).count()
      isCollected = collectRes.total > 0
    }
    
    return {
      success: true,
      post,
      isLiked,
      isCollected
    }
  } catch (err) {
    console.error('[post-detail] error:', err)
    return { success: false, message: '获取失败' }
  }
}
