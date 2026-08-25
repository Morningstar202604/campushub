// cloudfunctions/search/index.js
// 搜索：关键词转义 + 限长，避免正则注入与超长查询。
// 标题与正文/描述用 _.or 单查询完成——旧实现"标题流+内容流各自 skip"在翻页时
// 会出现重复或漏项；单流排序天然一致，且少一次数据库往返。
const { getDB, getCmd, ok, wrap } = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toInt(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { keyword, schoolId } = event

  if (!keyword || !String(keyword).trim()) {
    return ok({ posts: [], products: [], guides: [] })
  }

  const kw = String(keyword).trim().slice(0, 20)
  const reg = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
  const page = Math.max(1, toInt(event.page, 1))
  const size = Math.min(100, Math.max(1, toInt(event.pageSize, 20)))
  const skip = (page - 1) * size

  // 不再强制 schoolId — 全国搜索
  const postWhere = { status: 'normal' }
  if (schoolId) postWhere.schoolId = schoolId
  const productWhere = { status: 'on_sale' }
  if (schoolId) productWhere.schoolId = schoolId
  const guideWhere = { status: 'published' }
  if (schoolId) guideWhere.schoolId = schoolId

  const [postsRes, productsRes, guidesRes] = await Promise.all([
    db.collection('posts')
      .where(_.and([postWhere, _.or([{ title: reg }, { content: reg }])]))
      .orderBy('createdAt', 'desc').skip(skip).limit(size).get(),
    db.collection('products')
      .where(_.and([productWhere, _.or([{ title: reg }, { description: reg }])]))
      .orderBy('createdAt', 'desc').skip(skip).limit(size).get(),
    // 指南仅按标题检索（正文为富文本，量大且无需全文场景）
    db.collection('guides').where({ ...guideWhere, title: reg })
      .orderBy('createdAt', 'desc').skip(skip).limit(size).get()
  ])

  return ok({ posts: postsRes.data, products: productsRes.data, guides: guidesRes.data })
})
