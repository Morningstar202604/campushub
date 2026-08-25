// cloudfunctions/login/index.js
// 用户登录/注册。允许被封禁用户登录（仅用于提示），但写操作会被统一拦截。
// 并发首登：add 撞 idx_users_openid 唯一索引后重读，不再可能建出重复用户；
// 老用户回写 updatedAt 的"每次登录必写"已移除（写放大 + 与 user-update 的 updatedAt 语义重复）。
const { getDB, isDuplicateKeyError, ok, wrap, getOpenid } = require('./common-bundle')

exports.main = wrap(async (event, context) => {
  const openid = await getOpenid()
  const db = getDB()

  const userRes = await db.collection('users').where({ openid }).get()

  if (userRes.data.length > 0) {
    return ok({ user: userRes.data[0] })
  }

  const newUser = {
    openid,
    nickname: '同学' + Math.random().toString(36).substr(2, 6),
    avatar: '',
    school: '',
    schoolId: '',
    college: '',
    major: '',
    grade: '',
    gender: 0,
    bio: '',
    tags: [],
    verifyStatus: 'unverified',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    collectCount: 0,
    followerCount: 0,
    followingCount: 0,
    checkinStreak: 0,
    lastCheckinDate: '',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  try {
    const addRes = await db.collection('users').add({ data: newUser })
    newUser._id = addRes._id
    return ok({ user: newUser })
  } catch (e) {
    // 并发首次登录：另一个请求先建好了。唯一索引兜底 → 重读返回即可
    if (isDuplicateKeyError(e)) {
      const again = await db.collection('users').where({ openid }).get()
      if (again.data && again.data[0]) return ok({ user: again.data[0] })
    }
    throw e
  }
})
