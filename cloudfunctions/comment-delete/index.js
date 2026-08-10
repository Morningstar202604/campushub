// cloudfunctions/comment-delete/index.js
// 删除评论：统一经 removeContent（软删除 + 归属校验/管理员 + 目标评论数回退）
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser, requireActive, removeContent } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const { commentId } = event
  if (!commentId) throw new AppError('缺少评论ID', 'INVALID_PARAM')

  await removeContent({ collection: 'comments', docId: commentId, actor: user, opts: { targetComment: true } })
  return ok({ deleted: true })
})
