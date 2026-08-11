// cloudfunctions/collect/index.js
// 收藏/取消：登录 + 封禁拦截 + 本人操作 + 类型白名单 + 防计数漂移 + 限流
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, rateLimit } = require('./common-bundle')

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
    const existing = await db.collection('collects').where({ userId: user._id, targetId, type }).count()
    if (existing.total > 0) throw new AppError('已收藏过', 'ALREADY')

    await db.collection('collects').add({ data: { userId: user._id, targetId, type, createdAt: new Date() } })
    await db.collection(collection).doc(targetId).update({ data: { collectCount: _.inc(1) } })
    // 同步用户收藏计数
    await db.collection('users').doc(user._id).update({ data: { collectCount: _.inc(1) } })
    return ok({ collected: true })
  } else {
    // 仅当确实存在记录时才删除 + 扣减，防止计数漂移至负数
    const existing = await db.collection('collects').where({ userId: user._id, targetId, type }).count()
    if (existing.total === 0) return ok({ collected: false })

    await db.collection('collects').where({ userId: user._id, targetId, type }).remove()
    await db.collection(collection).doc(targetId).update({ data: { collectCount: _.inc(-1) } })
    // 同步用户收藏计数
    await db.collection('users').doc(user._id).update({ data: { collectCount: _.inc(-1) } })
    return ok({ collected: false })
  }
})
