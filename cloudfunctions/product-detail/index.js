// cloudfunctions/product-detail/index.js
const { cloud, getDB, getCmd, AppError, ok, wrap, countViewOnce } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { productId } = event
  if (!productId) throw new AppError('缺少商品ID', 'INVALID_PARAM')

  const productRes = await db.collection('products').doc(productId).get()
  const product = productRes.data
  if (!product || product.status === 'deleted') throw new AppError('商品不存在或已下架', 'NOT_FOUND')

  // 浏览量按 (openid, 文档, 自然日) 去重自增
  const viewed = await countViewOnce('products', productId)
  if (viewed) product.viewCount = (product.viewCount || 0) + 1

  const openid = cloud.getWXContext().OPENID
  let isCollected = false
  if (openid) {
    const me = await db.collection('users').where({ openid }).field({ _id: true }).get()
    if (me.data && me.data.length) {
      const uid = me.data[0]._id
      const collectRes = await db.collection('collects').where({ userId: uid, targetId: productId, type: 'product' }).count()
      isCollected = collectRes.total > 0
    }
  }

  return ok({ product, isCollected })
})
