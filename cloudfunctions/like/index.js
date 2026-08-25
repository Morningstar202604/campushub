// cloudfunctions/like/index.js
// 点赞/取消：登录 + 封禁拦截 + 本人操作 + 类型白名单 + 防计数漂移 + 限流
// 支持帖子、商品、评论三种类型。
// 幂等性：依赖 idx_likes_user_target_type 唯一索引 + insertIdempotent，
// 并发双击只有一次插入生效；unlike 按 removed 数扣减，可自愈历史重复数据。
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, rateLimit, insertIdempotent } = require('./common-bundle')

const VALID_TYPES = ['post', 'product', 'comment']
// 类型 → 集合名 + 计数字段
const TYPE_MAP = {
  post: { col: 'posts', countField: 'likeCount' },
  product: { col: 'products', countField: 'likeCount' },
  comment: { col: 'comments', countField: 'likeCount' }
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const { targetId, type = 'post', action = 'like' } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')
  if (!VALID_TYPES.includes(type)) throw new AppError('非法的目标类型', 'INVALID_PARAM')

  const cfg = TYPE_MAP[type]

  if (action === 'like') {
    // 限流：防刷赞
    await rateLimit({ collection: 'likes', match: { userId: user._id }, windowMs: 10000, max: 20 })

    // 目标必须存在且未删除（防孤儿点赞）
    const targetRes = await db.collection(cfg.col).doc(targetId)
      .field({ userId: true, title: true, status: true }).get().catch(() => ({ data: null }))
    const targetDoc = targetRes && targetRes.data
    if (!targetDoc || targetDoc.status === 'deleted') throw new AppError('内容不存在或已删除', 'NOT_FOUND')

    // 幂等插入：唯一索引冲突 = 已点赞，直接返回不重复计数
    const inserted = await insertIdempotent('likes', { userId: user._id, targetId, type, createdAt: new Date() })
    if (!inserted) {
      return ok({ liked: true, already: true })
    }

    await db.collection(cfg.col).doc(targetId).update({ data: { [cfg.countField]: _.inc(1) } })

    // 站内通知：通知作者被点赞（不通知自己）
    try {
      if (targetDoc.userId !== user._id) {
        await db.collection('notifications').add({
          data: {
            userId: targetDoc.userId,
            type: 'like',
            // targetType 用于前端路由到正确的详情页（帖子/商品）
            targetType: type,
            content: `${user.nickname} 赞了你的内容`,
            targetId,
            isRead: false,
            createdAt: new Date()
          }
        })
      }
    } catch (e) {}

    return ok({ liked: true })
  } else {
    // 仅当确实存在记录时才删除 + 扣减；按实际删除行数扣，自愈历史重复数据
    const rm = await db.collection('likes')
      .where({ userId: user._id, targetId, type })
      .remove()
    const removed = (rm && rm.stats && rm.stats.removed) || 0
    if (removed === 0) return ok({ liked: false })

    await db.collection(cfg.col).doc(targetId).update({ data: { [cfg.countField]: _.inc(-removed) } })
    return ok({ liked: false })
  }
})
