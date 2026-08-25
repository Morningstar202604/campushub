// common-subscribe.js — 微信订阅消息（best-effort，绝不阻塞主流程）
// 模板 ID 通过云函数环境变量配置（部署者按自己申请的模板填写）：
//   TMPL_COMMENT  评论/回复通知模板
//   TMPL_LIKE     点赞通知模板
//   TMPL_FOLLOW   关注通知模板
//   TMPL_STATE    正式版 formal / 体验版 trial / 开发版 developer（默认 formal）
// 未配置对应环境变量时静默跳过 —— 不申请模板也能正常部署运行。
const { getCloud } = require('./common-db')

// 用户未订阅（43101）属正常情况，不刷日志
function isExpectedSubscribeError(e) {
  const msg = String((e && (e.errMsg || e.message)) || '')
  return /43101/i.test(msg)
}

/**
 * 发送一条订阅消息。
 * @param {string} openid 接收者 openid
 * @param {string} key    模板键：comment | like | follow
 * @param {string} page   点击跳转的小程序页面路径
 * @param {object} fields 模板 data 字段（thing1/time2 等，须与申请的模板关键字匹配）
 */
async function sendSubscribe(openid, key, page, fields) {
  try {
    if (!openid) return false
    const envKey = 'TMPL_' + String(key || '').toUpperCase()
    const templateId = process.env[envKey]
    if (!templateId) return false // 未配置模板 → 跳过

    const cloud = getCloud()
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId,
      page: page || 'pages/index/index',
      data: fields || {},
      miniprogramState: process.env.TMPL_STATE || 'formal'
    })
    return true
  } catch (e) {
    if (!isExpectedSubscribeError(e)) {
      console.warn('[订阅消息] 发送失败(忽略):', String(e && (e.errMsg || e.message)))
    }
    return false
  }
}

/**
 * 根据用户 _id 取 openid（订阅消息按 openid 投递）。
 * @returns {Promise<string|null>}
 */
async function getOpenidByUserId(db, userId) {
  try {
    const r = await db.collection('users').doc(userId).field({ openid: true }).get()
    return (r && r.data && r.data.openid) || null
  } catch (e) {
    return null
  }
}

module.exports = { sendSubscribe, getOpenidByUserId }
