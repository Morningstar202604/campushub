// cloudfunctions/login/index.js
// 用户登录/注册。允许被封禁用户登录（仅用于提示），但写操作会被统一拦截。
// 并发首登：add 撞 idx_users_openid 唯一索引后重读，不再可能建出重复用户；
// 老用户回写 updatedAt 的"每次登录必写"已移除（写放大 + 与 user-update 的 updatedAt 语义重复）。
const {
  getDB,
  isDuplicateKeyError,
  ok,
  wrap,
  checkAdmin,
  resolveIdentity,
  issueToken,
  newDeviceUid
} = require('./common-bundle')

// 返回给客户端的用户文档剔除 openid（openid 是服务端可信来源，客户端用 _id 即可识别身份）
function stripOpenid(u) {
  if (!u) return u
  const { openid: _openid, ...safe } = u
  return safe
}

/**
 * 附加 role 字段：users 文档本身不存 role（管理员由 ADMIN_OPENIDS / config.adminOpenids 决定），
 * 但前端管理台入口与守卫读的是 userInfo.role。
 * 早先版本没有任何代码返回 role —— 结果真实环境下「我的内容 → 管理台」入口永不显示、
 * 直连管理页也被守卫弹回；演示模式因为种子数据写死了 role:'admin' 才看起来正常。
 * 这里在 login 响应里由 checkAdmin(openid) 现算，权威来源仍是服务端配置。
 */
async function withRole(db, openid, user) {
  let isAdmin = false
  try {
    isAdmin = await checkAdmin(db, openid)
  } catch {
    // checkAdmin 在 DB 异常时 fail-closed 抛出：此处降级为非管理员（前端入口不显示），
    // 不影响登录本身；真正的写操作仍由各 handler 的 checkAdmin 兜底。
    isAdmin = false
  }
  return { ...stripOpenid(user), role: isAdmin ? 'admin' : 'user' }
}

module.exports = wrap(async (event, _context) => {
  const db = getDB()

  // 身份解析：小程序走 OPENID；H5/App 走设备令牌。
  // H5/App 首次登录没有令牌 → 服务端生成 uid 并签发，客户端存下来供后续请求复用。
  // 关键点：uid 由服务端 crypto 随机生成，客户端不能指定 —— 否则就能冒充他人身份。
  let identity = resolveIdentity(event)
  let issuedToken = ''
  if (!identity.openid) {
    // 只有在完全没有微信身份时才签发设备令牌（REST 场景）
    const uid = newDeviceUid()
    issuedToken = issueToken(uid)
    identity = { openid: `dev_${uid}`, kind: 'device' }
  }
  const openid = identity.openid

  // 三条返回路径（老用户 / 新建 / 并发重读）都必须带上同一份令牌，
  // 漏任一条就会出现"同一个客户端时而有时而没有登录态"的间歇性故障。
  const respond = async (user) => {
    const body = { user: await withRole(db, openid, user) }
    if (issuedToken) body.identityToken = issuedToken
    return ok(body)
  }

  const userRes = await db.collection('users').where({ openid }).get()

  if (userRes.data.length > 0) {
    return respond(userRes.data[0])
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
    // 校园认证三态：新用户必须显式初始化，否则 verify.js 的 status 分支
    // 与 getCurrentUser 的投影都会读到 undefined（默认值与「已通过」无法区分）。
    campusVerified: false,
    campusVerifyStatus: 'none',
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
    return respond(newUser)
  } catch (e) {
    // 并发首次登录：另一个请求先建好了。唯一索引兜底 → 重读返回即可
    if (isDuplicateKeyError(e)) {
      const again = await db.collection('users').where({ openid }).get()
      if (again.data && again.data[0]) return respond(again.data[0])
    }
    throw e
  }
})
