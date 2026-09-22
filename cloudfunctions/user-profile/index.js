// cloudfunctions/user-profile/index.js
// 查看他人主页：公开资料 + 统计 + 最近帖子 + 关注状态
// 安全：仅登录态用户可访问（requireActiveUser），限流 60s 内最多 20 次
// 隐私：查看他人主页时不回传 creditScore/checkinStreak/followerCount 等敏感统计
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, rateLimit, checkAdmin } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { userId, page = 1, pageSize = 10 } = event
  if (!userId) throw new AppError('缺少用户ID', 'INVALID_PARAM')

  // 登录态门槛：游客直接拒绝
  const me = await requireActiveUser()

  // 按 openid 限流：60s 内最多 20 次。
  // 复用既有 view_logs 日志集合做计数（避免新增集合破坏契约/需改 init-db），
  // 用 scene='profile' 标记与 countViewOnce 的浏览去重记录隔离，互不干扰。
  await rateLimit({
    collection: 'view_logs',
    match: { openid: me.openid, scene: 'profile' },
    windowMs: 60000,
    max: 20
  })

  // 写入限流计数（失败静默，不阻断主流程；scene 标记隔离浏览去重记录）
  try {
    await db.collection('view_logs').add({
      data: { _id: `pl_${me.openid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, openid: me.openid, scene: 'profile', createdAt: new Date() }
    })
  } catch (e) { /* 静默 */ }

  const pSize = Math.min(50, Math.max(1, Number(pageSize)))
  const skip = Math.max(0, (Number(page) - 1) * pSize)

  // 获取用户公开资料
  const userRes = await db.collection('users').doc(userId).get().catch(() => ({ data: null }))
  if (!userRes || !userRes.data) throw new AppError('用户不存在', 'NOT_FOUND')

  const u = userRes.data

  // 判断是否本人或管理员（完整 profile 只给本人/管理员）
  const isSelf = me._id === userId
  let isAdmin = false
  if (!isSelf && me.openid) {
    isAdmin = await checkAdmin(db, me.openid)
  }

  let profile
  if (isSelf || isAdmin) {
    // 本人/管理员：返回完整资料
    profile = {
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
  } else {
    // 他人：脱敏版，仅保留公开基础信息（昵称/头像/学校/学院/专业/年级/bio/tags/性别/帖子数）
    profile = {
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
      createdAt: u.createdAt
    }
  }

  // 当前用户的关注状态（复用 me.openid，不再重复 getOpenid）
  let isFollowing = false
  if (me.openid && me._id !== userId) {
    const followRes = await db.collection('follows')
      .where({ followerId: me._id, followingId: userId })
      .count()
    isFollowing = followRes.total > 0
  }

  // 最近帖子（非匿名，未删除）
  const postRes = await db.collection('posts')
    .where({ userId, status: _.neq('deleted'), isAnonymous: false })
    .orderBy('createdAt', 'desc').skip(skip).limit(pSize)
    .field({ title: true, images: true, likeCount: true, commentCount: true, createdAt: true, kind: true, resolved: true, status: true })
    .get()

  return ok({ profile, isFollowing, posts: postRes.data || [] })
})
