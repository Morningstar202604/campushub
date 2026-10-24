// cloudfunctions/report/index.js
// 举报：登录 + 封禁拦截 + 内容安全 + 频率限制 + 类型白名单 + 防重复举报
// 支持 post / product / comment / message 四类目标。
// message（站内私信）只能由会话双方举报，且进入同一审核队列 —— 私信同样是 UGC，
// 只做发送侧 msgSecCheck 无法覆盖「事后骚扰」场景。
const {
  getDB,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  checkContents,
  rateLimit
} = require('./common-bundle')

const VALID_TARGET_TYPES = ['post', 'product', 'comment', 'message']

/** 目标必须存在；message 额外校验举报人是会话参与方（防任意用户举报他人私信） */
async function assertTargetExists(db, { targetId, targetType, userId }) {
  if (targetType === 'message') {
    const res = await db
      .collection('messages')
      .doc(targetId)
      .get()
      .catch(() => ({ data: null }))
    const msg = res && res.data
    if (!msg) throw new AppError('私信不存在', 'NOT_FOUND')
    if (msg.fromUserId !== userId && msg.toUserId !== userId) {
      throw new AppError('无权举报该私信', 'FORBIDDEN')
    }
    return
  }
  const col = targetType === 'post' ? 'posts' : targetType === 'product' ? 'products' : 'comments'
  const res = await db
    .collection(col)
    .doc(targetId)
    .field({ _id: true, status: true })
    .get()
    .catch(() => ({ data: null }))
  if (!res || !res.data) throw new AppError('举报对象不存在', 'NOT_FOUND')
}

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { targetId, targetType = 'post', reason, description = '' } = event
  // 统一 String 化：description 可为 null/数字，避免 .length 抛 TypeError
  const safeDescription = String(description == null ? '' : description)
  if (!targetId || !reason) throw new AppError('缺少必要参数', 'INVALID_PARAM')
  if (!VALID_TARGET_TYPES.includes(targetType))
    throw new AppError('非法的目标类型', 'INVALID_PARAM')
  if (safeDescription.length > 500) throw new AppError('补充说明不能超过500字', 'INVALID_PARAM')

  await assertTargetExists(db, { targetId, targetType, userId: user._id })

  // 防重复举报：同一用户对同一目标只允许一次 pending 举报
  const dupCheck = await db
    .collection('reports')
    .where({ reporterId: user._id, targetId, targetType, status: 'pending' })
    .count()
  if (dupCheck.total > 0) throw new AppError('您已举报过该内容，请等待处理', 'ALREADY')

  await rateLimit({
    collection: 'reports',
    match: { reporterId: user._id },
    windowMs: 60000,
    max: 5
  })
  await checkContents([reason, safeDescription], { openid: user.openid, scene: 2 })

  await db.collection('reports').add({
    data: {
      targetId,
      targetType,
      reporterId: user._id,
      reason: String(reason).slice(0, 100),
      description: safeDescription.slice(0, 500),
      status: 'pending',
      createdAt: new Date()
    }
  })

  return ok({ message: '举报已提交，我们会尽快处理' })
})
