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
// 自动生成的寻址表（源 = 仓库根 gateway-routes.json；改路由请改 JSON 后跑 npm run gen:gateways）
import { GATEWAY_ROUTES, USE_GATEWAY, resolveTarget, buildPayload } from '@/config/gateway-routes'

type Platform = 'miniprogram' | 'app' | 'h5'

/** REST 单次请求超时（毫秒）。云函数冷启动偶发较慢，给足 15s，避免无限挂起。 */
const REST_TIMEOUT_MS = 15000

/** 小程序端云函数调用超时（毫秒），与 REST 端对齐。 */
const WX_CLOUD_TIMEOUT_MS = 15000

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

/**
 * 将 Promise 包装为带超时的竞争 Promise。
 * 超时后主动 reject，避免 wx.cloud.callFunction 无超时机制导致永久挂起。
 */
function raceWithTimeout<T>(promise: Promise<T>, ms = 15000, label = ''): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new CloudFunctionError(`${label} 请求超时`, 'TIMEOUT')), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

/**
 * 错误信息脱敏：前端 Toast 展示时，若包含实现细节片段则替换为通用文案。
 * CloudFunctionError 本身保持原样（由后端负责友好 message），仅用于用户可见的提示。
 */
export function sanitizeForUser(raw: string): string {
  if (/cloud function|errCode|errno|internal server/i.test(raw)) return '网络异常，请稍候重试'
  return raw
}

/** 小程序端：wx.cloud.callFunction（已鉴权） */
function callViaWxCloud(name: string, data: Record<string, any>, logical?: string): Promise<any> {
  // 收敛后"调用哪个函数"与"哪个业务入口"是两个概念：前者进 SDK，后者进日志与错误文案，
  // 否则排查时会看到一堆 api-post，丢掉具体入口信息。
  const label = logical || name
  const corePromise = new Promise((resolve, reject) => {
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
          reject(new CloudFunctionError(label, body.message || body.code || '业务异常', body.code))
          return
        }
        resolve(body ?? {})
      },
      fail: (err: any) => {
        console.error(`[云函数:${name}] 调用失败`, err)
        // 网络错误友好提示：区分超时与一般网络失败
        const errMsg: string = (err?.errMsg || '').toLowerCase()
        if (/timeout|time\s*out/i.test(errMsg)) {
          reject(new CloudFunctionError('请求超时，请检查网络', 'TIMEOUT'))
        } else {
          reject(new CloudFunctionError('网络连接失败，请稍候重试', 'NETWORK_ERROR'))
        }
      }
    })
  })
  // 包装超时控制，与 REST 端对齐
  return raceWithTimeout(corePromise, WX_CLOUD_TIMEOUT_MS, `[云函数:${name}]`)
}

/**
 * H5 / App 端：CloudBase 云函数 HTTP 访问服务（REST）
 * 端点：https://{envId}.api.tcloudbasegateway.com/v1/functions/{name}?webfn=true
 */
async function callViaRest(name: string, data: Record<string, any>, logical?: string): Promise<any> {
  const label = logical || name
  const schoolStore = useSchoolStore()
  const { envId } = schoolStore
  if (!envId) {
    throw new CloudFunctionError(
      label,
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
      label,
      aborted ? `请求超时（${REST_TIMEOUT_MS / 1000}s）` : `REST 网络异常：${e?.message || e}`,
      aborted ? 'TIMEOUT' : 'NETWORK'
    )
  } finally {
    if (timer) clearTimeout(timer)
  }

  const text = await resp.text()
  // JSON.parse 失败时 parsed 设为 null，避免后续当作对象使用
  let parsed: any = null
  try {
    parsed = JSON.parse(text)
  } catch {
    /* parsed 保持 null */
  }

  // 成功：{ result, requestId, timestamp }，result 即云函数 exports.main 返回值
  if (resp.ok && parsed && 'result' in parsed) {
    const body = parsed.result
    if (body && body.success === false) {
      throw new CloudFunctionError(label, body.message || `云函数 ${name} 业务异常`, body.code)
    }
    return body ?? {}
  }

  // 失败：{ code, message, requestId } 或网关错误
  const code = String(parsed?.code || `HTTP ${resp.status}`)
  const message = parsed?.message || `云函数 ${label} 调用失败`
  console.error(`[云函数:${label}] REST 失败 ${code}`, parsed)
  throw new CloudFunctionError(label, message, code)
}

/**
 * 统一入口。三端同一调用契约：
 *   const res = await callFunction<{ list: Post[]; hasMore: boolean }>('post-list', { page: 1 })
 */
export function callFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<T> {
  // fnName 注入防护（两层）：
  //  ① 字符集校验，避免非法名字进 REST URL；
  //  ② 白名单校验 —— 只允许 gateway-routes.json 里登记过的入口。
  // 第二层是收敛点：仅靠字符集校验时，任何"能拼出合法函数名"的调用（含被 XSS/脚本
  // 污染的调用点）都能直接打到 init-db / admin 这类高危函数上；白名单后只能命中业务入口。
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(name)) throw new Error('Invalid function name')
  const target = resolveTarget(name)
  if (!Object.prototype.hasOwnProperty.call(GATEWAY_ROUTES, name)) {
    throw new Error(`未登记的云函数调用：${name}`)
  }
  // 命中网关时注入 fn，网关据此分发给对应 handler；直连函数（定时器/初始化）保持原样。
  const payload = buildPayload(name, data)
  const platform = getPlatform()
  if (platform === 'miniprogram') {
    return callViaWxCloud(target, payload, name) as Promise<T>
  }
  return callViaRest(target, payload, name) as Promise<T>
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
 * 送审图片上限：必须与后端 cloudfunctions/common/common-security.js 的 IMAGE_MAX_BYTES 一致。
 * 微信**同步** imgSecCheck 只接受 ≤1MB 图片，后端超限即抛 IMAGE_TOO_LARGE；
 * 若前端仍按 10MB 放行，用户会看到「上传成功、发布失败」，且 9 图里夹一张大图就整条被拒。
 */
const IMAGE_AUDIT_MAX_BYTES = 1024 * 1024
/** 质量阶梯：单档压缩无法保证落到 1MB 以内，必须逐档收敛后复检。 */
const COMPRESS_QUALITY_LADDER = [80, 60, 40, 20]

const mb = (n: number) => (n / 1024 / 1024).toFixed(2)

/**
 * H5 端图片压缩：canvas 重编码，按质量阶梯逐档尝试，逐档缩小尺寸，
 * 直到 ≤1MB 或阶梯走完。App 端优先走 uni.compressImage（由调用方处理）。
 * 返回的 Blob 可能仍超限 —— 由调用方做最终大小校验并就地报错，不交给后端拒绝。
 */
export async function compressBlobForAudit(blob: Blob): Promise<Blob> {
  if (blob.size <= IMAGE_AUDIT_MAX_BYTES) return blob
  if (typeof document === 'undefined' || typeof Image === 'undefined') return blob
  const canvas: any = document.createElement('canvas')
  const url = URL.createObjectURL(blob)
  try {
    const img: any = await new Promise((res, rej) => {
      const i: any = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('图片解码失败'))
      i.src = url
    })
    let out: Blob = blob
    for (let step = 0; step < COMPRESS_QUALITY_LADDER.length; step++) {
      const quality = COMPRESS_QUALITY_LADDER[step] / 100
      const shrink = Math.max(0.35, 1 - step * 0.25)
      canvas.width = Math.round(img.width * shrink)
      canvas.height = Math.round(img.height * shrink)
      const ctx: any = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const next: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
      if (!next) break
      out = next
      if (out.size <= IMAGE_AUDIT_MAX_BYTES) return out
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 本地图片路径 → 上传到 CloudBase 存储 → 返回 fileID（cloud:// 开头）
 *  - 小程序端：wx.cloud.uploadFile（上传前本地压缩，控制流量与存储成本）
 *  - H5/App 端：@cloudbase/js-sdk 的 app.uploadFile（v2 web API；blob: 地址需先取回为 File）
 *
 * 上传前校验：图片必须压到 1MB 以内（与后端同步审核上限一致），格式限 JPG/PNG/GIF/BMP/WEBP。
 */
export async function uploadImage(localPath: string, cloudDir = 'campushub'): Promise<string> {
  if (!localPath) throw new Error('缺少图片路径')
  const fileName = `${cloudDir}/${Date.now()}-${Math.floor(Math.random() * 1e5)}.${extOf(localPath)}`

  // #ifdef MP
  return new Promise((resolve, reject) => {
    if (!/\.(jpe?g|png|gif|bmp|webp)$/i.test(localPath || '')) {
      reject(new Error('仅支持 JPG/PNG/GIF/BMP/WEBP 图片'))
      return
    }

    const sizeOf = (p: string) =>
      new Promise<number | null>((res) => {
        // @ts-ignore
        if (typeof wx.getFileInfo !== 'function') return res(null)
        // @ts-ignore
        wx.getFileInfo({ filePath: p, success: (i: any) => res(i.size), fail: () => res(null) })
      })

    const compressOnce = (p: string, quality: number) =>
      new Promise<string | null>((res) => {
        // @ts-ignore
        if (typeof wx.compressImage !== 'function') return res(null)
        // @ts-ignore：微信仅支持 jpeg/png 压缩
        wx.compressImage({
          src: p,
          quality,
          success: (c: any) => res(c.tempFilePath),
          fail: () => res(null)
        })
      })

    const upload = (p: string) =>
      // @ts-ignore
      wx.cloud.uploadFile({
        cloudPath: fileName,
        filePath: p,
        success: (r: any) => resolve(r.fileID),
        fail: (e: any) => reject(new Error(e.errMsg || '图片上传失败'))
      })

    void (async () => {
      let current = localPath
      let size = await sizeOf(current)
      // wx.compressImage 只吃 jpeg/png；gif/bmp/webp 无法压缩，
      // 超限时只能拒绝并提示用户预先缩小，绝不静默上传后让后端审核失败。
      const compressible = /\.(jpe?g|png)$/i.test(localPath)
      if (size && size > IMAGE_AUDIT_MAX_BYTES) {
        if (!compressible) {
          reject(new Error(`图片过大（${mb(size)}MB）且该格式不支持压缩，请改用 JPG/PNG 或先缩小尺寸`))
          return
        }
        for (let i = 0; i < COMPRESS_QUALITY_LADDER.length; i++) {
          const out = await compressOnce(current, COMPRESS_QUALITY_LADDER[i])
          if (!out) break
          current = out
          size = await sizeOf(current)
          if (size === null || size <= IMAGE_AUDIT_MAX_BYTES) break
        }
      }
      if (size && size > IMAGE_AUDIT_MAX_BYTES) {
        reject(new Error(`图片过大：压缩后仍 ${mb(size)}MB，超过审核上限 1MB，请缩小后重试`))
        return
      }
      upload(current)
    })().catch((e) => reject(e instanceof Error ? e : new Error(String(e))))
  })
  // #endif
  // #ifndef MP
  try {
    const cb = await ensureCloudbase()
    // H5/App 端 uni.chooseImage 给的是 blob:/file: 地址，需取回为 File 才能交给 SDK
    const blobResp = await fetch(localPath)
    let blob = await blobResp.blob()
    // 先压到审核上限以内再上传：App 端优先走 uni.compressImage，H5 端走 canvas 重编码
    if (blob.size > IMAGE_AUDIT_MAX_BYTES) {
      // @ts-ignore
      if (typeof uni !== 'undefined' && typeof uni.compressImage === 'function') {
        blob = await new Promise<Blob>((res) => {
          // @ts-ignore
          uni.compressImage({
            src: localPath,
            quality: COMPRESS_QUALITY_LADDER[0],
            success: async (r: any) => {
              try {
                res(await (await fetch(r.tempFilePath)).blob())
              } catch {
                res(blob)
              }
            },
            fail: () => res(blob)
          })
        })
      }
      if (blob.size > IMAGE_AUDIT_MAX_BYTES) blob = await compressBlobForAudit(blob)
      if (blob.size > IMAGE_AUDIT_MAX_BYTES) {
        throw new Error(`图片过大：压缩后仍 ${mb(blob.size)}MB，超过审核上限 1MB，请缩小后重试`)
      }
    }
    const file =
      typeof File !== 'undefined'
        ? new File([blob], fileName.split('/').pop() as string, {
            type: blob.type || 'image/jpeg'
          })
        : blob
    // 扩展名校验（与后端图片白名单一致）
    if (!/\.(jpe?g|png|gif|bmp|webp)$/i.test((file as File).name || '')) {
      throw new Error('仅支持 JPG/PNG/GIF/BMP/WEBP 图片')
    }
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
