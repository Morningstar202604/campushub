// cloudfunctions/follow/index.js
// 关注/取关 + 关注状态查询 + 关注/粉丝列表
// follows 集合: { followerId, followingId, createdAt }
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()
  const { action = 'follow', targetUserId, page = 1, pageSize = 20 } = event

  const pSize = Math.min(100, Math.max(1, Number(pageSize)))
  const skip = Math.max(0, (Number(page) - 1) * pSize)

  // ---- 关注 / 取关 ----
  if (action === 'follow' || action === 'unfollow') {
    if (!targetUserId) throw new AppError('缺少目标用户ID', 'INVALID_PARAM')
    if (targetUserId === user._id) throw new AppError('不能关注自己', 'INVALID_PARAM')

    await rateLimit({ collection: 'follows', match: { followerId: user._id }, windowMs: 10000, max: 20 })

    // 验证目标用户存在
    const targetRes = await db.collection('users').doc(targetUserId).get().catch(() => ({ data: null }))
    if (!targetRes || !targetRes.data) throw new AppError('目标用户不存在', 'NOT_FOUND')

    if (action === 'follow') {
      // 检查是否已关注
      const existing = await db.collection('follows')
        .where({ followerId: user._id, followingId: targetUserId })
        .count()
      if (existing.total > 0) throw new AppError('已关注该用户', 'ALREADY')

      await db.collection('follows').add({
        data: { followerId: user._id, followingId: targetUserId, createdAt: new Date() }
      })
      // 更新双方计数
      await db.collection('users').doc(user._id).update({ data: { followingCount: _.inc(1) } })
      await db.collection('users').doc(targetUserId).update({ data: { followerCount: _.inc(1) } })
      return ok({ following: true })
    } else {
      // 取关：仅当存在时才删除 + 扣减
      const existing = await db.collection('follows')
        .where({ followerId: user._id, followingId: targetUserId })
        .count()
      if (existing.total === 0) return ok({ following: false })

      await db.collection('follows')
        .where({ followerId: user._id, followingId: targetUserId })
        .remove()
      await db.collection('users').doc(user._id).update({ data: { followingCount: _.inc(-1) } })
      await db.collection('users').doc(targetUserId).update({ data: { followerCount: _.inc(-1) } })
      return ok({ following: false })
    }
  }

  // ---- 查询关注状态 ----
  if (action === 'check') {
    if (!targetUserId) throw new AppError('缺少目标用户ID', 'INVALID_PARAM')
    const res = await db.collection('follows')
      .where({ followerId: user._id, followingId: targetUserId })
      .count()
    return ok({ isFollowing: res.total > 0 })
  }

  // ---- 我的关注列表 ----
  if (action === 'following') {
    const targetId = targetUserId || user._id
    const [listRes, totalRes] = await Promise.all([
      db.collection('follows')
        .where({ followerId: targetId })
        .orderBy('createdAt', 'desc').skip(skip).limit(pSize).field({ followingId: true, createdAt: true }).get(),
      db.collection('follows').where({ followerId: targetId }).count()
    ])
    // batch-fetch user profiles
    const ids = (listRes.data || []).map(d => d.followingId)
    let users = []
    if (ids.length) {
      const userRes = await db.collection('users')
        .where({ _id: _.in(ids) })
        .field({ _id: true, nickname: true, avatar: true, school: true, bio: true })
        .get()
      users = userRes.data || []
    }
    return ok({ list: users, total: totalRes.total, page, pageSize: pSize })
  }

  // ---- 粉丝列表 ----
  if (action === 'followers') {
    const targetId = targetUserId || user._id
    const [listRes, totalRes] = await Promise.all([
      db.collection('follows')
        .where({ followingId: targetId })
        .orderBy('createdAt', 'desc').skip(skip).limit(pSize).field({ followerId: true, createdAt: true }).get(),
      db.collection('follows').where({ followingId: targetId }).count()
    ])
    const ids = (listRes.data || []).map(d => d.followerId)
    let users = []
    if (ids.length) {
      const userRes = await db.collection('users')
        .where({ _id: _.in(ids) })
        .field({ _id: true, nickname: true, avatar: true, school: true, bio: true })
        .get()
      users = userRes.data || []
    }
    return ok({ list: users, total: totalRes.total, page, pageSize: pSize })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
