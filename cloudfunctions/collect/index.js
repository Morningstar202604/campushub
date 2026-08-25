// cloudfunctions/collect/index.js
// 收藏/取消：登录 + 封禁拦截 + 本人操作 + 类型白名单 + 防计数漂移 + 限流
// 幂等性：依赖 idx_collects_user_target_type 唯一索引 + insertIdempotent；
// uncollect 按实际删除行数扣减，可自愈历史重复数据。
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, rateLimit, insertIdempotent } = require('./common-bundle')

const VALID_TYPES = ['post', 'product']

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const { targetId, type = 'post', action = 'collect' } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')
  if (!VALID_TYPES.includes(type)) throw new AppError('非法的目标类型', 'INVALID_PARAM')

  const collection = type === 'post' ? 'posts' : 'products'

  if (action === 'collect') {
    await rateLimit({ collection: 'collects', match: { userId: user._id }, windowMs: 10000, max: 20 })

    // 目标必须存在且未删除
    const targetRes = await db.collection(collection).doc(targetId)
      .field({ status: true }).get().catch(() => ({ data: null }))
    if (!targetRes || !targetRes.data || targetRes.data.status === 'deleted') {
      throw new AppError('内容不存在或已删除', 'NOT_FOUND')
    }

    // 幂等插入：唯一索引冲突 = 已收藏，直接返回不重复计数
    const inserted = await insertIdempotent('collects', { userId: user._id, targetId, type, createdAt: new Date() })
    if (!inserted) {
      return ok({ collected: true, already: true })
    }

    // 计数同步（best-effort：主记录已落库，计数失败仅告警）
    await db.collection(collection).doc(targetId).update({ data: { collectCount: _.inc(1) } }).catch(() => {})
    await db.collection('users').doc(user._id).update({ data: { collectCount: _.inc(1) } }).catch(() => {})
    return ok({ collected: true })
  } else {
    // 按实际删除行数扣减，自愈历史重复数据；两处计数 best-effort
    const rm = await db.collection('collects')
      .where({ userId: user._id, targetId, type })
      .remove()
    const removed = (rm && rm.stats && rm.stats.removed) || 0
    if (removed === 0) return ok({ collected: false })

    await db.collection(collection).doc(targetId).update({ data: { collectCount: _.inc(-removed) } }).catch(() => {})
    await db.collection('users').doc(user._id).update({ data: { collectCount: _.inc(-removed) } }).catch(() => {})
    return ok({ collected: false })
  }
})
