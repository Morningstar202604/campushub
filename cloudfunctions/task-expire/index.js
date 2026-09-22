// cloudfunctions/task-expire/index.js
// 定时任务：将超时未解决的任务/请求帖置为 expired
// （不推主页、进「过期」页；已解决的不进过期页）
// 降本 C3：信息流已在 post-list 读侧惰性排除过期任务，
// 本 cron 仅作归档兜底（过期页可见性），降频为每 6 小时执行一次。
// 实现：一条 where 条件批量 update 替代逐条循环——无 limit(100) 吞吐瓶颈，调用次数最少。
// 降本 C3 + 计数对账：顺带跑一次 reconcileUserCounts 兜底修正 post/product 计数漂移
// （best-effort，失败仅告警不阻断归档主流程——对账是低频兜底，非关键路径）。
// v0.9.2：① 调用方守卫（fail-closed）——定时触发无 OPENID 放行，客户端手动调用仅限管理员；
//         ② 过期日志清理（云开发无自动 TTL）：view_logs 保留 90 天、rate_limits 清过期窗口占位。
const { cloud, getDB, getCmd, ok, wrap, AppError, reconcileUserCounts, checkAdmin } = require('./common-bundle')

exports.main = wrap(async () => {
  const db = getDB()
  const _ = getCmd()
  const now = new Date()

  // 调用方守卫（fail-closed）：定时触发器上下文无 OPENID → 放行；
  // 客户端 callFunction → 仅管理员，防重复归档/对账滥用。
  const wxContext = cloud.getWXContext()
  const callerOpenid = wxContext && wxContext.OPENID
  if (callerOpenid) {
    const isAdmin = await checkAdmin(db, callerOpenid)
    if (!isAdmin) throw new AppError('仅定时触发器或管理员可执行该任务', 'FORBIDDEN')
  }

  // 已解决的任务不进过期页 — resolved 字段可能不存在（旧数据），用 neq(true) 兼容
  const res = await db.collection('posts')
    .where({
      kind: 'task',
      status: 'normal',
      expireAt: _.lt(now),
      resolved: _.neq(true)
    })
    .update({ data: { status: 'expired', expiredAt: now } })

  const expired = (res && res.stats && res.stats.updated) || 0

  // 顺带对账：修正因软删与计数回退非事务导致的 postCount/productCount 漂移
  // best-effort：对账失败不影响归档结果返回，仅留痕
  let reconcile = null
  try {
    reconcile = await reconcileUserCounts(db)
  } catch (e) {
    console.error('[task-expire] 计数对账失败(不影响归档):', e && (e.errMsg || e.message))
  }

  // 过期日志清理（best-effort，云开发无自动 TTL，本 cron 兜底）：
  //   view_logs 保留 90 天（按 createdAt 判定，存量/增量统一覆盖）；
  //   rate_limits 清 expireAt 已过的窗口占位文档。每次各最多 500 条，剩余留给下次触发。
  let cleaned = 0
  try {
    const oldViews = await db.collection('view_logs')
      .where({ createdAt: _.lt(new Date(now.getTime() - 90 * 86400000)) })
      .limit(500).get()
    for (const d of (oldViews.data || [])) {
      await db.collection('view_logs').doc(d._id).remove()
      cleaned++
    }
    const oldRates = await db.collection('rate_limits')
      .where({ expireAt: _.lt(now) })
      .limit(500).get()
    for (const d of (oldRates.data || [])) {
      await db.collection('rate_limits').doc(d._id).remove()
      cleaned++
    }
  } catch (e) {
    console.error('[task-expire] 过期日志清理失败(不影响归档):', e && (e.errMsg || e.message))
  }

  return ok({ checked: expired, expired, cleaned, reconcile })
})
