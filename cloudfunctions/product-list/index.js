// cloudfunctions/product-list/index.js
const { getDB, AppError, ok, wrap } = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const { page = 1, pageSize = 20, schoolId = 'HSFNC', category, keyword } = event

  const where = { status: 'on_sale', schoolId }
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
