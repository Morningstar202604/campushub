// demo-data.test.ts — 本地演示数据层的行为测试
//
// 这层代码 1258 行，此前 0 测试，而它恰好是「新克隆仓库默认形态」下唯一的数据来源。
// 已知漏洞：post-list 曾完全不读 categoryId（分类筛选在演示模式下是假的）。
// 测试直接调用真实模块，断言过滤结果，不读源码字符串。
import { test } from 'node:test'
import assert from 'node:assert'
import { loadModule } from './_harness.ts'

const memory = new Map<string, any>()

function installUni() {
  globalThis.uni = {
    showToast() {},
    getStorageSync: (k: string) => memory.get(k) ?? '',
    setStorageSync: (k: string, v: any) => memory.set(k, v),
    removeStorageSync: (k: string) => memory.delete(k),
    navigateTo() {},
    showModal() {}
  } as any
}

async function freshDemo() {
  memory.clear()
  installUni()
  delete (globalThis as any).__CALL_STUB__
  return loadModule('utils/demo-data.ts')
}

test('demo post-list：categoryId 过滤必须生效（曾经完全被忽略）', async () => {
  const demo = await freshDemo()
  const res: any = await demo.callDemo('post-list', {
    categoryId: 'c-study',
    page: 1,
    pageSize: 50
  })
  assert.ok(res.list.length > 0, '学习分类下应有种子帖子')
  for (const p of res.list) {
    assert.ok(
      p.categoryId === 'c-study' || (p.categoryPath || []).includes('c-study'),
      `不应返回其他分类的帖子：${p._id} / ${p.categoryId}`
    )
  }
})

test('demo post-list：父分类应命中其子版块内容', async () => {
  const demo = await freshDemo()
  const parent: any = await demo.callDemo('post-list', { categoryId: 'c-zone', pageSize: 50 })
  const all: any = await demo.callDemo('post-list', { pageSize: 50 })
  assert.equal(
    parent.list.length,
    all.list.length,
    '父分类 c-zone 是全部内容的祖先，结果数应与不加筛选一致'
  )
})

test('demo post-list：kinds=[lost,found] 只返回这两类', async () => {
  const demo = await freshDemo()
  const res: any = await demo.callDemo('post-list', {
    kinds: ['lost', 'found'],
    pageSize: 50
  })
  assert.ok(res.list.length > 0)
  for (const p of res.list) {
    assert.ok(['lost', 'found'].includes(p.kind), `混入了其他类型：${p.kind}`)
  }
})

test('demo post-create：落库分类由 categoryId 推导，不写死「生活」', async () => {
  const demo = await freshDemo()
  const r: any = await demo.callDemo('post-create', {
    title: 'T',
    content: 'C',
    categoryId: 'c-club',
    kind: 'post'
  })
  const detail: any = await demo.callDemo('post-detail', { postId: r.postId })
  assert.equal(detail.post.category, '社团', '分类名应来自 categories 表，而非硬编码')
  assert.deepEqual(detail.post.categoryPath, ['c-zone', 'c-club'])
})

test('demo 点赞/取消：幂等，不重复计数', async () => {
  const demo = await freshDemo()
  const before: any = await demo.callDemo('post-detail', { postId: 'p1' })
  const base = before.post.likeCount

  await demo.callDemo('like', { targetId: 'p1', type: 'post', action: 'like' })
  const after1: any = await demo.callDemo('post-detail', { postId: 'p1' })
  assert.equal(after1.post.likeCount, base + 1)

  const dup: any = await demo.callDemo('like', { targetId: 'p1', type: 'post', action: 'like' })
  assert.equal(dup.already, true, '重复点赞应幂等返回 already')
  const after2: any = await demo.callDemo('post-detail', { postId: 'p1' })
  assert.equal(after2.post.likeCount, base + 1, '重复点赞不得再加一')
})

test('demo 评论：楼中楼挂到父楼层，不跑到顶层', async () => {
  const demo = await freshDemo()
  const created: any = await demo.callDemo('comment-create', {
    targetId: 'p1',
    targetType: 'post',
    content: '子回复',
    parentId: 'cm1'
  })
  assert.ok(created.commentId, '必须返回 commentId（前端曾误读 res._id）')

  const list: any = await demo.callDemo('comment-list', { targetId: 'p1' })
  const floor = list.list.find((f: any) => f._id === 'cm1')
  assert.ok(floor, '父楼层应存在')
  assert.ok(
    floor.replies.some((r: any) => r.content === '子回复'),
    '子回复应挂在父楼层的 replies 里'
  )
  assert.ok(!list.list.some((f: any) => f.content === '子回复'), '子回复不得出现在顶层')
})

test('demo 通知：未读数走 unreadCount 字段（前端曾误读 unread）', async () => {
  const demo = await freshDemo()
  const r: any = await demo.callDemo('notification', { action: 'unreadCount' })
  assert.equal(typeof r.unreadCount, 'number')
  assert.equal(r.unread, undefined, '不应返回 unread（避免两套字段名并存）')
})

test('demo 认证：提交后 campusVerified 变为 true，新帖带 authorVerified', async () => {
  const demo = await freshDemo()
  await demo.callDemo('verify', { action: 'submit', school: 'X', studentId: '123456' })
  const st: any = await demo.callDemo('verify', { action: 'status' })
  assert.equal(st.campusVerified, true)

  const created: any = await demo.callDemo('post-create', {
    title: '认证后',
    content: 'x',
    categoryId: 'c-life',
    kind: 'post'
  })
  const d: any = await demo.callDemo('post-detail', { postId: created.postId })
  assert.equal(d.post.authorVerified, true, '认证通过后新帖应带 authorVerified')
})
