// common-security.js — 内容安全（fail-closed 设计）
// 根本性解决"审核失败被静默跳过、违规内容照发"的问题：
// 任何异常（接口未开通/超限/网络/命中违规）一律拒绝发布，宁可拦错也不漏放。
const { cloud } = require('./common-db')
const { AppError } = require('./common-error')

// 微信内容安全 v2 文本检测。
// scene: 1=资料 2=评论互动 3=私聊 4=群聊
async function checkContent({ content = '', openid = '', scene = 2 } = {}) {
  const text = String(content == null ? '' : content).trim()
  if (!text) return
  try {
    await cloud.openapi.security.msgSecCheck({
      version: '2',
      openid,
      scene,
      content: text
    })
  } catch (e) {
    const errCode = e && (e.errCode || e.errcode)
    // 命中违规内容（微信返回 87014）
    if (errCode === 87014) {
      throw new AppError('内容包含敏感信息，请修改后重试', 'CONTENT_RISKY')
    }
    // 接口不可用（未开通/无权限/超限/网络）：按最严策略拒绝，避免漏放违规内容
    console.error('[内容安全] 调用异常，按最严策略拒绝发布:', e && (e.errMsg || e.message))
    throw new AppError('内容审核服务暂不可用，请稍后再试', 'CONTENT_CHECK_UNAVAILABLE')
  }
}

// 多段文本合并检测（标题+正文+标签等）
async function checkContents(texts = [], { openid = '', scene = 2 } = {}) {
  const joined = (texts || [])
    .filter(t => t != null && String(t).length)
    .join('\n')
  if (!joined) return
  return checkContent({ content: joined, openid, scene })
}

module.exports = { checkContent, checkContents }
