// 平台分流层：20 个页面对此层无感知，只 import { callFunction } from '@/utils/api'
//
// 三路分发（同一份代码编译到三个平台，靠条件编译宏 + 运行期平台探测双保险）：
//   小程序   → wx.cloud.callFunction(name, data)（旧仓零改动直连）
//   H5 / App → CloudBase 云函数 HTTP 访问服务 REST：
//              POST https://{envId}.api.tcloudbasegateway.com/v1/functions/{name}?webfn=true
//              Authorization: Bearer {token}
//              成功响应：{ result, requestId, timestamp }   （result 即云函数 exports.main 的返回值）
//              失败响应：{ code, message, requestId }
//
// 安全说明：
//   1. 必须为公开可调用的云函数在 CloudBase 控制台开启 HTTP 访问服务并配置鉴权，
//      否则 REST 端点会 401。
//   2. 小程序端继续走 wx.cloud（已绑定 openid 自动鉴权），完全不变。
//   3. H5/App 端拿到的 user 文档由后端剥离 openid，前端只持有 _id。
//   4. 生产环境建议把 restToken 放到服务端反代，避免 token 被反编译提取。

import { useSchoolStore } from '@/stores/school'

type Platform = 'miniprogram' | 'app' | 'h5'

/** REST 单次请求超时（毫秒）。云函数冷启动偶发较慢，给足 15s，避免无限挂起。 */
const REST_TIMEOUT_MS = 15000

function getPlatform(): Platform {
  // #ifdef MP
  return 'miniprogram'
  // #endif
  // #ifdef APP-PLUS
  return 'app'
  // #endif
  // 运行时兜底：能拿到 wx.cloud.callFunction 的必然是小程序端，否则按 H5(REST) 处理。
  // 注意：不能把兜底写成在小程序分支之前返回 'h5'，否则非 uni 预处理环境下会误判。
  const g: any = globalThis as any
  if (g.wx && g.wx.cloud && typeof g.wx.cloud.callFunction === 'function') return 'miniprogram'
  return 'h5'
}

/**
 * REST 网关 token 注入点。
 * 部署前把「真实 Token」配置进 school.config.js（与 envId 同文件，保持单点注入约定）。
 */
function resolveToken(): string {
  return useSchoolStore().restToken || ''
}

/** 业务失败统一抛出，携带后端 code，便于调用方按码处理（如 ALREADY / INSUFFICIENT_POINTS）。 */
export class CloudFunctionError extends Error {
  code: string
  fnName: string
  constructor(fnName: string, message: string, code = 'BUSINESS') {
    super(message)
    this.name = 'CloudFunctionError'
    this.fnName = fnName
    this.code = code
  }
}

/** 小程序端：wx.cloud.callFunction（已鉴权） */
function callViaWxCloud(name: string, data: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    // @ts-ignore  wx 在小程序端由运行时注入
    wx.cloud.callFunction({
      name,
      data,
      success: (res: any) => {
        // 后端统一契约（common-error.js）：ok(data) → { success:true, ...data }
        //                                  fail(msg, code) → { success:false, message, code }
        // 业务失败时 success 回调仍会被触发，故用 success 标志兜底
        const body = res.result
        if (body && body.success === false) {
          reject(new CloudFunctionError(name, body.message || body.code || '业务异常', body.code))
          return
        }
        resolve(body ?? {})
      },
      fail: (err: any) => {
        console.error(`[云函数:${name}] 调用失败`, err)
        reject(new CloudFunctionError(name, err.errMsg || '网络异常', 'NETWORK'))
      }
    })
  })
}

/**
 * H5 / App 端：CloudBase 云函数 HTTP 访问服务（REST）
 * 端点：https://{envId}.api.tcloudbasegateway.com/v1/functions/{name}?webfn=true
 */
async function callViaRest(name: string, data: Record<string, any>): Promise<any> {
  const schoolStore = useSchoolStore()
  const { envId } = schoolStore
  if (!envId) {
    throw new CloudFunctionError(
      name,
      '未配置 envId，无法调用云函数。请编辑 src/config/school.config.js 填入',
      'ENV_NOT_CONFIGURED'
    )
  }

  const token = resolveToken()
  const url = `https://${envId}.api.tcloudbasegateway.com/v1/functions/${name}?webfn=true`

  // 超时保护：REST 一旦挂起会永久阻塞首屏，必须 AbortController 兜底
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller
    ? setTimeout(() => controller.abort(), REST_TIMEOUT_MS)
    : null

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(data ?? {}),
      ...(controller ? { signal: controller.signal } : {})
    })
  } catch (e: any) {
    const aborted = e?.name === 'AbortError'
    throw new CloudFunctionError(
      name,
      aborted ? `请求超时（${REST_TIMEOUT_MS / 1000}s）` : `REST 网络异常：${e?.message || e}`,
      aborted ? 'TIMEOUT' : 'NETWORK'
    )
  } finally {
    if (timer) clearTimeout(timer)
  }

  const text = await resp.text()
  let parsed: any
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  // 成功：{ result, requestId, timestamp }，result 即云函数 exports.main 返回值
  if (resp.ok && parsed && 'result' in parsed) {
    const body = parsed.result
    if (body && body.success === false) {
      throw new CloudFunctionError(name, body.message || `云函数 ${name} 业务异常`, body.code)
    }
    return body ?? {}
  }

  // 失败：{ code, message, requestId } 或网关错误
  const code = String(parsed?.code || `HTTP ${resp.status}`)
  const message = parsed?.message || `云函数 ${name} 调用失败`
  console.error(`[云函数:${name}] REST 失败 ${code}`, parsed)
  throw new CloudFunctionError(name, message, code)
}

/**
 * 统一入口。三端同一调用契约：
 *   const res = await callFunction<{ list: Post[]; hasMore: boolean }>('post-list', { page: 1 })
 */
export function callFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<T> {
  const platform = getPlatform()
  if (platform === 'miniprogram') {
    return callViaWxCloud(name, data) as Promise<T>
  }
  return callViaRest(name, data) as Promise<T>
}

// ---------------------------------------------------------------------------
// CloudBase SDK（H5/App 端的存储能力）：懒加载 + 单例初始化
// @cloudbase/js-sdk 2.32.0 已随包依赖；初始化/登录失败由调用方降级处理
// （fileIDToTempUrl 失败透传，uploadImage 失败抛出可读错误并带排查指引）。
// ---------------------------------------------------------------------------
let cbSdkPromise: Promise<any> | null = null

async function ensureCloudbase(): Promise<any> {
  if (cbSdkPromise) return cbSdkPromise
  cbSdkPromise = (async () => {
    // v2 web SDK（官方文档 tencentcloud.com/zh/document/product/1266/71665）：
    //   init 参数名是 env（不是 envId）；动态导入需处理 CJS 互操作取 default
    const mod: any = await import('@cloudbase/js-sdk')
    const sdk = mod?.default ?? mod
    const schoolStore = useSchoolStore()
    if (!schoolStore.envId) {
      // 明确的配置缺失错误（init({ env: '' }) 会在 SDK 内部抛出难懂的错）
      throw new Error('未配置 envId，无法初始化 CloudBase 存储。请编辑 src/config/school.config.js 填入')
    }
    const app = sdk.init({ env: schoolStore.envId })
    // 云存储默认仅「已登录」用户可写（官方文档）：尝试匿名登录；
    // 环境未开启匿名登录时静默降级（读可能仍可用，写会在调用处给出明确报错）
    try {
      const auth = app.auth({ persistence: 'local' })
      const state = auth.hasLoginState?.()
      if (!state || !state.isLoggedIn) {
        await auth.signInAnonymously()
      }
    } catch (e: any) {
      console.warn(
        '[CampusHub] CloudBase 匿名登录失败（请到控制台开启「匿名登录」），存储能力将降级',
        e?.message || e
      )
    }
    return app
  })()
  // 失败则清空缓存，允许下次重试（例如用户中途补配了 envId）
  cbSdkPromise.catch(() => {
    cbSdkPromise = null
  })
  return cbSdkPromise
}

/**
 * 启动时调用：H5/App 端预热 SDK（失败静默，首次真正使用时再重试）。
 * 小程序端无需任何操作（wx.cloud 由 main.ts 的 wx.cloud.init 调起）。
 */
export function initCloudSdk(): void {
  const schoolStore = useSchoolStore()
  if (!schoolStore.envId) return
  // #ifndef MP
  ensureCloudbase().catch((e) => {
    console.warn('[CampusHub] CloudBase SDK 预热失败（H5/App 图片能力将降级）', e?.message || e)
  })
  // #endif
}

/** 取文件扩展名，兜底 jpg（旧实现把所有图片硬编码为 .jpg，PNG 会丢格式） */
function extOf(p: string): string {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(p || '')
  return m ? m[1].toLowerCase() : 'jpg'
}

/**
 * 文件 ID（cloud:// 开头）→ 临时可访问 URL（跨端通用）
 *  - 小程序端：wx.cloud.getTempFileURL
 *  - H5/App 端：@cloudbase/js-sdk 的 app.getTempFileURL（v2 web API）
 * 普通 http(s) 或本地路径直接透传，避免无效调用。
 */
export async function fileIDToTempUrl(fileID: string): Promise<string> {
  if (!fileID) return ''
  // 已是可访问 URL 或本地临时路径，直接返回
  if (
    /^https?:\/\//i.test(fileID) ||
    fileID.startsWith('/') ||
    fileID.startsWith('wxfile') ||
    fileID.startsWith('blob') ||
    fileID.startsWith('data:')
  ) {
    return fileID
  }
  // #ifdef MP
  return new Promise((resolve, reject) => {
    // @ts-ignore
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res: any) => {
        const item = res.fileList?.[0]
        if (item?.tempFileURL) resolve(item.tempFileURL)
        else reject(new Error(item?.errMsg || '无法获取临时 URL'))
      },
      fail: (e: any) => reject(new Error(e.errMsg || '网络异常'))
    })
  })
  // #endif
  // #ifndef MP
  try {
    const cb = await ensureCloudbase()
    // v2 web SDK：app.getTempFileURL（官方形态），返回 { fileList: [{ fileID, tempFileURL, code }] }
    const res: any = await cb.getTempFileURL({ fileList: [fileID] })
    const item = res?.fileList?.[0] ?? res?.fileData?.[0]
    if (item?.tempFileURL) return item.tempFileURL
    console.warn('[CampusHub] getTempFileURL 未返回 tempFileURL，降级透传 fileID', res)
    return fileID
  } catch (e: any) {
    console.warn(
      '[CampusHub] H5/App 文件转链失败（@cloudbase/js-sdk 未安装或环境未配置），降级透传',
      e?.message || e
    )
    return fileID
  }
  // #endif
}

/**
 * 本地图片路径 → 上传到 CloudBase 存储 → 返回 fileID（cloud:// 开头）
 *  - 小程序端：wx.cloud.uploadFile（上传前本地压缩，控制流量与存储成本）
 *  - H5/App 端：@cloudbase/js-sdk 的 app.uploadFile（v2 web API；blob: 地址需先取回为 File）
 */
export async function uploadImage(localPath: string, cloudDir = 'campushub'): Promise<string> {
  if (!localPath) throw new Error('缺少图片路径')
  const fileName = `${cloudDir}/${Date.now()}-${Math.floor(Math.random() * 1e5)}.${extOf(localPath)}`

  // #ifdef MP
  return new Promise((resolve, reject) => {
    const upload = (path: string) =>
      // @ts-ignore
      wx.cloud.uploadFile({
        cloudPath: fileName,
        filePath: path,
        success: (r: any) => resolve(r.fileID),
        fail: (e: any) => reject(new Error(e.errMsg || '图片上传失败'))
      })
    // 先本地压缩，失败则直接传原图
    // @ts-ignore
    if (typeof wx.compressImage === 'function') {
      // @ts-ignore
      wx.compressImage({
        src: localPath,
        quality: 60,
        success: (c: any) => upload(c.tempFilePath),
        fail: () => upload(localPath)
      })
    } else {
      upload(localPath)
    }
  })
  // #endif
  // #ifndef MP
  try {
    const cb = await ensureCloudbase()
    // H5/App 端 uni.chooseImage 给的是 blob:/file: 地址，需取回为 File 才能交给 SDK
    const blobResp = await fetch(localPath)
    const blob = await blobResp.blob()
    const file =
      typeof File !== 'undefined'
        ? new File([blob], fileName.split('/').pop() as string, {
            type: blob.type || 'image/jpeg'
          })
        : blob
    // v2 web SDK：app.uploadFile（官方形态）。以返回的 fileID 为准，勿手工拼接 cloud:// 地址
    const upRes: any = await cb.uploadFile({ cloudPath: fileName, filePath: file })
    if (!upRes?.fileID) throw new Error('上传完成但未返回 fileID')
    return upRes.fileID as string
  } catch (e: any) {
    console.error('[CampusHub] H5/App 图片上传失败', e?.message || e)
    // 带上真实原因：SDK 已随包安装，失败常见于「未填 envId / 未开匿名登录 / 网络异常」
    throw new Error(
      `图片上传失败：${e?.message || e}（排查：school.config.js 的 envId 是否已填、CloudBase 是否已开启「匿名登录」）`
    )
  }
  // #endif
}
