import dayjs from 'dayjs'

/** 相对时间：刚刚 / x分钟前 / x小时前 / 昨天 / MM-DD / YYYY-MM-DD */
export function fmtTime(t?: string | null): string {
  if (!t) return ''
  const d = dayjs(t)
  if (!d.isValid()) return String(t)
  const diff = Date.now() - d.valueOf()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`
  const now = dayjs()
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天'
  if (d.isSame(now, 'year')) return d.format('MM-DD')
  return d.format('YYYY-MM-DD')
}

export function fmtPrice(n: number | null | undefined): string {
  if (n == null) return ''
  return `¥${Number(n).toFixed(2).replace(/\.00$/, '')}`
}

/** 帖子类型展示名 */
export const KIND_LABEL: Record<string, string> = {
  post: '信息', task: '任务', lost: '失物', found: '招领', confession: '表白'
}

export function kindLabel(kind?: string): string {
  return KIND_LABEL[kind || ''] || '信息'
}

/** 商品成色 */
export const CONDITION_LABEL: Record<string, string> = {
  new: '全新', almost_new: '几乎全新', good: '良好', fair: '一般', damaged: '损坏'
}

export function conditionLabel(c?: string): string {
  return CONDITION_LABEL[c || ''] || c || '良好'
}
