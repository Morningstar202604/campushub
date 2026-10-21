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

  // 请求序号：只认最后一次 @query 的结果，用于丢弃过期响应。
  // ⚠️ 不能用「if (loading) return」做并发保护：reload() 会先置 loading=true 再调
  //    z-paging 的 reload()，而 reload 触发的新 @query 会被这个判断直接吞掉，
  //    既不请求也不 complete，列表永久卡在「加载中」——切 tab / onShow 刷新时必现。
  let reqSeq = 0

  async function queryList(page: number, size: number) {
    const paging = pagingRef.value
    if (!paging) return
    const seq = ++reqSeq
    if (page <= 1) error.value = ''
    loading.value = true
    try {
      const res: any = await callFunction(opts.fnName, {
        ...resolveQuery(),
        page,
        pageSize: size
      })
      if (seq !== reqSeq) return
      // 契约：ok({ [listKey], [hasMoreKey] }) 展开为 { success, ... }；少数函数直接返回数组
      const rawList: any[] = Array.isArray(res) ? res : (res?.[listKey] ?? [])
      const hasMore = Array.isArray(res) ? rawList.length === size : Boolean(res?.[hasMoreKey])
      const pageData: T[] = rawList.map((item: any, i: number) =>
        opts.adapt ? opts.adapt(item, { page, index: i }) : item
      )
      // 只传「当前这一页」的数组，z-paging 内部自行拼接。
      // ⚠️ 第二参数是 noMore（没有更多），不是 hasMore —— 语义相反。
      //    z-paging 2.8.8 的类型定义写得很明确：@param noMore 是否没有更多数据；
      //    实现里 `customNoMore = nomore == true ? 1 : 0`，而 1 表示「已经没有更多」。
      //    直接传 hasMore 会让「后端还有下一页」被判成「没有更多」，第 2 页永远加载不出来。
      paging.completeByNoMore(pageData, !hasMore)
    } catch (e: any) {
      if (seq !== reqSeq) return
      error.value = String(e?.message || e)
      // 不再弹 toast：各列表页都已有页内 error 分支（带重试），toast 会盖在错误文案上重复提示。
      console.error(`[usePagedList:${opts.fnName}]`, error.value)
      // 优先用 completeByError 把失败原因透传给 z-paging；老版本降级为 complete(false)
      if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
      else paging.complete?.(false)
    } finally {
      if (seq === reqSeq) loading.value = false
    }
  }

  /** 重置并重新加载（首屏手动刷新、筛选切换） */
  function reload() {
    error.value = ''
    // 不在这里置 loading：交给 queryList 在真正发请求时管理，
    // 否则 z-paging.reload() 触发的 @query 会被并发判断挡掉。
    pagingRef.value?.reload?.()
  }

  return { pagingRef, list, queryList, reload, error, loading }
}
