// cloudfunctions/product-create/index.js
// 发布商品：统一鉴权 + fail-closed 内容安全(文本+图片) + 频率限制 + 封禁拦截
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, checkImages, rateLimit, isDuplicateKeyError } = require('./common-bundle')

// 轮询等待同 clientReqId 的首请求落地（处理并发/重试），最多 waitMs 后返回 null
async function waitIdempotency(db, clientReqId, waitMs) {
  const start = Date.now()
  while (Date.now() - start < waitMs) {
    const rec = await db.collection('idempotency').where({ clientReqId }).get().catch(() => null)
    if (rec && rec.data && rec.data.length) {
      const hit = rec.data[0]
      if (hit.resultId || hit.status === 'done') return hit
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  // ===== 幂等（防闪断重试产生双商品）=====
  // 同 post-create：唯一索引 idx_idempotency_reqid 兜底并发，重试回查已有结果避免双写。
  const clientReqId = event.clientReqId
  let idemId = null
  if (clientReqId) {
    const TTL = 30 * 24 * 60 * 60 * 1000
    const build = () => ({
      clientReqId, type: 'product', resultId: null, status: 'pending',
      createdAt: new Date(), expireAt: new Date(Date.now() + TTL)
    })
    try {
      const r = await db.collection('idempotency').add({ data: build() })
      idemId = r._id
    } catch (e) {
      if (!isDuplicateKeyError(e)) throw e
      const done = await waitIdempotency(db, clientReqId, 8000)
      if (done && done.resultId) {
        return ok({ productId: done.resultId, idempotent: true })
      }
      await db.collection('idempotency').where({ clientReqId }).remove().catch(() => {})
      const r2 = await db.collection('idempotency').add({ data: build() })
      idemId = r2._id
    }
  }

  const {
    title: rawTitle, description, images = [], price, originalPrice,
    category = 'other', condition = 'good', tradeType = 'face',
    location = '', contactInfo = ''
  } = event
  // 统一 String 化：客户端可传非字符串，避免 .trim()/.length 抛 TypeError
  const title = String(rawTitle == null ? '' : rawTitle).trim()

  if (!title) throw new AppError('请输入商品标题', 'INVALID_PARAM')
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
    authorVerified: user.campusVerified === true,
    userAvatar: user.avatar,
    schoolId: user.schoolId || '',
    title,
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

  if (idemId) {
    await db.collection('idempotency').doc(idemId).update({ data: { resultId: addRes._id, status: 'done' } }).catch(() => {})
  }

  return ok({ productId: addRes._id })
})
