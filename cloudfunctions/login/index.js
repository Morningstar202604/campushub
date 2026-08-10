// cloudfunctions/login/index.js
// 用户登录/注册。允许被封禁用户登录（仅用于提示），但写操作会被统一拦截。
const { getDB, ok, wrap, getOpenid } = require('./common-bundle')

exports.main = wrap(async (event, context) => {
  const openid = await getOpenid()
  const db = getDB()

  const userRes = await db.collection('users').where({ openid }).get()

  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    await db.collection('users').doc(user._id).update({ data: { updatedAt: new Date() } })
    return ok({ user })
  }

  const newUser = {
    openid,
    nickname: '韩师同学' + Math.random().toString(36).substr(2, 6),
    avatar: '',
    school: '韩山师范学院',
    schoolId: 'HSFNC',
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
    followerCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const addRes = await db.collection('users').add({ data: newUser })
  newUser._id = addRes._id
  return ok({ user: newUser })
})
