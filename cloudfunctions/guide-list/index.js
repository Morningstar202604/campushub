// cloudfunctions/guide-list/index.js
// 校园指南列表：按 categoryId 正确筛选（根本性修复原 category 字段不匹配问题）
const { getDB, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { schoolId, categoryId, page = 1, pageSize = 50 } = event

  // schoolId 可选 — 不传则返回全部指南（全国模式）
  const catWhere = {}
  if (schoolId) catWhere.schoolId = schoolId
  const catRes = await db.collection('guide_categories')
    .where(catWhere).orderBy('sort', 'asc').limit(200).get()
  const categories = catRes.data

  const where = { status: 'published' }
  if (schoolId) where.schoolId = schoolId
  if (categoryId && categoryId !== 'all') where.categoryId = categoryId

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  const guideRes = await db.collection('guides')
    .where(where)
    .orderBy('sort', 'asc').orderBy('createdAt', 'desc')
    .field({ title: true, summary: true, coverImage: true, categoryId: true, category: true, tags: true, viewCount: true, _id: true })
    .skip(skip).limit(size)
    .get()

  return ok({ categories, guides: guideRes.data, hasMore: guideRes.data.length === size })
})
