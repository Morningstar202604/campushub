// cloudfunctions/search/index.js
// 搜索：关键词转义 + 限长，避免正则注入与超长查询
const { getDB, ok, wrap } = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const { keyword, schoolId, page = 1, pageSize = 20 } = event

  if (!keyword || !String(keyword).trim()) {
    return ok({ posts: [], products: [], guides: [] })
  }

  const kw = String(keyword).trim().slice(0, 20)
  const reg = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  // 不再强制 schoolId — 全国搜索
  const postWhere = { status: 'normal' }
  if (schoolId) postWhere.schoolId = schoolId
  const productWhere = { status: 'on_sale' }
  if (schoolId) productWhere.schoolId = schoolId
  const guideWhere = { status: 'published' }
  if (schoolId) guideWhere.schoolId = schoolId

  // 搜索标题 + 内容（帖子）/描述（商品）/摘要（指南）
  const titleOrContent = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })

  const [postsRes, productsRes, guidesRes] = await Promise.all([
    db.collection('posts').where({ ...postWhere, title: reg }).orderBy('createdAt', 'desc').skip(skip).limit(size).get(),
    db.collection('products').where({ ...productWhere, title: reg }).orderBy('createdAt', 'desc').skip(skip).limit(size).get(),
    db.collection('guides').where({ ...guideWhere, title: reg }).orderBy('createdAt', 'desc').limit(size).get()
  ])

  // 补充内容搜索（title 未命中的，再查 content/description/summary）
  if (postsRes.data.length < size) {
    const more = await db.collection('posts')
      .where({ ...postWhere, content: titleOrContent })
      .orderBy('createdAt', 'desc').skip(skip).limit(size - postsRes.data.length).get()
    postsRes.data = postsRes.data.concat(more.data || [])
  }
  if (productsRes.data.length < size) {
    const more = await db.collection('products')
      .where({ ...productWhere, description: titleOrContent })
      .orderBy('createdAt', 'desc').skip(skip).limit(size - productsRes.data.length).get()
    productsRes.data = productsRes.data.concat(more.data || [])
  }

  return ok({ posts: postsRes.data, products: productsRes.data, guides: guidesRes.data })
})
