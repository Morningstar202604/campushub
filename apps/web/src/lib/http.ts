// 轻量 HTTP 客户端（对标大厂会话模型）
// - access token 仅存内存（缩小 XSS 暴露面），refresh token 持久化在 localStorage
// - 401 时单飞（single-flight）调 /auth/refresh 换新 access，并重放原请求一次
// - GET 请求支持 30s 缓存（opts.cache=true 开启，写后需 force 绕过）
// - 默认 10s 超时（AbortController），错误统一 {message}

import { USE_MOCK } from './mock'
import { mockFetch } from '@/mock/api'
import { captureError } from './telemetry'

const BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '') + '/api'

const ACCESS_KEY = 'campus_access_token' // 仅用于一次性迁移旧会话，之后不再写入
const REFRESH_KEY = 'campus_refresh_token'

// 内存 access：模块级单例，不落 localStorage
let accessToken: string | null = (() => {
  try {
    const legacy = localStorage.getItem(ACCESS_KEY)
    if (legacy) localStorage.removeItem(ACCESS_KEY) // 迁移后清理旧键
    return legacy
  } catch {
    return null
  }
})()

const TIMEOUT_MS = 10_000
const CACHE_TTL = 30_000
const getCache = new Map<string, { at: number; data: unknown }>()

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export function setTokens(access: string, refresh?: string | null) {
  accessToken = access
  if (refresh) {
    try {
      localStorage.setItem(REFRESH_KEY, refresh)
    } catch { /* 隐私模式等场景忽略 */ }
  }
}

export function clearTokens() {
  accessToken = null
  try {
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(ACCESS_KEY)
  } catch { /* 忽略 */ }
}

export function hasToken(): boolean {
  return !!accessToken || !!getRefreshToken()
}

// ---------- refresh 单飞 ----------
let refreshing: Promise<string> | null = null

/** 用 refresh token 换新 token 对；并发调用共享同一次刷新 */
export async function refreshAccess(): Promise<string> {
  if (USE_MOCK) {
    const tokens = await mockFetch('POST', '/auth/refresh', { refreshToken: getRefreshToken() })
    setTokens(tokens.accessToken, tokens.refreshToken)
    return tokens.accessToken
  }
  if (refreshing) return refreshing
  refreshing = (async () => {
    const refresh = getRefreshToken()
    if (!refresh) throw new Error('登录已过期，请重新登录')
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
    const json = (await res.json().catch(() => null)) as
      | { accessToken?: string; refreshToken?: string; message?: string | string[] }
      | null
    if (!res.ok) {
      clearTokens()
      const msg = json?.message
      throw new Error(Array.isArray(msg) ? msg.join('；') : msg || '登录已过期，请重新登录')
    }
    setTokens(json?.accessToken ?? '', json?.refreshToken)
    return json?.accessToken ?? ''
  })()
  try {
    return await refreshing
  } finally {
    refreshing = null
  }
}

// ---------- 请求核心 ----------
interface RequestOptions {
  /** multipart 时传 FormData，由调用方自行设置 headers */
  formData?: FormData
  /** 仅 GET 有效：启用 30s 缓存（默认关闭，个性化接口不受影响） */
  cache?: boolean
  /** 外部取消信号 */
  signal?: AbortSignal
}

function cloneData<T>(d: T): T {
  if (typeof structuredClone === 'function') return structuredClone(d)
  return JSON.parse(JSON.stringify(d))
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  // mock 模式：统一在此层拦截，业务代码零污染
  if (USE_MOCK) return mockFetch(method, path, body, opts?.formData) as Promise<T>

  const cacheable = method === 'GET' && opts?.cache
  const ck = `${method} ${path}`
  if (cacheable) {
    const hit = getCache.get(ck)
    if (hit && Date.now() - hit.at < CACHE_TTL) return cloneData(hit.data) as T
  }

  let attempt = 0
  // 401 → 刷新 → 重放（最多一次）
  while (true) {
    attempt++
    const headers: Record<string, string> = {}
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    let payload: BodyInit | undefined
    if (opts?.formData) {
      payload = opts.formData
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    const onOuterAbort = () => ctrl.abort()
    opts?.signal?.addEventListener('abort', onOuterAbort)

    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: payload,
        signal: ctrl.signal,
      })
    } catch (e: any) {
      if (ctrl.signal.aborted && !opts?.signal?.aborted) {
        const err = new Error('请求超时，请检查网络后重试')
        captureError(err, { path })
        throw err
      }
      if (opts?.signal?.aborted) throw new Error('请求已取消')
      const err = new Error('网络异常，请稍后重试')
      captureError(err, { path, cause: e?.message })
      throw err
    } finally {
      clearTimeout(timer)
      opts?.signal?.removeEventListener('abort', onOuterAbort)
    }

    const json = (await res.json().catch(() => null)) as
      | { message?: string | string[]; data?: T }
      | null

    // 未登录/登录过期：先尝试刷新续期并重放原请求
    if (res.status === 401 && !path.startsWith('/auth/') && attempt <= 1) {
      try {
        await refreshAccess()
        continue
      } catch (e: any) {
        throw new Error(e?.message || '登录已过期，请重新登录')
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        clearTokens()
        const err = new Error('登录已过期，请重新登录')
        captureError(err, { path, status: 401 })
        throw err
      }
      const msg = json?.message
      const text = Array.isArray(msg) ? msg.join('；') : msg || `请求失败（${res.status}）`
      const err = new Error(text)
      captureError(err, { path, status: res.status })
      throw err
    }

    if (cacheable) getCache.set(ck, { at: Date.now(), data: json })
    return json as T
  }
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
