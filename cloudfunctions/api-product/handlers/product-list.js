// cloudfunctions/product-list/index.js
const {
  getDB,
  ok,
  wrap,
  sanitizeQuery,
  getOptionalUser,
  blockedUserIds,
  pageParams
} = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = wrap(async (event) => {
  const db = getDB()
  // 客户端查询字段统一过白名单标量断言（与 post-list 口径一致），防对象/操作符注入 where
  const safe = sanitizeQuery(event, ['schoolId', 'category', 'keyword'])
  const schoolId = safe.schoolId
  const category = safe.category
  const keyword = safe.keyword

  // 不再强制 schoolId — 全国内容默认不过滤校区
  const where = { status: 'on_sale' }
  if (schoolId) where.schoolId = schoolId
  if (category && category !== 'all') where.category = category

  if (keyword && String(keyword).trim()) {
    const kw = String(keyword).trim().slice(0, 20)
    where.title = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
  }

  // 黑名单过滤（读侧）：登录用户看不到自己拉黑的人的商品；游客无黑名单，不加条件。
  const viewer = await getOptionalUser()
  const blocked = await blockedUserIds(viewer && viewer._id)
  if (blocked.length) where.userId = db.command.nin(blocked)

  const { pageSize: size, skip } = pageParams(event, { defaultSize: 20, maxSize: 100 })

  const res = await db
    .collection('products')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(size)
    .get()

  return ok({ list: res.data, hasMore: res.data.length === size })
})
