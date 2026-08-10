// cloudfunctions/post-delete/index.js
// 删除帖子：软删除（status='deleted'）+ 归属校验/管理员 + 计数回退
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser, requireActive } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const db = getDB()
  const _ = getCmd()

  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  const res = await db.collection('posts').doc(postId).get()
  const post = res.data
  if (!post) throw new AppError('帖子不存在', 'NOT_FOUND')
  if (post.userId !== user._id && user.role !== 'admin') {
    throw new AppError('无权删除该内容', 'FORBIDDEN')
  }
  if (post.status === 'deleted') return ok({ deleted: true })

  await db.collection('posts').doc(postId).update({ data: { status: 'deleted', updatedAt: new Date() } })
  await db.collection('users').doc(post.userId).update({ data: { postCount: _.inc(-1) } }).catch(() => {})

  return ok({ deleted: true })
})
