// cloudfunctions/guide-list/index.js
// 校园指南列表：按 categoryId 正确筛选（根本性修复原 category 字段不匹配问题）
const { getDB, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { schoolId = 'HSFNC', categoryId } = event

  const catRes = await db.collection('guide_categories')
    .where({ schoolId }).orderBy('sort', 'asc').get()
  const categories = catRes.data

  const where = { schoolId, status: 'published' }
  if (categoryId && categoryId !== 'all') where.categoryId = categoryId

  const guideRes = await db.collection('guides')
    .where(where)
    .orderBy('sort', 'asc').orderBy('createdAt', 'desc')
    .field({ title: true, summary: true, coverImage: true, categoryId: true, category: true, tags: true, viewCount: true, _id: true })
    .get()

  return ok({ categories, guides: guideRes.data })
})
