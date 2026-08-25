// cloudfunctions/report/index.js
// 举报：登录 + 封禁拦截 + 内容安全 + 频率限制 + 类型白名单 + 防重复举报
// 写操作统一经 requireActiveUser，封禁用户不可提交举报
const { getDB, AppError, ok, wrap, requireActiveUser, checkContents, rateLimit } = require('./common-bundle')

const VALID_TARGET_TYPES = ['post', 'product', 'comment']

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { targetId, targetType = 'post', reason, description = '' } = event
  if (!targetId || !reason) throw new AppError('缺少必要参数', 'INVALID_PARAM')
  if (!VALID_TARGET_TYPES.includes(targetType)) throw new AppError('非法的目标类型', 'INVALID_PARAM')
  if (description.length > 500) throw new AppError('补充说明不能超过500字', 'INVALID_PARAM')

  // 防重复举报：同一用户对同一目标只允许一次 pending 举报
  const dupCheck = await db.collection('reports')
    .where({ reporterId: user._id, targetId, targetType, status: 'pending' })
    .count()
  if (dupCheck.total > 0) throw new AppError('您已举报过该内容，请等待处理', 'ALREADY')

  await checkContents([reason, description], { openid: user.openid, scene: 2 })
  await rateLimit({ collection: 'reports', match: { reporterId: user._id }, windowMs: 60000, max: 5 })

  await db.collection('reports').add({
    data: {
      targetId,
      targetType,
      reporterId: user._id,
      reason: String(reason).slice(0, 100),
      description: String(description).slice(0, 500),
      status: 'pending',
      createdAt: new Date()
    }
  })

  return ok({ message: '举报已提交，我们会尽快处理' })
})
