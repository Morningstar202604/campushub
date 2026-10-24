// cloudfunctions/comment-list/index.js
// 评论列表：分页 + 楼中楼（parentId 为 null 的是主楼层，有 parentId 的是子回复）
// 回填当前用户对楼层/子回复的点赞状态（liked），前端据此渲染与取消点赞。
// 黑名单：登录用户看不到自己拉黑的人发的楼层与回复（读侧过滤，见 common-blocklist）。
const {
  getDB,
  getCmd,
  AppError,
  ok,
  wrap,
  getOptionalUser,
  blockedUserIds
} = require('./common-bundle')

function toInt(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

/**
 * 当前用户在本页评论上的点赞 id 集合；未登录/查不到用户 → null（全部视为未赞）。
 * 身份由调用方传入（getOptionalUser 已按 resolveIdentity 解析）——
 * 旧实现读 getWXContext().OPENID，H5/APK 恒空，评论点赞在 H5 永远显示未点亮。
 */
async function backfillLikedSet(db, viewerId, floorIds, replies) {
  if (!viewerId) return null
  try {
    const allIds = [...floorIds, ...replies.map((r) => r._id)]
    if (!allIds.length) return new Set()
    const likedRes = await db
      .collection('likes')
      .where({ userId: viewerId, targetId: getCmd().in(allIds), type: 'comment' })
      .field({ targetId: true })
      .get()
    return new Set((likedRes.data || []).map((l) => l.targetId))
  } catch {
    // 查询失败降级：全部视为未赞
    return null
  }
}

module.exports = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { targetId, cursor } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')
  const page = Math.max(1, toInt(event.page, 1))
  const size = Math.min(50, Math.max(1, toInt(event.pageSize, 20)))
  const skip = (page - 1) * size
  // 游标分页（深翻页优化）：楼层按时间正序，cursor=上一页最后一条 createdAt
  const cursorDate = cursor ? new Date(String(cursor)) : null
  const useCursor = !!(cursorDate && !isNaN(cursorDate.getTime()))

  // 获取主楼层（parentId 为 null 或不存在）
  const floorWhere = { targetId, status: 'normal', parentId: _.or(_.eq(null), _.exists(false)) }
  if (useCursor) floorWhere.createdAt = _.gt(cursorDate)
  const floorRes = await db
    .collection('comments')
    .where(floorWhere)
    .orderBy('createdAt', 'asc')
    .skip(useCursor ? 0 : skip)
    .limit(size)
    .get()

  const floors = floorRes.data || []
  if (floors.length === 0) return ok({ list: [], hasMore: false })

  // 获取这些楼层的子回复（parentId 在这些楼层 id 中）
  const floorIds = floors.map((f) => f._id)
  const replyRes = await db
    .collection('comments')
    .where({ parentId: _.in(floorIds), status: 'normal' })
    .orderBy('createdAt', 'asc')
    .limit(500) // 子回复上限（超出极罕见；如需严格分页后续按楼层分组续拉）
    .get()

  const replies = replyRes.data || []

  // 将子回复挂到对应楼层下
  const replyMap = {}
  for (const r of replies) {
    if (!replyMap[r.parentId]) replyMap[r.parentId] = []
    replyMap[r.parentId].push(r)
  }

  // 点赞状态回填：查出当前用户在本页全部评论上的点赞记录
  // （身份只取一次：getOptionalUser 已按 resolveIdentity 解析，兼容小程序 OPENID 与 H5/APK 设备令牌）
  const viewer = await getOptionalUser()
  const likedSet = await backfillLikedSet(db, viewer && viewer._id, floorIds, replies)

  // 黑名单过滤：拉黑的人发的楼层与整条回复串都不展示（读侧，拉黑方视角）。
  // 在挂载完成后过滤，父楼层被滤掉时其子回复随之消失，不会留孤儿楼层。
  const blocked = new Set(await blockedUserIds(viewer && viewer._id))
  const visible = (c) => !blocked.has(c.userId)

  const markLiked = (c) => ({ ...c, liked: likedSet ? likedSet.has(c._id) : false })

  const list = floors.filter(visible).map((f) => ({
    ...markLiked(f),
    replies: (replyMap[f._id] || []).filter(visible).map(markLiked)
  }))

  return ok({ list, hasMore: floors.length === size })
})
