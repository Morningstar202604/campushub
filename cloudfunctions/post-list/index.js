// cloudfunctions/post-list/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  const { tab = 'recommend', page = 1, pageSize = 20, schoolId = 'HSFNC' } = event
  
  const where = { status: 'normal', schoolId }
  
  try {
    if (tab === 'latest') {
      const res = await db.collection('posts')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()
      return { success: true, list: res.data, hasMore: res.data.length === pageSize }
    }
    
    // 推荐：按互动量 + 时间衰减
    const res = await db.collection('posts')
      .where(where)
      .orderBy('isPinned', 'desc')
      .orderBy('likeCount', 'desc')
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return { success: true, list: res.data, hasMore: res.data.length === pageSize }
  } catch (err) {
    console.error('[post-list] error:', err)
    return { success: false, list: [], hasMore: false, error: err.message }
  }
}
