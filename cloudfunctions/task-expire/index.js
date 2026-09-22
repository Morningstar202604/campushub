// cloudfunctions/task-expire/index.js
// 定时任务：将超时未解决的任务/请求帖置为 expired
// （不推主页、进「过期」页；已解决的不进过期页）
// 降本 C3：信息流已在 post-list 读侧惰性排除过期任务，
// 本 cron 仅作归档兜底（过期页可见性），降频为每 6 小时执行一次。
// 实现：一条 where 条件批量 update 替代逐条循环——无 limit(100) 吞吐瓶颈，调用次数最少。
// 降本 C3 + 计数对账：顺带跑一次 reconcileUserCounts 兜底修正 post/product 计数漂移
// （best-effort，失败仅告警不阻断归档主流程——对账是低频兜底，非关键路径）。
const { getDB, getCmd, ok, wrap, reconcileUserCounts } = require('./common-bundle')

exports.main = wrap(async () => {
  const db = getDB()
  const _ = getCmd()
  const now = new Date()

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

  return ok({ checked: expired, expired, reconcile })
})
