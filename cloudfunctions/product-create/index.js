// cloudfunctions/product-create/index.js
// 发布商品：统一鉴权 + fail-closed 内容安全(文本+图片) + 频率限制 + 封禁拦截
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, checkImages, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const {
    title, description, images = [], price, originalPrice,
    category = 'other', condition = 'good', tradeType = 'face',
    location = '', contactInfo = ''
  } = event

  if (!title || !title.trim()) throw new AppError('请输入商品标题', 'INVALID_PARAM')
  const numPrice = Number(price)
  if (price === undefined || price === null || !Number.isFinite(numPrice) || numPrice < 0) throw new AppError('请输入有效价格', 'INVALID_PARAM')
  if (!Array.isArray(images) || images.length === 0) throw new AppError('请至少上传一张图片', 'INVALID_PARAM')
  if (images.length > 9) throw new AppError('图片不能超过9张', 'INVALID_PARAM')
  if (title.length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
  // 原价合理性：不能低于售价
  if (originalPrice !== undefined && originalPrice !== null && Number(originalPrice) > 0 && Number(originalPrice) < numPrice) {
    throw new AppError('原价不能低于售价', 'INVALID_PARAM')
  }

  // 文本安全：fail-closed
  await checkContents([title, description, contactInfo], { openid: user.openid, scene: 2 })

  // 图片安全：对每张云存储图片做 imgSecCheck（fail-closed）
  if (images.length) await checkImages(images, { openid: user.openid })

  // 频率限制：30秒内最多1条
  await rateLimit({ collection: 'products', match: { userId: user._id }, windowMs: 30000, max: 1 })

  const product = {
    userId: user._id,
    userNickname: user.nickname,
    userAvatar: user.avatar,
    schoolId: user.schoolId || '',
    title: title.trim(),
    description: String(description || '').trim().slice(0, 2000),
    images,
    price: numPrice,
    originalPrice: originalPrice ? Number(originalPrice) : null,
    category,
    condition,
    tradeType,
    location: String(location || '').slice(0, 200),
    contactInfo: String(contactInfo || '').slice(0, 100),
    status: 'on_sale',
    viewCount: 0,
    wantCount: 0,
    collectCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const addRes = await db.collection('products').add({ data: product })
  await db.collection('users').doc(user._id).update({ data: { productCount: _.inc(1) } })

  return ok({ productId: addRes._id })
})
