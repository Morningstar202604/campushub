// cloudfunctions/guide-detail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  const { guideId } = event
  
  if (!guideId) {
    return { success: false, message: '缺少指南ID' }
  }
  
  try {
    const res = await db.collection('guides').doc(guideId).get()
    const guide = res.data
    
    if (!guide) {
      return { success: false, message: '指南不存在' }
    }
    
    // 增加浏览量
    await db.collection('guides').doc(guideId).update({
      data: { viewCount: _.inc(1) }
    })
    guide.viewCount = (guide.viewCount || 0) + 1
    
    return { success: true, guide }
  } catch (err) {
    console.error('[guide-detail] error:', err)
    return { success: false, message: '获取失败' }
  }
}
