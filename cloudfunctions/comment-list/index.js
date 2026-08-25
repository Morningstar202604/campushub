// cloudfunctions/comment-list/index.js
// 评论列表：分页 + 楼中楼（parentId 为 null 的是主楼层，有 parentId 的是子回复）
// 回填当前用户对楼层/子回复的点赞状态（liked），前端据此渲染与取消点赞。
const { getDB, getCmd, AppError, ok, wrap, cloud } = require('./common-bundle')

function toInt(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { targetId } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')
  const page = Math.max(1, toInt(event.page, 1))
  const size = Math.min(50, Math.max(1, toInt(event.pageSize, 20)))
  const skip = (page - 1) * size

  // 获取主楼层（parentId 为 null 或不存在）
  const floorRes = await db.collection('comments')
    .where({ targetId, status: 'normal', parentId: _.or(_.eq(null), _.exists(false)) })
    .orderBy('createdAt', 'asc').skip(skip).limit(size).get()

  const floors = floorRes.data || []
  if (floors.length === 0) return ok({ list: [], hasMore: false })

  // 获取这些楼层的子回复（parentId 在这些楼层 id 中）
  const floorIds = floors.map(f => f._id)
  const replyRes = await db.collection('comments')
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
  let likedSet = null
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext && wxContext.OPENID
    if (openid) {
      const u = await db.collection('users').where({ openid }).field({ _id: true }).limit(1).get()
      if (u.data && u.data[0]) {
        const viewerId = u.data[0]._id
        const allIds = [...floorIds, ...replies.map(r => r._id)]
        const likedRes = await db.collection('likes')
          .where({ userId: viewerId, targetId: _.in(allIds), type: 'comment' })
          .field({ targetId: true }).get()
        likedSet = new Set((likedRes.data || []).map(l => l.targetId))
      }
    }
  } catch (e) {
    // 未登录等场景静默降级：全部视为未赞
    likedSet = null
  }

  const markLiked = (c) => ({ ...c, liked: likedSet ? likedSet.has(c._id) : false })

  const list = floors.map(f => ({
    ...markLiked(f),
    replies: (replyMap[f._id] || []).map(markLiked)
  }))

  return ok({ list, hasMore: floors.length === size })
})
