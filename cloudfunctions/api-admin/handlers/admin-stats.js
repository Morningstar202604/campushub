// cloudfunctions/admin-stats/index.js
// 运营看板：一次返回社区核心指标（仅管理员）。
//
// 为什么单独一个入口：管理台首页需要 6-8 个计数，逐个 count 会让前端打 8 次云函数；
// 这里在服务端并发聚合，一次往返返回。全部使用 count()（云开发对 count 有优化），
// 不做全表遍历；错误逐个降级为 null，不让单个集合的索引缺失拖垮整个看板。
const {
  getDB,
  getCmd,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  checkAdmin
} = require('./common-bundle')

async function safeCount(promise) {
  try {
    const r = await promise
    return r && typeof r.total === 'number' ? r.total : 0
  } catch {
    return null
  }
}

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()
  const isAdmin = await checkAdmin(db, user.openid)
  if (!isAdmin) throw new AppError('无权限执行该操作', 'FORBIDDEN')

  const days = Math.min(90, Math.max(1, Number(event.days) || 7))
  const since = new Date(Date.now() - days * 86400000)

  const [
    users,
    usersBanned,
    posts,
    postsDeleted,
    products,
    productsOnSale,
    comments,
    pendingReports,
    pendingVerifies,
    pendingFeedbacks,
    newPosts,
    newUsers,
    newComments
  ] = await Promise.all([
    safeCount(db.collection('users').count()),
    safeCount(db.collection('users').where({ verifyStatus: 'banned' }).count()),
    safeCount(db.collection('posts').where({ status: 'normal' }).count()),
    safeCount(db.collection('posts').where({ status: 'deleted' }).count()),
    safeCount(
      db
        .collection('products')
        .where({ status: _.neq('deleted') })
        .count()
    ),
    safeCount(db.collection('products').where({ status: 'on_sale' }).count()),
    safeCount(db.collection('comments').where({ status: 'normal' }).count()),
    safeCount(db.collection('reports').where({ status: 'pending' }).count()),
    safeCount(db.collection('verify_requests').where({ status: 'pending' }).count()),
    safeCount(db.collection('feedbacks').where({ status: 'pending' }).count()),
    safeCount(
      db
        .collection('posts')
        .where({ createdAt: _.gt(since) })
        .count()
    ),
    safeCount(
      db
        .collection('users')
        .where({ createdAt: _.gt(since) })
        .count()
    ),
    safeCount(
      db
        .collection('comments')
        .where({ createdAt: _.gt(since) })
        .count()
    )
  ])

  // 平均处理时长：取最近 100 条已处理举报，按 resolvedAt - createdAt 求均值
  let avgResolveHours = null
  try {
    const resolved = await db
      .collection('reports')
      .where({ status: 'resolved' })
      .orderBy('resolvedAt', 'desc')
      .limit(100)
      .field({ createdAt: true, resolvedAt: true })
      .get()
    const spans = (resolved.data || [])
      .map((r) => {
        const a = new Date(r.createdAt).getTime()
        const b = new Date(r.resolvedAt).getTime()
        return Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : null
      })
      .filter((v) => v != null)
    if (spans.length) {
      avgResolveHours =
        Math.round((spans.reduce((s, v) => s + v, 0) / spans.length / 3600000) * 10) / 10
    }
  } catch {
    avgResolveHours = null
  }

  return ok({
    days,
    users: { total: users, banned: usersBanned, new: newUsers },
    posts: { normal: posts, deleted: postsDeleted, new: newPosts },
    products: { total: products, onSale: productsOnSale },
    comments: { normal: comments, new: newComments },
    queue: {
      reports: pendingReports,
      verifies: pendingVerifies,
      feedbacks: pendingFeedbacks
    },
    avgResolveHours
  })
})
