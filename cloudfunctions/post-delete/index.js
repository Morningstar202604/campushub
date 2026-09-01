// cloudfunctions/post-delete/index.js
// 删除帖子：统一经 removeContent（软删除 + 归属校验/管理员 + 计数回退 + 回收云存储图片）
const { AppError, ok, wrap, getCurrentUser, requireActive, removeContent } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  await removeContent({ collection: 'posts', docId: postId, actor: user, opts: { userCountField: 'postCount' } })
  return ok({ deleted: true })
})
