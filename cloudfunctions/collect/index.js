// cloudfunctions/collect/index.js
// 收藏/取消：登录 + 封禁拦截 + 本人操作
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const { targetId, type = 'post', action = 'collect' } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')

  const collection = type === 'post' ? 'posts' : 'products'

  if (action === 'collect') {
    const existing = await db.collection('collects').where({ userId: user._id, targetId, type }).count()
    if (existing.total > 0) throw new AppError('已收藏过', 'ALREADY')

    await db.collection('collects').add({ data: { userId: user._id, targetId, type, createdAt: new Date() } })
    await db.collection(collection).doc(targetId).update({ data: { collectCount: _.inc(1) } })
    return ok({ collected: true })
  } else {
    await db.collection('collects').where({ userId: user._id, targetId, type }).remove()
    await db.collection(collection).doc(targetId).update({ data: { collectCount: _.inc(-1) } })
    return ok({ collected: false })
  }
})
