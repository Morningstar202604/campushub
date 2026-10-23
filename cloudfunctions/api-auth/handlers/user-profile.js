// cloudfunctions/user-profile/index.js
// 查看他人主页：公开资料 + 统计 + 最近帖子 + 关注状态
// 安全：仅登录态用户可访问（requireActiveUser），限流 60s 内最多 20 次
// 隐私：查看他人主页时不回传 creditScore/checkinStreak/followerCount 等敏感统计
//
// 结构：handler 只做编排；两份资料投影（完整/脱敏）、关注状态、最近帖子各自独立成函数，
// 单函数可目读、可单测。新增字段时改对应投影函数，不要往 handler 里堆兜底表达式。
const {
  getDB,
  getCmd,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  rateLimit,
  checkAdmin
} = require('./common-bundle')
/** 兜底读取：与原 `x || d` 等价（null/undefined/''/0/false 都落默认值） */
function orDefault(v, d = '') {
  return v || d
}

/** 本人/管理员可见：完整资料 */
function fullProfile(u) {
  return {
    _id: u._id,
    nickname: u.nickname,
    avatar: orDefault(u.avatar),
    school: orDefault(u.school),
    college: orDefault(u.college),
    major: orDefault(u.major),
    grade: orDefault(u.grade),
    bio: orDefault(u.bio),
    tags: orDefault(u.tags, []),
    gender: orDefault(u.gender, 0),
    postCount: orDefault(u.postCount, 0),
    productCount: orDefault(u.productCount, 0),
    followerCount: orDefault(u.followerCount, 0),
    followingCount: orDefault(u.followingCount, 0),
    creditScore: orDefault(u.creditScore, 100),
    checkinStreak: orDefault(u.checkinStreak, 0),
    createdAt: u.createdAt
  }
}

/** 他人可见：脱敏版，仅保留公开基础信息（昵称/头像/学校/学院/专业/年级/bio/tags/性别/帖子数） */
function publicProfile(u) {
  return {
    _id: u._id,
    nickname: u.nickname,
    avatar: orDefault(u.avatar),
    school: orDefault(u.school),
    college: orDefault(u.college),
    major: orDefault(u.major),
    grade: orDefault(u.grade),
    bio: orDefault(u.bio),
    tags: orDefault(u.tags, []),
    gender: orDefault(u.gender, 0),
    postCount: orDefault(u.postCount, 0),
    productCount: orDefault(u.productCount, 0),
    createdAt: u.createdAt
  }
}

/** 本人/管理员判定：管理员要查库，仅非本人且带 openid 时才做（本人不需要，游客没有 openid） */
async function resolveViewerRole(db, me, userId) {
  const isSelf = me._id === userId
  const isAdmin = !isSelf && me.openid ? await checkAdmin(db, me.openid) : false
  return { isSelf, isAdmin }
}

/** 当前用户对目标用户的关注状态（复用 me.openid，不再重复 getOpenid；本人不查） */
async function fetchIsFollowing(db, me, userId) {
  if (!me.openid || me._id === userId) return false
  const followRes = await db
    .collection('follows')
    .where({ followerId: me._id, followingId: userId })
    .count()
  return followRes.total > 0
}

/** 最近帖子（非匿名，未删除），分页参数由调用方收敛过界 */
function fetchRecentPosts(db, userId, skip, pSize, _) {
  return db
    .collection('posts')
    .where({ userId, status: _.neq('deleted'), isAnonymous: false })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pSize)
    .field({
      title: true,
      images: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      kind: true,
      resolved: true,
      status: true
    })
    .get()
}

/** 我是否已拉黑该用户（他人主页据此显示「已拉黑 · 解除」；本人页恒 false） */
async function fetchIsBlocked(db, me, userId) {
  if (me._id === userId) return false
  const res = await db.collection('blocks').where({ blockerId: me._id, blockedId: userId }).count()
  return res.total > 0
}

module.exports = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { userId, page = 1, pageSize = 10 } = event
  if (!userId) throw new AppError('缺少用户ID', 'INVALID_PARAM')

  // 登录态门槛：游客直接拒绝
  const me = await requireActiveUser()

  // 按 openid 限流：60s 内最多 20 次。
  // 计数完全由 rateLimit 在 rate_limits 集合内以确定性 _id 维护——
  // 这里不要再往 view_logs 补写记录：rateLimit 不读 view_logs，
  // 那些记录既不影响限频，又会让「每次看主页」都写一行垃圾数据，撑大 90 天清理量。
  await rateLimit({
    collection: 'view_logs',
    match: { openid: me.openid, scene: 'profile' },
    windowMs: 60000,
    max: 20
  })

  const pSize = Math.min(50, Math.max(1, Number(pageSize)))
  const skip = Math.max(0, (Number(page) - 1) * pSize)

  // 获取用户公开资料
  const userRes = await db
    .collection('users')
    .doc(userId)
    .get()
    .catch(() => ({ data: null }))
  if (!userRes || !userRes.data) throw new AppError('用户不存在', 'NOT_FOUND')

  const u = userRes.data

  const { isSelf, isAdmin } = await resolveViewerRole(db, me, userId)
  const profile = isSelf || isAdmin ? fullProfile(u) : publicProfile(u)

  const isFollowing = await fetchIsFollowing(db, me, userId)
  const isBlocked = await fetchIsBlocked(db, me, userId)
  const postRes = await fetchRecentPosts(db, userId, skip, pSize, _)

  return ok({ profile, isFollowing, isBlocked, posts: postRes.data || [] })
})
