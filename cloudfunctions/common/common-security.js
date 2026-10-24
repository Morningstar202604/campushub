// common-security.js — 内容安全（fail-closed 设计）
// 根本性解决"审核失败被静默跳过、违规内容照发"的问题：
// 任何异常（接口未开通/超限/网络/命中违规）一律拒绝发布，宁可拦错也不漏放。
const fs = require('fs')
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
  const joined = (texts || []).filter((t) => t != null && String(t).length).join('\n')
  if (!joined) return
  return checkContent({ content: joined, openid, scene })
}

// 图片内容安全（fail-closed）：同步 imgSecCheck 的正确形态是传图片二进制 ——
// `media: { contentType, value: Buffer }`，且微信侧限制单图 ≤1MB、尺寸 ≤750×1334。
// 带 media_url 的是**异步**接口 mediaCheckAsync（其 media_type 图片=2、音频=1），
// 需要配置消息推送回调才能拿到结果，与"发布前必须拦下"的 fail-closed 诉求不匹配，
// 因此这里坚持同步链路：先把 cloud:// 文件下载到本地临时路径，再以 Buffer 送检。
// 任意环节异常（下载失败/超限/命中违规/接口不可用）一律拒绝发布。
const IMAGE_MAX_BYTES = 1024 * 1024 // 微信同步图片审核硬上限 1MB
const IMAGE_CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  // webp：前端上传白名单（uni-app/src/utils/api.ts）一直放行，后端却拒绝 ——
  // 用户能选中、能上传，最后在发布时收到「仅支持 jpg/jpeg/png/gif/bmp」。
  // 微信 imgSecCheck 支持 image/webp，此处与前端对齐。
  webp: 'image/webp'
}
// 审核接口配额为 2000 次/分钟；并发不设上限时，一次 9 图发布就会瞬时打出 9 路请求，
// 多人同时发帖即可耗尽配额 —— 而配额耗尽在本设计里等于全站发不出图（fail-closed）。
const IMAGE_CHECK_CONCURRENCY = 4

function imageContentTypeOf(fileID) {
  const ext = String(fileID).split('?')[0].split('.').pop().toLowerCase()
  return IMAGE_CONTENT_TYPES[ext] || null
}

async function checkImage({ fileID } = {}) {
  // fail-closed：只接受本云存储的图片。外链/垃圾值一律拒绝，
  // 堵住"非 cloud:// 静默放行"的审核后门（客户端可完全控制该字段）。
  if (!fileID || typeof fileID !== 'string' || !fileID.startsWith('cloud://')) {
    throw new AppError('仅支持上传到云存储的图片', 'INVALID_PARAM')
  }
  const contentType = imageContentTypeOf(fileID)
  if (!contentType) {
    throw new AppError('仅支持 jpg / jpeg / png / gif / bmp / webp 图片', 'IMAGE_TYPE_UNSUPPORTED')
  }

  let downloaded
  try {
    downloaded = await cloud.downloadFile({ fileID })
  } catch (e) {
    console.error('[图片安全] 下载失败，按最严策略拒绝:', e && (e.errMsg || e.message))
    throw new AppError('图片审核服务暂不可用，请稍后再试', 'CONTENT_CHECK_UNAVAILABLE')
  }
  const tempFilePath = downloaded && downloaded.tempFilePath
  if (!tempFilePath) {
    throw new AppError('图片审核服务暂不可用，请稍后再试', 'CONTENT_CHECK_UNAVAILABLE')
  }

  let buffer
  try {
    buffer = fs.readFileSync(tempFilePath)
  } catch (e) {
    console.error('[图片安全] 读取临时文件失败，按最严策略拒绝:', e && e.message)
    throw new AppError('图片审核服务暂不可用，请稍后再试', 'CONTENT_CHECK_UNAVAILABLE')
  } finally {
    // 临时文件用完即删，避免实例复用时无限堆积占用磁盘
    try {
      fs.unlinkSync(tempFilePath)
    } catch {
      /* 删不掉不影响审核结论 */
    }
  }

  if (!buffer || !buffer.length) {
    throw new AppError('图片内容为空，请重新上传', 'IMAGE_EMPTY')
  }
  // 明确区分"图太大"与"审核服务不可用"：前者是用户可通过压缩自行解决的问题，
  // 后端只能提示，真正的压缩应发生在前端（见 uni-app 上传前的 compressToUnder1MB）。
  if (buffer.length > IMAGE_MAX_BYTES) {
    throw new AppError('图片过大（超过 1MB），请在发布前压缩后重试', 'IMAGE_TOO_LARGE')
  }

  try {
    await cloud.openapi.security.imgSecCheck({
      media: { contentType, value: buffer }
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

// 批量校验图片：并发受限（默认 4），任一张违规/异常即整体拒绝
async function checkImages(fileIDs = [], { concurrency = IMAGE_CHECK_CONCURRENCY } = {}) {
  const list = (fileIDs || []).filter(Boolean)
  if (!list.length) return
  let cursor = 0
  let failed = null
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (cursor < list.length && !failed) {
      const i = cursor++
      try {
        await checkImage({ fileID: list[i] })
      } catch (e) {
        if (!failed) failed = e
      }
    }
  })
  await Promise.all(workers)
  if (failed) throw failed
}

// 管理员身份识别（云端可信，不依赖前端）
// 优先级：
//   ① 云函数环境变量 ADMIN_OPENIDS（逗号分隔）
//   ② 数据库 config 集合 doc('global').adminOpenids 数组
// 部署后请至少在云函数环境变量中配置管理员 openid。
// 提取自 admin/resolve 的重复实现，统一为单一事实来源。
async function checkAdmin(db, openid) {
  // ① 云函数环境变量 ADMIN_OPENIDS（逗号分隔）—— 命中直接放行
  const envAdmins = (process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (envAdmins.includes(openid)) return true
  // ② 数据库 config 集合 doc('global').adminOpenids 数组
  // fail-closed：区分"文档不存在/无该字段"（返回 false）与"DB 调用异常"（抛出，
  // 由上层统一 fail-closed 处理）。避免 .catch(() => null) 把 DB 故障静默吞成
  // "无管理员"，在 DB 瞬时不可用时放行本应被拦截的高危操作。
  let cfg
  try {
    cfg = await db.collection('config').doc('global').get()
  } catch (e) {
    const msg = String(e && (e.errMsg || e.message || ''))
    // 云开发"文档不存在"：errCode -1 / "document not exists"。属正常降级（管理员未配置）
    const notFound = /-1\b|not exists|document.*exist/i.test(msg)
    if (!notFound) {
      // 非「不存在」的 DB 异常（超时/权限/网络）→ fail-closed 拒绝，避免故障时静默放行
      console.error('[checkAdmin] config 读取异常，按 fail-closed 拒绝:', msg)
      throw new AppError('管理员配置读取失败，操作已拒绝', 'ADMIN_CONFIG_ERROR')
    }
    cfg = { data: null }
  }
  if (
    cfg &&
    cfg.data &&
    Array.isArray(cfg.data.adminOpenids) &&
    cfg.data.adminOpenids.includes(openid)
  )
    return true
  return false
}

module.exports = {
  checkContent,
  checkContents,
  checkImage,
  checkImages,
  checkAdmin,
  IMAGE_MAX_BYTES
}
