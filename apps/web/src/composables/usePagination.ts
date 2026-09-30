import { reactive, ref } from 'vue'

/**
 * 通用分页状态机：page + loading + finished + loadMore + reset
 * 封装 van-list 的滚动加载协议，消除多页复制的样板代码。
 * fetcher(page) 返回 { list, hasMore }；加载失败即终止（finished=true，等同旧行为）。
 */
export function usePagination<T>(
  fetcher: (page: number) => Promise<{ list: T[]; hasMore: boolean }>,
) {
  // 内部用 any[] 存放，对外经 reactive 断言为 T[]，规避 UnwrapRef 泛型冲突
  const list = ref<any[]>([])
  const page = ref(0)
  const loading = ref(false)
  const finished = ref(false)

  async function loadMore() {
    if (loading.value || finished.value) return
    loading.value = true
    try {
      const next = page.value + 1
      const res = await fetcher(next)
      list.value.push(...res.list)
      page.value = next
      finished.value = !res.hasMore
    } catch (e: any) {
      finished.value = true
      console.warn('[pagination] 加载失败', e?.message)
    } finally {
      loading.value = false
    }
  }

  /** 重置到第一页并重新加载 */
  async function reset() {
    list.value = []
    page.value = 0
    finished.value = false
    loading.value = false
    await loadMore()
  }

  // reactive 包裹：模板中 feed.list / feed.loading / feed.finished 自动解包
  // 对外类型按解包后形状声明（内部函数闭包仍引用原始 ref，类型无冲突）
  return reactive({ list, page, loading, finished, loadMore, reset }) as unknown as {
    list: T[]
    page: number
    loading: boolean
    finished: boolean
    loadMore: () => Promise<void>
    reset: () => Promise<void>
  }
}
