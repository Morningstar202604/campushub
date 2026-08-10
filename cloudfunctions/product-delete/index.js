// cloudfunctions/product-delete/index.js
// 下架/删除商品：软删除 + 归属校验/管理员 + 计数回退
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser, requireActive } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const db = getDB()
  const _ = getCmd()

  const { productId } = event
  if (!productId) throw new AppError('缺少商品ID', 'INVALID_PARAM')

  const res = await db.collection('products').doc(productId).get()
  const product = res.data
  if (!product) throw new AppError('商品不存在', 'NOT_FOUND')
  if (product.userId !== user._id && user.role !== 'admin') {
    throw new AppError('无权删除该内容', 'FORBIDDEN')
  }
  if (product.status === 'deleted') return ok({ deleted: true })

  await db.collection('products').doc(productId).update({ data: { status: 'deleted', updatedAt: new Date() } })
  await db.collection('users').doc(product.userId).update({ data: { productCount: _.inc(-1) } }).catch(() => {})

  return ok({ deleted: true })
})
