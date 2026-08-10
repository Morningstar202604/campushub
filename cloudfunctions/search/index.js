// cloudfunctions/search/index.js
// 搜索：关键词转义 + 限长，避免正则注入与超长查询
const { getDB, ok, wrap } = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const { keyword, schoolId = 'HSFNC', page = 1, pageSize = 20 } = event

  if (!keyword || !String(keyword).trim()) {
    return ok({ posts: [], products: [], guides: [] })
  }

  const kw = String(keyword).trim().slice(0, 20)
  const reg = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  const [postsRes, productsRes, guidesRes] = await Promise.all([
    db.collection('posts').where({ schoolId, status: 'normal', title: reg }).orderBy('createdAt', 'desc').skip(skip).limit(size).get(),
    db.collection('products').where({ schoolId, status: 'on_sale', title: reg }).orderBy('createdAt', 'desc').skip(skip).limit(size).get(),
    db.collection('guides').where({ schoolId, status: 'published', title: reg }).orderBy('createdAt', 'desc').limit(size).get()
  ])

  return ok({ posts: postsRes.data, products: productsRes.data, guides: guidesRes.data })
})
