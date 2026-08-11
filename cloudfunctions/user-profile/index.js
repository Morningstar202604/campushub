// cloudfunctions/user-profile/index.js
// 查看他人主页：公开资料 + 统计 + 最近帖子 + 关注状态
const { getDB, getCmd, AppError, ok, wrap, getOpenid } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { userId, page = 1, pageSize = 10 } = event
  if (!userId) throw new AppError('缺少用户ID', 'INVALID_PARAM')

  const pSize = Math.min(50, Math.max(1, Number(pageSize)))
  const skip = Math.max(0, (Number(page) - 1) * pSize)

  // 获取用户公开资料
  const userRes = await db.collection('users').doc(userId).get().catch(() => ({ data: null }))
  if (!userRes || !userRes.data) throw new AppError('用户不存在', 'NOT_FOUND')

  const u = userRes.data
  const profile = {
    _id: u._id,
    nickname: u.nickname,
    avatar: u.avatar || '',
    school: u.school || '',
    college: u.college || '',
    major: u.major || '',
    grade: u.grade || '',
    bio: u.bio || '',
    tags: u.tags || [],
    gender: u.gender || 0,
    postCount: u.postCount || 0,
    productCount: u.productCount || 0,
    followerCount: u.followerCount || 0,
    followingCount: u.followingCount || 0,
    creditScore: u.creditScore || 100,
    checkinStreak: u.checkinStreak || 0,
    createdAt: u.createdAt
  }

  // 当前用户的关注状态
  let isFollowing = false
  try {
    const openid = await getOpenid()
    if (openid) {
      const currentUser = await db.collection('users').where({ openid }).field({ _id: true }).get()
      if (currentUser.data.length > 0) {
        const myId = currentUser.data[0]._id
        if (myId !== userId) {
          const followRes = await db.collection('follows')
            .where({ followerId: myId, followingId: userId })
            .count()
          isFollowing = followRes.total > 0
        }
      }
    }
  } catch (e) {
    // 未登录时不报错，isFollowing 保持 false
  }

  // 最近帖子（非匿名，未删除）
  const postRes = await db.collection('posts')
    .where({ userId, status: _.neq('deleted'), isAnonymous: false })
    .orderBy('createdAt', 'desc').skip(skip).limit(pSize)
    .field({ title: true, images: true, likeCount: true, commentCount: true, createdAt: true, kind: true, resolved: true, status: true })
    .get()

  return ok({ profile, isFollowing, posts: postRes.data || [] })
})
