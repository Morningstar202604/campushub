// cloudfunctions/product-list/index.js
const { getDB, ok, wrap } = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const { page = 1, pageSize = 20, schoolId, category, keyword } = event

  // 不再强制 schoolId — 全国内容默认不过滤校区
  const where = { status: 'on_sale' }
  if (schoolId) where.schoolId = schoolId
  if (category && category !== 'all') where.category = category

  if (keyword && String(keyword).trim()) {
    const kw = String(keyword).trim().slice(0, 20)
    where.title = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
  }

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  const res = await db.collection('products')
    .where(where).orderBy('createdAt', 'desc').skip(skip).limit(size).get()

  return ok({ list: res.data, hasMore: res.data.length === size })
})
