// paged-list.test.ts — usePagedList 的真实行为测试
//
// 覆盖的历史缺陷：
//   1. completeByNoMore 第二参数是 noMore（没有更多），曾被误传 hasMore → 第 2 页永远加载不出来；
//   2. reload() 曾把 loading 置 true 再调 z-paging，导致 @query 被并发守卫吞掉 → 列表永久卡加载；
//   3. 过期响应（用户快速切 tab）曾会覆盖新结果 → 用请求序号丢弃。
//
// 这些行为在旧测试里一条都没有，因为它们只做「源码里有没有某字符串」的检查。
import { test } from 'node:test'
import assert from 'node:assert'
import { loadModule, resetStores } from './_harness.ts'

/** 构造 z-paging 桩，记录传给 completeByNoMore 的参数 */
function makePaging() {
  const rec: any = { completed: null, errors: [] }
  return {
    rec,
    completeByNoMore(data: any[], noMore: boolean) {
      rec.completed = { data, noMore, count: data.length }
    },
    completeByError(msg: string) {
      rec.errors.push(msg)
    },
    reload() {
      // z-paging 的 reload 会触发 @query；测试里不自动触发，由用例显式调用 queryList
    },
    complete() {}
  }
}

async function boot(opts: { responses: any[]; failAt?: number }) {
  resetStores()
  globalThis.__UNI__ = {
    showToast() {},
    getStorageSync: () => null,
    setStorageSync() {},
    removeStorageSync() {},
    navigateTo() {},
    showModal() {}
  }
  const calls: any[] = []
  let i = 0
  globalThis.__CALL_STUB__ = async (fn: string, payload: any) => {
    calls.push({ fn, payload })
    const idx = i++
    if (opts.failAt !== undefined && idx === opts.failAt) {
      throw new Error('网络异常')
    }
    return opts.responses[Math.min(idx, opts.responses.length - 1)]
  }
  return { calls }
}

let mod: any

test('usePagedList：hasMore=true → 必须传 noMore=false', async () => {
  await boot({ responses: [{ list: [{ id: '1' }, { id: '2' }], hasMore: true }] })
  mod = await loadModule('composables/use-paged-list.ts')

  const paging = makePaging()
  const { pagingRef, queryList } = mod.usePagedList({ fnName: 'post-list' })
  pagingRef.value = paging

  await queryList(1, 2)

  assert.ok(paging.rec.completed, 'completeByNoMore 应被调用')
  assert.equal(
    paging.rec.completed.noMore,
    false,
    'hasMore=true 时 noMore 必须为 false，否则 z-paging 判定已到底，第 2 页不再加载'
  )
  assert.equal(paging.rec.completed.count, 2, '当前页数据应原样回传')
})

test('usePagedList：hasMore=false → 必须传 noMore=true', async () => {
  await boot({ responses: [{ list: [{ id: '1' }], hasMore: false }] })
  mod = await loadModule('composables/use-paged-list.ts')

  const paging = makePaging()
  const { pagingRef, queryList } = mod.usePagedList({ fnName: 'post-list' })
  pagingRef.value = paging

  await queryList(1, 20)

  assert.equal(paging.rec.completed.noMore, true)
})

test('usePagedList：裸数组响应按长度推断 hasMore', async () => {
  await boot({ responses: [[{ id: 'a' }, { id: 'b' }]] })
  mod = await loadModule('composables/use-paged-list.ts')

  const paging = makePaging()
  const { pagingRef, queryList } = mod.usePagedList({ fnName: 'post-list' })
  pagingRef.value = paging

  await queryList(1, 2)
  // 返回 2 条 == pageSize 2 → hasMore 视为 true → noMore=false
  assert.equal(paging.rec.completed.noMore, false)
})

test('usePagedList：请求失败走 completeByError，且 error 有值', async () => {
  await boot({ responses: [{}], failAt: 0 })
  mod = await loadModule('composables/use-paged-list.ts')

  const paging = makePaging()
  const { pagingRef, queryList, error } = mod.usePagedList({ fnName: 'post-list' })
  pagingRef.value = paging

  await queryList(1, 20)

  assert.equal(paging.rec.completed, null, '失败时不应调用 completeByNoMore')
  assert.equal(paging.rec.errors.length, 1, '应调用 completeByError 透传失败原因')
  assert.ok(error.value, 'error 应被设置，供页面渲染错误态')
})

test('usePagedList：reload 后 @query 不被 loading 守卫吞掉（历史死锁）', async () => {
  await boot({ responses: [{ list: [], hasMore: false }] })
  mod = await loadModule('composables/use-paged-list.ts')

  // 关键：真实 z-paging 的 reload() 会在同一 tick 内立刻触发 @query。
  // 旧实现 reload() 先把 loading 置 true，紧接着被触发的 @query 撞上 `if (loading) return`，
  // 既不发请求也不 complete → 列表永久停在加载中。
  // 这里用「reload 同步回调 queryList」精确复现该时序。
  let pending: Promise<void> | null = null
  const paging: any = {
    rec: { completed: null, errors: [] },
    completeByNoMore(data: any[], noMore: boolean) {
      this.rec.completed = { data, noMore }
    },
    completeByError(msg: string) {
      this.rec.errors.push(msg)
    },
    reload() {
      pending = queryList(1, 20)
    },
    complete() {}
  }

  const { pagingRef, queryList, reload } = mod.usePagedList({ fnName: 'post-list' })
  pagingRef.value = paging

  reload()
  if (pending) await pending
  await new Promise((r) => setTimeout(r, 30))

  assert.ok(
    paging.rec.completed,
    'reload 引发的 @query 必须真的发出并 complete，不能被 loading 守卫吞掉'
  )
})

test('usePagedList：过期响应不得覆盖新请求结果（切 tab 竞态）', async () => {
  resetStores()
  globalThis.__CALL_STUB__ = async (fn: string, payload: any) => {
    // 第 1 页请求故意慢，第 2 次请求快
    if (payload.page === 1) {
      await new Promise((r) => setTimeout(r, 80))
      return { list: [{ id: 'old' }], hasMore: false }
    }
    await new Promise((r) => setTimeout(r, 5))
    return { list: [{ id: 'new' }], hasMore: false }
  }
  mod = await loadModule('composables/use-paged-list.ts')

  const paging = makePaging()
  const { pagingRef, queryList } = mod.usePagedList({ fnName: 'post-list' })
  pagingRef.value = paging

  // 两次并发：后发的先返回，先发的后返回
  const slow = queryList(1, 20)
  const fast = queryList(2, 20)
  await Promise.all([slow, fast])

  assert.ok(paging.rec.completed, '应有完成结果')
  assert.equal(paging.rec.completed.data[0].id, 'new', '过期响应（旧请求）不得覆盖新请求的结果')
})
