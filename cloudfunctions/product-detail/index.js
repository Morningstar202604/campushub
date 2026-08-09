// cloudfunctions/product-detail/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const db = cloud.database()
  const _ = db.command
  const { productId, userId } = event
  
  if (!productId) {
    return { success: false, message: '缺少商品ID' }
  }
  
  try {
    const productRes = await db.collection('products').doc(productId).get()
    const product = productRes.data
    
    if (!product) {
      return { success: false, message: '商品不存在' }
    }
    
    // 增加浏览量
    await db.collection('products').doc(productId).update({
      data: { viewCount: _.inc(1) }
    })
    product.viewCount = (product.viewCount || 0) + 1
    
    // 查是否收藏
    let isCollected = false
    if (userId) {
      const collectRes = await db.collection('collects').where({
        userId, targetId: productId, type: 'product'
      }).count()
      isCollected = collectRes.total > 0
    }
    
    return { success: true, product, isCollected }
  } catch (err) {
    console.error('[product-detail] error:', err)
    return { success: false, message: '获取失败' }
  }
}
