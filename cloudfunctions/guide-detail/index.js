// cloudfunctions/guide-detail/index.js
const { getDB, getCmd, AppError, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { guideId } = event
  if (!guideId) throw new AppError('缺少指南ID', 'INVALID_PARAM')

  const res = await db.collection('guides').doc(guideId).get()
  const guide = res.data
  if (!guide) throw new AppError('指南不存在', 'NOT_FOUND')

  await db.collection('guides').doc(guideId).update({ data: { viewCount: _.inc(1) } })
  guide.viewCount = (guide.viewCount || 0) + 1

  return ok({ guide })
})
