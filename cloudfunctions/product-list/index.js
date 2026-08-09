// cloudfunctions/product-list/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  const { page = 1, pageSize = 20, schoolId = 'HSFNC', category, keyword } = event
  
  const where = { status: 'on_sale', schoolId }
  if (category && category !== 'all') {
    where.category = category
  }
  if (keyword) {
    where.title = db.Regexp({ regexp: keyword, options: 'i' })
  }
  
  try {
    const res = await db.collection('products')
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return { success: true, list: res.data, hasMore: res.data.length === pageSize }
  } catch (err) {
    console.error('[product-list] error:', err)
    return { success: false, list: [], hasMore: false }
  }
}
