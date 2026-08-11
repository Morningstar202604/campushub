// cloudfunctions/comment-list/index.js
// 评论列表：分页 + 楼中楼（parentId 为 null 的是主楼层，有 parentId 的是子回复）
const { getDB, getCmd, AppError, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { targetId, page = 1, pageSize = 20 } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

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
    .limit(200) // 每页最多加载 200 条子回复
    .get()

  const replies = replyRes.data || []

  // 将子回复挂到对应楼层下
  const replyMap = {}
  for (const r of replies) {
    if (!replyMap[r.parentId]) replyMap[r.parentId] = []
    replyMap[r.parentId].push(r)
  }

  const list = floors.map(f => ({
    ...f,
    replies: replyMap[f._id] || []
  }))

  return ok({ list, hasMore: floorRes.data.length === size })
})
