// cloudfunctions/post-delete/index.js
// 删除帖子：统一经 removeContent（软删除 + 归属校验/管理员 + 计数回退 + 回收云存储图片）
const { AppError, ok, wrap, getCurrentUser, requireActive, removeContent, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  // 频率限制：60 秒内最多 20 次删除（含误删重试），防止批量删除脚本打穿数据库写配额
  await rateLimit({ collection: 'post-delete', match: { userId: user._id }, windowMs: 60000, max: 20 })

  await removeContent({ collection: 'posts', docId: postId, actor: user, opts: { userCountField: 'postCount' } })
  return ok({ deleted: true })
})
