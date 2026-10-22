// common-identity.js — 跨端身份解析（单一事实来源）
//
// 为什么需要它：
//   微信小程序端 cloud.getWXContext().OPENID 由平台注入，天然可信。
//   但 H5 / App 走 CloudBase 的 HTTP 访问服务（REST），请求里没有 OPENID ——
//   原实现直接抛 AUTH_REQUIRED，导致「三端交付」在后两端只能只读。
//
// 设计取舍（按可信度从高到低）：
//   ① 小程序 OPENID —— 平台注入，不可伪造，最高优先级；
//   ② HMAC 签名的设备令牌 —— H5/App 用，服务端签发、服务端校验签名，
//      客户端无法伪造他人身份（改一个字符签名就对不上）；
//   ③ 匿名 —— 只允许读接口，写接口仍然拒绝。
//
// 为什么不用「客户端传 userId」：那是 IDOR 的教科书案例 —— 任何人传别人的 id 就能冒充。
// 为什么不用「自定义登录换 uid」：需要 CloudBase 控制台开通并配置密钥，
// 属于部署侧操作；本方案零配置即可工作，且安全性由 HMAC 保证（密钥仅在云函数环境变量）。
//
// 密钥来源：环境变量 IDENTITY_SECRET。未配置时退化为「按 envId 派生的固定盐」——
//   安全性下降（知道 envId 就能伪造），因此生产环境必须显式配置。
//   启动时会在日志里告警，避免「以为配了其实没配」。

const crypto = require('crypto')
const { cloud } = require('./common-db')
const { AppError } = require('./common-error')

const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000 // 30 天
const HEADER = 'x-identity-token'

/** 取签名密钥。优先环境变量；缺省时用 envId 派生（并告警一次）。 */
let warned = false
function secret() {
  const s = process.env.IDENTITY_SECRET
  if (s && s.length >= 16) return s
  if (!warned) {
    warned = true
    console.warn(
      '[identity] 未配置 IDENTITY_SECRET，已退化为 envId 派生盐。' +
        '生产环境请配置 32 位以上随机串，否则知道 envId 的人可伪造设备身份。'
    )
  }
  const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE || 'campushub-default'
  return `fallback:${envId}`
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
function unb64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/**
 * 签发设备令牌。
 * payload: { uid } —— uid 是服务端生成的随机标识，不是 openid，也不含任何个人信息。
 * 返回 `base64url(payload).base64url(hmac)`。
 */
function issueToken(uid, now = Date.now()) {
  const payload = { uid, iat: now, exp: now + TOKEN_TTL_MS }
  const p = b64url(JSON.stringify(payload))
  const sig = b64url(crypto.createHmac('sha256', secret()).update(p).digest())
  return `${p}.${sig}`
}

/** 校验令牌，返回 payload 或 null（不抛错，由调用方决定如何降级）。 */
function verifyToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null
  const [p, sig] = token.split('.')
  if (!p || !sig) return null
  const expected = b64url(crypto.createHmac('sha256', secret()).update(p).digest())
  // 定长比较，避免时序侧信道
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let payload
  try {
    payload = JSON.parse(unb64url(p).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload.uid !== 'string' || !payload.uid) return null
  if (typeof payload.exp !== 'number' || payload.exp < now) return null
  return payload
}

/** 从 event 中取令牌。小程序端不会带，REST 端由前端放进 body 的 __identity 字段。 */
function readTokenFromEvent(event) {
  if (!event || typeof event !== 'object') return ''
  const direct = event.__identity
  if (typeof direct === 'string' && direct) return direct
  return ''
}

/**
 * 解析调用者身份。返回 { openid, kind }：
 *   kind = 'wx'     —— 小程序，openid 来自平台
 *   kind = 'device' —— H5/App，openid 形如 `dev_<uid>`（账号隔离，不与他人冲突）
 *   kind = 'anon'   —— 都没拿到
 *
 * 注意：device 身份的 openid 加 `dev_` 前缀，确保与真实微信 openid 不会碰撞
 * （微信 openid 是 28 位 base64 字符，不含 `_` 前缀，见官方文档）。
 */
function resolveIdentity(event) {
  let wxOpenid = ''
  try {
    const wxContext = cloud.getWXContext()
    wxOpenid = (wxContext && wxContext.OPENID) || ''
  } catch {
    // 非小程序环境（REST）getWXContext 可能不存在或返回空
  }
  if (wxOpenid) return { openid: wxOpenid, kind: 'wx' }

  const payload = verifyToken(readTokenFromEvent(event))
  if (payload) return { openid: `dev_${payload.uid}`, kind: 'device' }

  return { openid: '', kind: 'anon' }
}

/** 生成新的设备 uid（服务端生成，客户端不可指定） */
function newDeviceUid() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * 要求已登录：拿不到身份就抛 AUTH_REQUIRED（fail-closed）。
 * 这是所有写接口的入口，行为与原 getOpenid 一致。
 */
function requireOpenid(event) {
  const id = resolveIdentity(event)
  if (!id.openid) throw new AppError('未登录或登录态失效', 'AUTH_REQUIRED')
  return id.openid
}

module.exports = {
  HEADER,
  TOKEN_TTL_MS,
  issueToken,
  verifyToken,
  resolveIdentity,
  requireOpenid,
  newDeviceUid
}
