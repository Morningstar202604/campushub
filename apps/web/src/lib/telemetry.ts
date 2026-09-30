/**
 * 轻量遥测骨架（对标大厂可观测性的最小闭环）
 * - track: 业务埋点（页面浏览 / 关键动作）
 * - captureError: 错误上报（网络 / 运行时 / 未捕获异常）
 * - 默认：内存环形队列 + console 输出；可通过 init({ endpoint }) 挂远端上报
 * 不引入第三方 SDK，后续可无缝替换为 Sentry / 自建 collector。
 */

type TelemetryEvent = {
  name: string
  payload?: Record<string, unknown>
  ts: number
  page?: string
}

type ErrorEvent = {
  message: string
  stack?: string
  context?: Record<string, unknown>
  ts: number
}

const QUEUE_LIMIT = 200
const queue: TelemetryEvent[] = []
const errors: ErrorEvent[] = []

let endpoint: string | null = null
let enabled = true

function sendBatch(body: unknown, kind: 'event' | 'error') {
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, items: body }),
      keepalive: true,
    })
  } catch { /* 遥测失败不影响业务 */ }
}

function flush() {
  if (!enabled) return
  if (queue.length >= QUEUE_LIMIT) {
    sendBatch(queue.splice(0), 'event')
  }
  if (errors.length >= QUEUE_LIMIT) {
    sendBatch(errors.splice(0), 'error')
  }
}

/** 初始化：配置远端上报地址与开关 */
export function initTelemetry(opts: { endpoint?: string; enabled?: boolean } = {}) {
  endpoint = opts.endpoint ?? null
  enabled = opts.enabled ?? true
  if (enabled && import.meta.env.DEV) {
    console.info('[telemetry] 已启用（DEV 模式仅本地记录）')
  }
}

/** 业务埋点 */
export function track(name: string, payload?: Record<string, unknown>) {
  if (!enabled) return
  const ev: TelemetryEvent = {
    name,
    payload,
    ts: Date.now(),
    page: location.hash || location.pathname,
  }
  queue.push(ev)
  if (import.meta.env.DEV) console.debug('[telemetry]', name, payload ?? '')
  flush()
}

/** 错误上报 */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!enabled) return
  const e = err instanceof Error ? err : new Error(String(err ?? '未知错误'))
  errors.push({
    message: e.message,
    stack: e.stack,
    context,
    ts: Date.now(),
  })
  if (import.meta.env.DEV) console.warn('[telemetry][error]', e.message, context ?? '')
  flush()
}

/** 获取队列（调试用） */
export function getTelemetryQueue() {
  return { queue: [...queue], errors: [...errors] }
}
