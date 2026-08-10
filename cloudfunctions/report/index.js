// cloudfunctions/report/index.js
// 举报：登录即可 + 内容安全 + 频率限制
const { getDB, AppError, ok, wrap, getCurrentUser, checkContents, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  const db = getDB()

  const { targetId, targetType = 'post', reason, description = '' } = event
  if (!targetId || !reason) throw new AppError('缺少必要参数', 'INVALID_PARAM')

  await checkContents([reason, description], { openid: user.openid, scene: 2 })
  await rateLimit({ collection: 'reports', match: { reporterId: user._id }, windowMs: 60000, max: 5 })

  await db.collection('reports').add({
    data: {
      targetId,
      targetType,
      reporterId: user._id,
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    }
  })

  return ok({ message: '举报已提交，我们会尽快处理' })
})
