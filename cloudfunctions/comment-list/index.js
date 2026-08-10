// cloudfunctions/comment-list/index.js
const { getDB, AppError, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { targetId, page = 1, pageSize = 50 } = event
  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  const res = await db.collection('comments')
    .where({ targetId, status: 'normal' })
    .orderBy('createdAt', 'asc').skip(skip).limit(size).get()

  return ok({ list: res.data, hasMore: res.data.length === size })
})
