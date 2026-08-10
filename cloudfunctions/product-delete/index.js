// cloudfunctions/product-delete/index.js
// 下架/删除商品：统一经 removeContent（软删除 + 归属校验/管理员 + 计数回退 + 回收云存储图片）
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser, requireActive, removeContent } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const { productId } = event
  if (!productId) throw new AppError('缺少商品ID', 'INVALID_PARAM')

  await removeContent({ collection: 'products', docId: productId, actor: user, opts: { userCountField: 'productCount' } })
  return ok({ deleted: true })
})
