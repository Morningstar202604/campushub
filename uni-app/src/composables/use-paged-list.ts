// 共享数据 hook：把 z-paging 与 callFunction 解耦，所有列表页复用
// 契约对齐 cloudfunctions/*-list/index.js 的 ok({ list, hasMore })
//
// z-paging v2 真实 API（已核对官方文档 https://z-paging.com/api/methods）：
//   reload(showRefreshAnimation?)                      重新加载，pageNo 复位
//   complete(data?, success?)                          请求结束；data.length < pageSize ⇒ 判定没有更多
//   completeByNoMore(data, noMore, success?)           自行判断是否有更多   ← 本 hook 采用
//   completeByTotalCount(data, totalCount, success?)   按总数判断
//   completeByError(cause)                             请求失败（v2.6.3+）
//   ⚠️ 不存在 completeByData / completeError —— 早期代码误用会在首屏抛 TypeError
//
// 列表渲染走 v-model（z-paging 1.8.4+）：<z-paging v-model="list" ...>
// 不要再 watch pagingRef.value.dataList —— 那是内部实现细节，且首次渲染时机不可靠。
import { ref, isRef, type Ref } from 'vue'
import { callFunction } from '@/utils/api'

export interface UsePagedListOptions<T> {
  /** 云函数名（post-list / product-list / ...） */
  fnName: string
  /** 默认 query 参数（page/pageSize 自动注入）。可传普通对象或 ref/computed（响应式筛选） */
  query?: Record<string, any> | Ref<Record<string, any>>
  /** 数据适配层：raw → view 模型（字段映射 + 时间格式化） */
  adapt?: (raw: any, ctx: { page: number; index: number }) => T
  /**
   * 响应体里承载数据数组的键名，默认 'list'。
   * 后端并非所有列表契约都叫 list —— guide-list 是 'guides'、user-profile 是 'posts'，
   * 早期每个这种页面都得放弃本 hook 手写一套 z-paging 逻辑（重复且易错）。
   * 响应体本身是裸数组时自动识别，无需设置。
   */
  listKey?: string
  /** 响应体里「还有更多」的键名，默认 'hasMore' */
  hasMoreKey?: string
}

/**
 * 通用列表 hook
 * 用法：
 *   const { pagingRef, list, queryList, error, reload } = usePagedList({ fnName: 'post-list', adapt: adaptWall })
 *   <z-paging ref="pagingRef" v-model="list" :auto="true" @query="queryList">
 *
 * 非 list 键名的例子（校园指南）：
 *   usePagedList({ fnName: 'guide-list', query: liveQuery, adapt: adaptGuide, listKey: 'guides' })
 */
export function usePagedList<T = any>(opts: UsePagedListOptions<T>) {
  const pagingRef = ref<any>(null)
  /** 绑定给 <z-paging v-model="list">，由 z-paging 负责写入全量数据 */
  const list = ref<T[]>([]) as Ref<T[]>
  const error = ref('')
  const loading = ref(false)

  const listKey = opts.listKey || 'list'
  const hasMoreKey = opts.hasMoreKey || 'hasMore'

  function resolveQuery(): Record<string, any> {
    // 支持响应式 query（ref/computed）——筛选切换时自动取最新值
    const q: any = opts.query
    if (q && isRef(q)) return q.value || {}
    if (q && typeof q === 'object') return q
    return {}
  }

  async function queryList(page: number, size: number) {
    const paging = pagingRef.value
    if (!paging) return
    loading.value = true
    error.value = ''
    try {
      const res: any = await callFunction(opts.fnName, {
        ...resolveQuery(),
        page,
        pageSize: size
      })
      // 契约：ok({ [listKey], [hasMoreKey] }) 展开为 { success, ... }；少数函数直接返回数组
      const rawList: any[] = Array.isArray(res) ? res : (res?.[listKey] ?? [])
      const hasMore = Array.isArray(res)
        ? rawList.length === size
        : Boolean(res?.[hasMoreKey])
      const pageData: T[] = rawList.map((item: any, i: number) =>
        opts.adapt ? opts.adapt(item, { page, index: i }) : item
      )
      // 只传「当前这一页」的数组，z-paging 内部自行拼接
      paging.completeByNoMore(pageData, hasMore)
    } catch (e: any) {
      error.value = e?.message || String(e)
      console.error(`[usePagedList:${opts.fnName}]`, error.value)
      // 优先用 completeByError 把失败原因透传给 z-paging；老版本降级为 complete(false)
      if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
      else paging.complete?.(false)
    } finally {
      loading.value = false
    }
  }

  /** 重置并重新加载（首屏手动刷新、筛选切换） */
  function reload() {
    error.value = ''
    pagingRef.value?.reload?.()
  }

  return { pagingRef, list, queryList, reload, error, loading }
}
