// cloudfunctions/guide-list/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const { schoolId = 'HSFNC', categoryId } = event
  
  try {
    // 获取分类
    const catRes = await db.collection('guide_categories')
      .where({ schoolId })
      .orderBy('sort', 'asc')
      .get()
    
    let categories = catRes.data
    
    // 获取指南列表
    const where = { schoolId, status: 'published' }
    if (categoryId) where.categoryId = categoryId
    
    const guideRes = await db.collection('guides')
      .where(where)
      .orderBy('sort', 'asc')
      .orderBy('createdAt', 'desc')
      .field({ title: true, summary: true, coverImage: true, categoryId: true, tags: true, viewCount: true, _id: true })
      .get()
    
    return {
      success: true,
      categories,
      guides: guideRes.data
    }
  } catch (err) {
    console.error('[guide-list] error:', err)
    return { success: false, categories: [], guides: [] }
  }
}
