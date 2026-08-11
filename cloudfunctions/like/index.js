// cloudfunctions/like/index.js
// 点赞/取消：登录 + 封禁拦截 + 本人操作 + 类型白名单 + 防计数漂移 + 限流
// 支持帖子、商品、评论三种类型
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, rateLimit } = require('./common-bundle')

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
    const existing = await db.collection('likes').where({ userId: user._id, targetId, type }).count()
    if (existing.total > 0) throw new AppError('已点赞过', 'ALREADY')

    await db.collection('likes').add({ data: { userId: user._id, targetId, type, createdAt: new Date() } })
    await db.collection(cfg.col).doc(targetId).update({ data: { [cfg.countField]: _.inc(1) } })

    // 站内通知：通知作者被点赞（不通知自己）
    try {
      const target = await db.collection(cfg.col).doc(targetId).field({ userId: true, title: true }).get()
      if (target.data && target.data.userId !== user._id) {
        await db.collection('notifications').add({
          data: { userId: target.data.userId, type: 'like', content: `${user.nickname} 赞了你的内容`, targetId, isRead: false, createdAt: new Date() }
        })
      }
    } catch (e) {}

    return ok({ liked: true })
  } else {
    // 仅当确实存在记录时才删除 + 扣减，防止计数漂移至负数
    const existing = await db.collection('likes').where({ userId: user._id, targetId, type }).count()
    if (existing.total === 0) return ok({ liked: false })

    await db.collection('likes').where({ userId: user._id, targetId, type }).remove()
    await db.collection(cfg.col).doc(targetId).update({ data: { [cfg.countField]: _.inc(-1) } })
    return ok({ liked: false })
  }
})
