// cloudfunctions/comment-list/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const { targetId, page = 1, pageSize = 50 } = event
  
  if (!targetId) {
    return { success: false, list: [] }
  }
  
  try {
    const res = await db.collection('comments')
      .where({ targetId, status: 'normal' })
      .orderBy('createdAt', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return { success: true, list: res.data, hasMore: res.data.length === pageSize }
  } catch (err) {
    console.error('[comment-list] error:', err)
    return { success: false, list: [] }
  }
}
