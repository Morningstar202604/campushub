// cloudfunctions/comment-create/index.js
// 评论：统一鉴权 + fail-closed 内容安全 + 频率限制 + 目标存在性校验
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const { targetId, targetType = 'post', content, replyToUserId, replyToNickname } = event

  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')
  if (!content || !content.trim()) throw new AppError('请输入评论内容', 'INVALID_PARAM')
  if (content.length > 500) throw new AppError('评论不能超过500字', 'INVALID_PARAM')

  // 目标集合校验
  const collection = targetType === 'post' ? 'posts' : 'products'
  const targetRes = await db.collection(collection).doc(targetId).get()
  if (!targetRes || !targetRes.data) throw new AppError('评论的对象不存在', 'NOT_FOUND')

  // 内容安全：fail-closed
  await checkContents([content], { openid: user.openid, scene: 2 })
  // 频率限制：10秒内最多3条
  await rateLimit({ collection: 'comments', match: { userId: user._id }, windowMs: 10000, max: 3 })

  const comment = {
    targetId,
    targetType,
    userId: user._id,
    userNickname: user.nickname,
    userAvatar: user.avatar,
    content: content.trim(),
    replyToUserId: replyToUserId || '',
    replyToNickname: replyToNickname || '',
    likeCount: 0,
    status: 'normal',
    createdAt: new Date()
  }

  const addRes = await db.collection('comments').add({ data: comment })

  // 评论数 +1（软删除内容不计）
  await db.collection(collection).doc(targetId).update({ data: { commentCount: _.inc(1) } })

  return ok({ commentId: addRes._id, comment })
})
