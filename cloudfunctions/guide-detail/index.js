// cloudfunctions/guide-detail/index.js
const { getDB, AppError, ok, wrap, countViewOnce } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { guideId } = event
  if (!guideId) throw new AppError('缺少指南ID', 'INVALID_PARAM')

  const res = await db.collection('guides').doc(guideId).get().catch(() => ({ data: null }))
  const guide = res.data
  if (!guide) throw new AppError('指南不存在', 'NOT_FOUND')
  if (guide.status !== 'published') throw new AppError('该指南暂未发布', 'NOT_FOUND')

  // 浏览量按 (openid, 文档, 自然日) 去重自增（匿名可浏览，无 openid 时忽略计数）
  const viewed = await countViewOnce('guides', guideId)
  if (viewed) guide.viewCount = (guide.viewCount || 0) + 1

  return ok({ guide })
})
