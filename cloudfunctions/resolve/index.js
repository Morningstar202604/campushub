// cloudfunctions/resolve/index.js
// 将任务/请求帖标记为「已解决」（仅作者本人或管理员）
const { getDB, AppError, ok, wrap, requireActiveUser, checkAdmin } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  const postRes = await db.collection('posts').doc(postId).get().catch(() => ({ data: null }))
  if (!postRes || !postRes.data) throw new AppError('帖子不存在', 'NOT_FOUND')
  const p = postRes.data

  if (p.kind !== 'task') {
    throw new AppError('仅任务/请求类内容可标记已解决', 'INVALID_PARAM')
  }
  if (p.resolved) return ok({ resolved: true, already: true })

  // 作者本人，或管理员
  const isAuthor = p.userId === user._id
  if (!isAuthor) {
    const isAdmin = await checkAdmin(db, user.openid)
    if (!isAdmin) throw new AppError('无权操作', 'FORBIDDEN')
  }

  await db.collection('posts').doc(postId).update({
    data: { resolved: true, resolvedAt: new Date() }
  })
  return ok({ resolved: true })
})
