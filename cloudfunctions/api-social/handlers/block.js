// cloudfunctions/block/index.js
// 拉黑/取消拉黑 + 拉黑状态查询 + 黑名单列表
// blocks 集合: { blockerId, blockedId, createdAt }
//
// 语义（与关注 follow 对齐的形态，但方向相反）：
//   - 拉黑是**单向**的：拉黑方在读接口看不到对方内容（过滤见 post-list /
//     product-list / comment-list，经 common-blocklist），对方无感知、内容不删。
//   - 不写任何通知：告诉对方"你被拉黑了"只会挑起二次矛盾。
//   - 幂等：依赖 idx_blocks_blocker_blocked 唯一索引 + insertIdempotent，
//     并发双点只有一次插入生效，重复按「已拉黑」返回（不撞唯一键抛 500）。
const {
  getDB,
  getCmd,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  rateLimit,
  insertIdempotent
} = require('./common-bundle')

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()
  const { action = 'block', targetUserId, page = 1, pageSize = 20 } = event

  const pSize = Math.min(100, Math.max(1, Number(pageSize)))
  const skip = Math.max(0, (Number(page) - 1) * pSize)

  // ---- 拉黑 / 取消拉黑 ----
  if (action === 'block' || action === 'unblock') {
    if (!targetUserId) throw new AppError('缺少目标用户ID', 'INVALID_PARAM')
    if (targetUserId === user._id) throw new AppError('不能拉黑自己', 'INVALID_PARAM')

    await rateLimit({
      collection: 'blocks',
      match: { blockerId: user._id },
      windowMs: 10000,
      max: 20
    })

    // 目标用户必须存在（与 follow 一致：防止往黑名单里塞任意 id 撑集合）
    const targetRes = await db
      .collection('users')
      .doc(targetUserId)
      .get()
      .catch(() => ({ data: null }))
    if (!targetRes || !targetRes.data) throw new AppError('目标用户不存在', 'NOT_FOUND')

    if (action === 'unblock') {
      await db.collection('blocks').where({ blockerId: user._id, blockedId: targetUserId }).remove()
      return ok({ blocked: false })
    }

    const inserted = await insertIdempotent('blocks', {
      blockerId: user._id,
      blockedId: targetUserId,
      createdAt: new Date()
    })
    return ok({ blocked: true, already: !inserted })
  }

  // ---- 查询是否已拉黑某用户 ----
  if (action === 'check') {
    if (!targetUserId) throw new AppError('缺少目标用户ID', 'INVALID_PARAM')
    const res = await db
      .collection('blocks')
      .where({ blockerId: user._id, blockedId: targetUserId })
      .count()
    return ok({ isBlocked: res.total > 0 })
  }

  // ---- 我的黑名单（分页 + 用户资料批量回填，形态同 follow 列表）----
  if (action === 'list') {
    const [listRes, totalRes] = await Promise.all([
      db
        .collection('blocks')
        .where({ blockerId: user._id })
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pSize)
        .field({ blockedId: true, createdAt: true })
        .get(),
      db.collection('blocks').where({ blockerId: user._id }).count()
    ])
    const ids = (listRes.data || []).map((d) => d.blockedId)
    let users = []
    if (ids.length) {
      const userRes = await db
        .collection('users')
        .where({ _id: _.in(ids) })
        .field({ _id: true, nickname: true, avatar: true, school: true, bio: true })
        .get()
      users = userRes.data || []
    }
    return ok({ list: users, total: totalRes.total, page, pageSize: pSize })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
