// cloudfunctions/search/index.js
// 搜索：关键词转义 + 限长，避免正则注入与超长查询。
// 标题与正文/描述用 _.or 单查询完成——旧实现"标题流+内容流各自 skip"在翻页时
// 会出现重复或漏项；单流排序天然一致，且少一次数据库往返。
//
// 降本 C7 / T2 落地：
//  - 服务端限频：每用户 10 秒内最多 3 次真实搜索（前端已有 2 秒限频，服务端兜底
//    防脚本绕过前端直接刷正则全表扫）
//  - 搜索日志写入 search_queries：提供 action=hot 聚合近 7 天真实热搜
//  - 正则全表扫描是平台能力限制（微信云开发无全文索引），数据过万后建议关闭搜索
//    或接入外部检索，见 docs/OPERATIONS.md「搜索性能」
const { getDB, getCmd, ok, wrap, getOpenid, rateLimit, AppError } = require('./common-bundle')

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toInt(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

const HOT_WINDOW_MS = 7 * 86400000
const RATE_WINDOW_MS = 10000
const RATE_MAX = 3

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()

  // 真实热搜：近 7 天搜索日志聚合 top6（无需登录/限频）
  if (event.action === 'hot') {
    const since = new Date(Date.now() - HOT_WINDOW_MS)
    const res = await db.collection('search_queries')
      .where({ createdAt: _.gt(since) })
      .field({ keyword: true })
      .limit(500)
      .get()
    const count = {}
    for (const r of res.data || []) {
      const k = String(r.keyword || '').trim().slice(0, 20)
      if (k) count[k] = (count[k] || 0) + 1
    }
    const hot = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0])
    return ok({ hot })
  }

  const { keyword, schoolId } = event

  if (!keyword || !String(keyword).trim()) {
    return ok({ posts: [], products: [], guides: [] })
  }

  // 服务端限频兜底（基于云端 openid，游客同样受限）
  const openid = await getOpenid().catch(() => '')
  if (openid) {
    await rateLimit({
      collection: 'search_queries',
      match: { userId: openid },
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX
    })
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

  // 写搜索日志（供热词聚合与审计；失败静默不影响结果）
  try {
    await db.collection('search_queries').add({
      data: { userId: openid || 'anon', keyword: kw, createdAt: new Date() }
    })
  } catch (e) { /* 静默 */ }

  return ok({ posts: postsRes.data, products: productsRes.data, guides: guidesRes.data })
})
