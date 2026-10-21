// cloudfunctions/post-detail/index.js
// 帖子详情：浏览量 + 基于可信 OPENID 的点赞/收藏状态（不再依赖前端传 userId）
const { cloud, getDB, getCmd, AppError, ok, wrap, countViewOnce } = require('./common-bundle')

module.exports = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  const postRes = await db.collection('posts').doc(postId).get()
  const post = postRes.data
  if (!post || post.status === 'deleted') throw new AppError('帖子不存在或已删除', 'NOT_FOUND')

  // 浏览量按 (openid, 文档, 自然日) 去重自增，防脚本/反复刷新刷量
  const viewed = await countViewOnce('posts', postId)
  if (viewed) post.viewCount = (post.viewCount || 0) + 1

  const openid = cloud.getWXContext().OPENID
  let isLiked = false
  let isCollected = false
  if (openid) {
    const me = await db.collection('users').where({ openid }).field({ _id: true }).get()
    if (me.data && me.data.length) {
      const uid = me.data[0]._id
      const likeRes = await db
        .collection('likes')
        .where({ userId: uid, targetId: postId, type: 'post' })
        .count()
      isLiked = likeRes.total > 0
      const collectRes = await db
        .collection('collects')
        .where({ userId: uid, targetId: postId, type: 'post' })
        .count()
      isCollected = collectRes.total > 0
    }
  }

  return ok({ post: maskAnonymous(post), isLiked, isCollected })
})

/**
 * 匿名帖脱敏。
 *
 * 背景：post-create 落库时 userId 永远是真实用户，isAnonymous 只替换了显示昵称。
 * 直接在详情/列表返回原文档，等于把「匿名」的真实身份随 userId 一起下发 ——
 * 任何登录用户拿 userId 调 user-profile 就能反查作者，匿名机制形同虚设。
 *
 * 手机号、openid 这类字段本就不该出现在帖子文档里，这里一并兜底剔除。
 */
function maskAnonymous(post) {
  if (!post || !post.isAnonymous) return post
  const { userId: _userId, userAvatar: _avatar, ...safe } = post
  // 详情页需要「是否自己的帖子」来显示编辑入口：用另一个不暴露身份的布尔代替 userId
  return { ...safe, userId: '', isMine: false }
}
