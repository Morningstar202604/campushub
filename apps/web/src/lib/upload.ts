import { http, getAccessToken } from '@/lib/http'
import { USE_MOCK } from '@/lib/mock'

/** 客户端压缩：最长边 ≤ 1600px、JPEG 质量 0.85；小图/PNG 原样返回 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const isJpeg = file.type === 'image/jpeg'
  const img = await loadImage(file)
  const MAX = 1600
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  // 无需缩放且已是 JPEG/PNG：直接返回（PNG 保留透明，小图保留清晰度）
  if (scale >= 1 && (isJpeg || file.type === 'image/png')) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))), 'image/jpeg', 0.85)
  })
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片解析失败，请换一张')) }
    img.src = url
  })
}

function toForm(files: Blob[]): FormData {
  const form = new FormData()
  for (const f of files) {
    form.append('files', f, (f as File).name || 'image.jpg')
  }
  return form
}

/** 上传图片（自动压缩），返回可公开访问的 URL 列表（相对路径 /static/xxx） */
export async function uploadImages(files: (File | Blob)[], prefix = 'u'): Promise<string[]> {
  if (!files.length) return []
  const compressed = await Promise.all(files.map(compressImage))
  const data = await http.post<{ urls: string[] }>('/upload/images', undefined, {
    formData: toForm(compressed),
  })
  return data.urls ?? []
}

/** 带进度上传（XHR 上报 0-1；内部先压缩）。mock 模式退化为无进度直传 */
export function uploadImagesWithProgress(
  files: (File | Blob)[],
  onProgress?: (ratio: number) => void,
  prefix = 'u',
): Promise<string[]> {
  if (USE_MOCK) return uploadImages(files, prefix)
  return (async () => {
    if (!files.length) return []
    const compressed = await Promise.all(files.map(compressImage))
    const base = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '')
    const res = await new Promise<{ urls?: string[] }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${base}/api/upload/images`)
      const token = getAccessToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.min(1, e.loaded / e.total))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            reject(new Error('上传响应解析失败'))
          }
        } else {
          let msg = '上传失败，请重试'
          try {
            const j = JSON.parse(xhr.responseText)
            if (j?.message) msg = Array.isArray(j.message) ? j.message.join('；') : j.message
          } catch { /* 保留默认文案 */ }
          if (xhr.status === 401) msg = '登录已过期，请重新登录后再上传'
          reject(new Error(msg))
        }
      }
      xhr.onerror = () => reject(new Error('网络异常，请稍后重试'))
      xhr.send(toForm(compressed))
    })
    return res.urls ?? []
  })()
}

/** 相对路径 → 完整可访问 URL（开发环境指向 API 服务器） */
export function resolveStaticUrl(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  const base = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}${path}`
}
