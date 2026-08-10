// cloudfunctions/post-detail/index.js
// 帖子详情：浏览量 + 基于可信 OPENID 的点赞/收藏状态（不再依赖前端传 userId）
const { cloud, getDB, getCmd, AppError, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  const postRes = await db.collection('posts').doc(postId).get()
  const post = postRes.data
  if (!post || post.status === 'deleted') throw new AppError('帖子不存在或已删除', 'NOT_FOUND')

  await db.collection('posts').doc(postId).update({ data: { viewCount: _.inc(1) } })
  post.viewCount = (post.viewCount || 0) + 1

  const openid = cloud.getWXContext().OPENID
  let isLiked = false
  let isCollected = false
  if (openid) {
    const me = await db.collection('users').where({ openid }).field({ _id: true }).get()
    if (me.data && me.data.length) {
      const uid = me.data[0]._id
      const likeRes = await db.collection('likes').where({ userId: uid, targetId: postId, type: 'post' }).count()
      isLiked = likeRes.total > 0
      const collectRes = await db.collection('collects').where({ userId: uid, targetId: postId }).count()
      isCollected = collectRes.total > 0
    }
  }

  return ok({ post, isLiked, isCollected })
})
