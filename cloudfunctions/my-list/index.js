// cloudfunctions/my-list/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { type = 'posts', page = 1, pageSize = 20 } = event
  
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, list: [] }
  }
  
  const userId = userRes.data[0]._id
  
  try {
    if (type === 'posts') {
      const res = await db.collection('posts')
        .where({ userId, status: _.neq('deleted') })
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()
      return { success: true, list: res.data, hasMore: res.data.length === pageSize }
    }
    
    if (type === 'products') {
      const res = await db.collection('products')
        .where({ userId, status: _.neq('deleted') })
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()
      return { success: true, list: res.data, hasMore: res.data.length === pageSize }
    }
    
    if (type === 'collects') {
      // 先查收藏记录
      const collectRes = await db.collection('collects')
        .where({ userId })
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()
      
      if (collectRes.data.length === 0) {
        return { success: true, list: [], hasMore: false }
      }
      
      // 根据类型分组查询
      const postIds = collectRes.data.filter(c => c.type === 'post').map(c => c.targetId)
      const productIds = collectRes.data.filter(c => c.type === 'product').map(c => c.targetId)
      
      let posts = [], products = []
      if (postIds.length) {
        const r = await db.collection('posts').where({ _id: _.in(postIds) }).get()
        posts = r.data
      }
      if (productIds.length) {
        const r = await db.collection('products').where({ _id: _.in(productIds) }).get()
        products = r.data
      }
      
      return { success: true, list: [...posts, ...products], hasMore: collectRes.data.length === pageSize }
    }
    
    return { success: false, list: [], message: '未知类型' }
  } catch (err) {
    console.error('[my-list] error:', err)
    return { success: false, list: [] }
  }
}
