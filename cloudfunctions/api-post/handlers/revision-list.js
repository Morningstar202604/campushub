// cloudfunctions/revision-list/index.js
// 内容编辑历史：作者本人或管理员可查看帖子修订快照（最近 10 版）。
//
// 为什么需要：UGC 纠纷与审核需要证据链。post-update 每次成功写入前会把旧值快照进
// post_revisions（见 post-update），本入口只读，不提供回滚——回滚会绕过内容安全审核，
// 属于另一个产品决策，当前刻意不做。
const { getDB, AppError, ok, wrap, requireActiveUser, checkAdmin } = require('./common-bundle')

const MAX_VERSIONS = 10

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  const postRes = await db
    .collection('posts')
    .doc(postId)
    .get()
    .catch(() => ({ data: null }))
  const post = postRes && postRes.data
  if (!post) throw new AppError('帖子不存在', 'NOT_FOUND')

  const isOwner = post.userId === user._id
  const isAdmin = !isOwner && user.openid ? await checkAdmin(db, user.openid) : false
  if (!isOwner && !isAdmin) throw new AppError('无权查看编辑历史', 'FORBIDDEN')

  const res = await db
    .collection('post_revisions')
    .where({ postId })
    .orderBy('createdAt', 'desc')
    .limit(MAX_VERSIONS)
    .get()

  return ok({ list: res.data || [], maxVersions: MAX_VERSIONS })
})
