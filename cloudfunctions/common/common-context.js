// common-context.js — 用户上下文与鉴权（单一事实来源）
// 根本性解决：所有写操作统一经 getCurrentUser/requireActiveUser，
// 封禁判断不再散落各处、也不再出现"只检查商品不检查帖子"的遗漏。
const { getDB } = require('./common-db')
const { AppError } = require('./common-error')
const { resolveIdentity, requireOpenid } = require('./common-identity')
const { runWithEvent, bindEvent, getCurrentEvent } = require('./common-scope')

/**
 * 取得调用者 openid（服务端可信，不可伪造）。
 *   - 小程序：来自 cloud.getWXContext().OPENID（平台注入）
 *   - H5/App：来自 HMAC 签名设备令牌（见 common-identity.js）
 *   - 都没有：抛 AUTH_REQUIRED
 */
async function getOpenid() {
  return requireOpenid(getCurrentEvent())
}

// 取得当前登录用户文档；不存在则抛错（前置所有业务的前提）
async function getCurrentUser() {
  const openid = await getOpenid()
  const db = getDB()
  const res = await db
    .collection('users')
    .where({ openid })
    .field({
      openid: true,
      verifyStatus: true,
      // 校园认证：verify.js 读它判断能否重复提交，post-create/product-create 读它写 authorVerified。
      // 漏投影会让「已认证」恒为 undefined —— 认证通过后仍能重复提交、内容也永远无认证标识。
      campusVerified: true,
      campusVerifyStatus: true,
      nickname: true,
      avatar: true,
      schoolId: true,
      school: true,
      _id: true,
      college: true,
      major: true,
      grade: true,
      bio: true,
      tags: true,
      gender: true,
      creditScore: true,
      checkinStreak: true,
      lastCheckinDate: true,
      postCount: true,
      productCount: true,
      collectCount: true,
      followerCount: true,
      followingCount: true,
      // 积分商城：points.js 读它算「已持有改名卡」，漏投影会让余额卡永远显示 0。
      renameTokens: true,
      // 改名卡消费标记：user-update 用它判断本周期是否已用掉改名机会。
      hasRenamed: true,
      // 管理员标记由 checkAdmin(openid) 决定，users 文档不存 role —— 此处不投影。
      createdAt: true
    })
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

module.exports = {
  bindEvent,
  runWithEvent,
  getOpenid,
  getCurrentUser,
  requireActive,
  requireActiveUser,
  resolveIdentity
}
