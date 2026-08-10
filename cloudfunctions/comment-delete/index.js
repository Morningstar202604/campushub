// cloudfunctions/comment-delete/index.js
// 删除评论：软删除 + 归属校验/管理员 + 目标评论数回退
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser, requireActive } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const db = getDB()
  const _ = getCmd()

  const { commentId } = event
  if (!commentId) throw new AppError('缺少评论ID', 'INVALID_PARAM')

  const res = await db.collection('comments').doc(commentId).get()
  const comment = res.data
  if (!comment) throw new AppError('评论不存在', 'NOT_FOUND')
  if (comment.userId !== user._id && user.role !== 'admin') {
    throw new AppError('无权删除该内容', 'FORBIDDEN')
  }
  if (comment.status === 'deleted') return ok({ deleted: true })

  await db.collection('comments').doc(commentId).update({ data: { status: 'deleted', updatedAt: new Date() } })
  // 回退目标评论数（仅当原评论处于 normal 时减）
  if (comment.status === 'normal') {
    const collection = comment.targetType === 'post' ? 'posts' : 'products'
    await db.collection(collection).doc(comment.targetId).update({ data: { commentCount: _.inc(-1) } }).catch(() => {})
  }

  return ok({ deleted: true })
})
