// common-context.js — 用户上下文与鉴权（单一事实来源）
// 根本性解决：所有写操作统一经 getCurrentUser/requireActiveUser，
// 封禁判断不再散落各处、也不再出现"只检查商品不检查帖子"的遗漏。
const { cloud, getDB } = require('./common-db')
const { AppError } = require('./common-error')

// 取得调用者 openid（云端可信，不可伪造）
async function getOpenid() {
  const wxContext = cloud.getWXContext()
  if (!wxContext || !wxContext.OPENID) {
    throw new AppError('未登录或登录态失效', 'AUTH_REQUIRED')
  }
  return wxContext.OPENID
}

// 取得当前登录用户文档；不存在则抛错（前置所有业务的前提）
async function getCurrentUser() {
  const openid = await getOpenid()
  const db = getDB()
  const res = await db.collection('users')
    .where({ openid })
    .field({ openid: true, verifyStatus: true, nickname: true, avatar: true,
             schoolId: true, school: true, _id: true,
             college: true, major: true, grade: true, bio: true, tags: true, gender: true,
             creditScore: true, checkinStreak: true, lastCheckinDate: true,
             postCount: true, productCount: true, collectCount: true,
             followerCount: true, followingCount: true })
    .get()
  if (!res.data || res.data.length === 0) {
    throw new AppError('用户不存在，请重新登录', 'USER_NOT_FOUND')
  }
  return res.data[0]
}

// 要求用户处于正常状态：被封禁直接拒绝。所有写操作都应经过它。
function requireActive(user) {
  if (!user) throw new AppError('用户不存在', 'USER_NOT_FOUND')
  if (user.verifyStatus === 'banned') {
    throw new AppError('账号已被限制，请联系管理员解封', 'USER_BANNED')
  }
  return user
}

// 便捷组合：当前用户 + 必须正常
async function requireActiveUser() {
  return requireActive(await getCurrentUser())
}

module.exports = { getOpenid, getCurrentUser, requireActive, requireActiveUser }
