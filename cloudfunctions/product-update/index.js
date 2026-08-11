// cloudfunctions/product-update/index.js
// 编辑商品：仅作者本人可编辑 + fail-closed 内容安全 + 图片安全
// 可编辑字段：title, description, images, price, originalPrice, category, condition, tradeType, location, contactInfo
// 特殊操作：markSold=true 标记已售, markSold=false 重新上架
const { getDB, AppError, ok, wrap, requireActiveUser, checkContents, checkImages } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { productId, title, description, images, price, originalPrice,
    category, condition, tradeType, location, contactInfo, markSold } = event
  if (!productId) throw new AppError('缺少商品ID', 'INVALID_PARAM')

  // 获取商品并验证所有权
  const prodRes = await db.collection('products').doc(productId).get().catch(() => ({ data: null }))
  if (!prodRes || !prodRes.data) throw new AppError('商品不存在', 'NOT_FOUND')
  const product = prodRes.data
  if (product.status === 'deleted') throw new AppError('该商品已删除', 'INVALID_PARAM')
  if (product.userId !== user._id) throw new AppError('无权编辑他人商品', 'FORBIDDEN')

  // 快捷操作：标记已售 / 重新上架
  if (markSold !== undefined) {
    const newStatus = markSold ? 'sold' : 'on_sale'
    await db.collection('products').doc(productId).update({
      data: { status: newStatus, updatedAt: new Date() }
    })
    return ok({ updated: true, status: newStatus })
  }

  const patch = {}
  const textsToCheck = []

  // 标题
  if (title !== undefined) {
    if (!String(title).trim()) throw new AppError('标题不能为空', 'INVALID_PARAM')
    if (String(title).length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
    patch.title = String(title).trim()
    textsToCheck.push(patch.title)
  }

  // 描述
  if (description !== undefined) {
    patch.description = String(description).slice(0, 2000).trim()
    textsToCheck.push(patch.description)
  }

  // 图片
  if (images !== undefined) {
    if (!Array.isArray(images) || images.length === 0) throw new AppError('请至少上传一张图片', 'INVALID_PARAM')
    if (images.length > 9) throw new AppError('图片不能超过9张', 'INVALID_PARAM')
    patch.images = images
    // 对新图片做安全检查
    const newImages = images.filter(img => img && !product.images?.includes(img))
    if (newImages.length) await checkImages(newImages, { openid: user.openid })
  }

  // 价格
  if (price !== undefined) {
    const numPrice = Number(price)
    if (!Number.isFinite(numPrice) || numPrice < 0) throw new AppError('请输入有效价格', 'INVALID_PARAM')
    patch.price = numPrice
  }

  // 原价
  if (originalPrice !== undefined) {
    patch.originalPrice = originalPrice ? Number(originalPrice) : null
  }

  // 原价不能低于售价
  const finalPrice = patch.price !== undefined ? patch.price : product.price
  const finalOrig = patch.originalPrice !== undefined ? patch.originalPrice : product.originalPrice
  if (finalOrig && Number(finalOrig) > 0 && Number(finalOrig) < finalPrice) {
    throw new AppError('原价不能低于售价', 'INVALID_PARAM')
  }

  if (category !== undefined) patch.category = category
  if (condition !== undefined) patch.condition = condition
  if (tradeType !== undefined) patch.tradeType = tradeType
  if (location !== undefined) patch.location = String(location || '').slice(0, 200)
  if (contactInfo !== undefined) {
    patch.contactInfo = String(contactInfo || '').slice(0, 100)
    textsToCheck.push(patch.contactInfo)
  }

  // 文本安全审核（fail-closed）
  if (textsToCheck.length) {
    await checkContents(textsToCheck, { openid: user.openid, scene: 2 })
  }

  if (Object.keys(patch).length === 0) throw new AppError('没有需要更新的字段', 'INVALID_PARAM')
  patch.updatedAt = new Date()

  await db.collection('products').doc(productId).update({ data: patch })
  return ok({ updated: true })
})
