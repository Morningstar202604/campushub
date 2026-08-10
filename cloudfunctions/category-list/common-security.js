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

// 图片内容安全（fail-closed）：对云存储图片做 imgSecCheck。
// 微信 imgSecCheck v2 需要可访问的 https 链接，故先把 cloud:// fileID 换成临时链接再校验。
// 任意异常（未开通/超限/命中违规/网络）一律拒绝发布，与文本安全策略一致。
async function checkImage({ fileID, openid = '' } = {}) {
  if (!fileID || !String(fileID).startsWith('cloud://')) return
  let url
  try {
    const tmp = await cloud.getTempFileURL({ fileList: [fileID] })
    url = tmp && tmp.fileList && tmp.fileList[0] && tmp.fileList[0].tempFileURL
  } catch (e) {
    console.error('[图片安全] 获取临时链接失败，按最严策略拒绝:', e && (e.errMsg || e.message))
    throw new AppError('图片审核服务暂不可用，请稍后再试', 'CONTENT_CHECK_UNAVAILABLE')
  }
  if (!url) return
  try {
    await cloud.openapi.security.imgSecCheck({
      version: '2',
      openid,
      media: { type: 1, media_url: url }
    })
  } catch (e) {
    const errCode = e && (e.errCode || e.errcode)
    if (errCode === 87014) {
      throw new AppError('图片包含敏感内容，请更换后重试', 'CONTENT_RISKY')
    }
    console.error('[图片安全] 调用异常，按最严策略拒绝:', e && (e.errMsg || e.message))
    throw new AppError('图片审核服务暂不可用，请稍后再试', 'CONTENT_CHECK_UNAVAILABLE')
  }
}

// 批量校验图片数组（每张依次校验，任一张违规即拒绝）
async function checkImages(fileIDs = [], { openid = '' } = {}) {
  for (const f of (fileIDs || [])) {
    await checkImage({ fileID: f, openid })
  }
}

module.exports = { checkContent, checkContents, checkImage, checkImages }
