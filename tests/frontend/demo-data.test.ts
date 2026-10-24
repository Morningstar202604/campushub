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

test('demo 管理台：list-reports 行结构带 reportId 与 target 摘要（曾按 _id 取键导致列表过滤空）', async () => {
  const demo = await freshDemo()
  await demo.callDemo('report', {
    targetId: 'p1',
    targetType: 'post',
    reason: 'spam',
    description: 'x'
  })
  const res: any = await demo.callDemo('admin', { action: 'list-reports' })
  assert.equal(res.list.length, 1)
  const row = res.list[0]
  assert.ok(row.reportId, '行主键必须是 reportId（管理台按它取键）')
  assert.equal(row.targetId, 'p1')
  assert.equal(row.target.status, 'normal', 'target 摘要应带被举报内容的真实状态')
  assert.ok(row.target.snippet, 'target 摘要应带内容片段')
})

test('demo 管理台：delete 处置真实生效并联动解决举报', async () => {
  const demo = await freshDemo()
  await demo.callDemo('report', { targetId: 'p1', targetType: 'post', reason: 'spam' })
  const r: any = await demo.callDemo('admin', { action: 'delete', targetType: 'post', targetId: 'p1' })
  assert.equal(r.deleted, true)

  const list: any = await demo.callDemo('post-list', { pageSize: 50 })
  assert.ok(
    !list.list.some((p: any) => p._id === 'p1'),
    '处置必须真的改数据，删掉的帖子不应再出现在信息流（不能让 UI 假装成功）'
  )

  const reports: any = await demo.callDemo('admin', { action: 'list-reports' })
  assert.equal(reports.list[0].target.status, 'deleted', '被删内容的状态应同步到举报行')
})

test('demo 管理台：pin 落盘、ban 生效、未知动作抛错', async () => {
  const demo = await freshDemo()
  const pin: any = await demo.callDemo('admin', { action: 'pin', postId: 'p1' })
  assert.equal(pin.action, 'pin')
  const detail: any = await demo.callDemo('post-detail', { postId: 'p1' })
  assert.equal(detail.post.isPinned, true, '置顶必须落盘（否则刷新即丢）')

  const ban: any = await demo.callDemo('admin', { action: 'ban', targetUserId: 'u-me' })
  assert.equal(ban.updated, 1, '封禁演示用户本人应生效')
  const me: any = await demo.callDemo('user-profile', { userId: 'u-me' })
  assert.equal(me.profile.verifyStatus, 'banned')

  await assert.rejects(
    () => demo.callDemo('admin', { action: 'no-such-action' }),
    /未知管理操作/,
    '未知动作必须抛错，与真实 admin.js 口径一致'
  )
})

test('demo 黑名单：拉黑后读侧过滤对方内容，解除后恢复（与真后端同语义）', async () => {
  const demo = await freshDemo()
  // 先触发一次写入，把完整种子状态落进存储，再往里插一条"别人发的帖子"——
  // 演示态所有 API 写的都是本人（u-me），要验证读侧过滤必须有他人内容。
  await demo.callDemo('report', { targetId: 'p1', targetType: 'post', reason: 'x' })
  const stored: any = memory.get('campushub.demo.v1')
  const raw: any = stored && stored.data !== undefined ? stored.data : stored
  raw.posts.push({
    _id: 'pz',
    userId: 'u-x',
    userNickname: '外星同学',
    userAvatar: '',
    authorVerified: false,
    isAnonymous: false,
    isPinned: false,
    schoolId: 'demo',
    categoryId: 'c-life',
    categoryPath: ['c-zone', 'c-life'],
    category: '生活',
    kind: 'post',
    title: '外星人发的帖',
    content: '应被黑名单过滤',
    images: [],
    likeCount: 0,
    commentCount: 0,
    status: 'normal',
    createdAt: new Date().toISOString()
  })
  // 保留存储里的真实版本号：写死数字会在 STORE_VERSION 升级时让整条用例静默失效
  memory.set('campushub.demo.v1', { ...raw, __v: raw.__v })
  // demo-data 的 state 是模块级缓存：必须重新加载模块才会读到新存储
  installUni()
  delete (globalThis as any).__CALL_STUB__
  const demo2 = (await loadModule('utils/demo-data.ts')) as any

  const before: any = await demo2.callDemo('post-list', { pageSize: 50 })
  assert.ok(before.list.some((p: any) => p._id === 'pz'), '前置条件：他人帖子应在列表里')

  // 不能拉黑自己
  await assert.rejects(
    () => demo2.callDemo('block', { action: 'block', targetUserId: 'u-me' }),
    /不能拉黑自己/
  )

  const r1: any = await demo2.callDemo('block', { action: 'block', targetUserId: 'u-x' })
  assert.equal(r1.blocked, true)
  assert.equal(r1.already, false)
  const r2: any = await demo2.callDemo('block', { action: 'block', targetUserId: 'u-x' })
  assert.equal(r2.already, true, '重复拉黑幂等')

  const after: any = await demo2.callDemo('post-list', { pageSize: 50 })
  assert.ok(!after.list.some((p: any) => p._id === 'pz'), '拉黑后对方内容必须从信息流消失')

  const chk: any = await demo2.callDemo('block', { action: 'check', targetUserId: 'u-x' })
  assert.equal(chk.isBlocked, true)
  const list: any = await demo2.callDemo('block', { action: 'list' })
  assert.equal(list.total, 1, '黑名单应有一条')
  assert.equal(list.list[0]._id, 'u-x')

  await demo2.callDemo('block', { action: 'unblock', targetUserId: 'u-x' })
  const restored: any = await demo2.callDemo('post-list', { pageSize: 50 })
  assert.ok(restored.list.some((p: any) => p._id === 'pz'), '解除拉黑后对方内容恢复出现')
})

test('demo 私信：发送落库 + 会话列表/线程/已读/未读数闭环', async () => {
  const demo = await freshDemo()

  // 不能给自己发
  await assert.rejects(
    () => demo.callDemo('message', { action: 'send', toUserId: 'u-me', content: 'hi' }),
    /不能给自己发私信/
  )
  // 空内容拒绝
  await assert.rejects(
    () => demo.callDemo('message', { action: 'send', toUserId: 'u-2', content: '  ' }),
    /请输入私信内容/
  )

  const r1: any = await demo.callDemo('message', { action: 'send', toUserId: 'u-2', content: '在吗' })
  assert.equal(r1.sent, true)
  assert.ok(r1.messageId)
  await new Promise((r) => setTimeout(r, 5))
  await demo.callDemo('message', { action: 'send', toUserId: 'u-2', content: '周末活动' })

  const conv: any = await demo.callDemo('message', { action: 'conversations' })
  assert.equal(conv.total, 1)
  assert.equal(conv.list[0].user._id, 'u-2')
  assert.equal(conv.list[0].user.nickname, '计算机协会', '演示态对方资料与 follow 列表同一套虚构')
  assert.equal(conv.list[0].lastMessage.content, '周末活动')
  assert.equal(conv.list[0].lastMessage.isMine, true)
  assert.equal(conv.list[0].unread, 0, '我发的消息不算我的未读')

  const thread: any = await demo.callDemo('message', { action: 'thread', withUserId: 'u-2' })
  assert.equal(thread.list.length, 2)
  assert.equal(thread.list[0].content, '在吗', '聊天流按时间正序')
  assert.equal(thread.list[0].isMine, true)

  const unread0: any = await demo.callDemo('message', { action: 'unreadCount' })
  assert.equal(unread0.unreadCount, 0)

  const read: any = await demo.callDemo('message', { action: 'read', withUserId: 'u-2' })
  assert.equal(read.read, true)
})

/* ---------------- v0.12.0 内容治理（演示层同契约） ---------------- */

test('demo 敏感词：block 词拒发、replace 词替换后落库', async () => {
  const demo = await freshDemo()
  // 种子词库：代写代考=block，加微信=replace(****)，急转=flag
  await assert.rejects(
    () =>
      demo.callDemo('post-create', {
        title: '代写代考',
        content: '价格优惠',
        categoryId: 'c-study'
      }),
    /禁止发布的词/
  )
  const res: any = await demo.callDemo('post-create', {
    title: '出闲置',
    content: '想要加微信聊',
    categoryId: 'c-study'
  })
  assert.ok(res.postId)
  const detail: any = await demo.callDemo('post-detail', { postId: res.postId })
  assert.equal(detail.post.content, '想要****聊')
})

test('demo 编辑历史：post-update 前快照旧值，revision-list 返回最近版本', async () => {
  const demo = await freshDemo()
  await demo.callDemo('post-update', { postId: 'p1', title: '改过的标题' })
  const revs: any = await demo.callDemo('revision-list', { postId: 'p1' })
  assert.ok(revs.list.length >= 1, '应至少有 1 条历史')
  assert.equal(revs.list[0].title, '图书馆四楼自习位拼团', '快照必须是编辑前的标题')
})

test('demo 管理台：admin-stats 返回聚合结构；content-restore 恢复软删帖子', async () => {
  const demo = await freshDemo()
  const stats: any = await demo.callDemo('admin-stats', { days: 7 })
  assert.ok(stats.users && stats.posts && stats.products && stats.comments && stats.queue)
  assert.equal(typeof stats.posts.normal, 'number')

  await demo.callDemo('post-delete', { postId: 'p1' })
  const bin: any = await demo.callDemo('content-restore', { action: 'list', type: 'post' })
  assert.ok(bin.list.some((x: any) => x._id === 'p1'), '删除后应出现在回收站')
  const restored: any = await demo.callDemo('content-restore', {
    action: 'restore',
    targetType: 'post',
    targetId: 'p1'
  })
  assert.equal(restored.restored, true)
  const detail: any = await demo.callDemo('post-detail', { postId: 'p1' })
  assert.equal(detail.post.status, 'normal')
})

test('demo 相关阅读：排除当前帖，最多 5 条', async () => {
  const demo = await freshDemo()
  const res: any = await demo.callDemo('post-related', { postId: 'p1' })
  assert.ok(res.list.length > 0 && res.list.length <= 5)
  assert.ok(!res.list.some((x: any) => x._id === 'p1'), '不得把当前帖推荐给自己')
})

test('demo 词库管理：新增后立即参与筛查', async () => {
  const demo = await freshDemo()
  await demo.callDemo('word-manage', {
    action: 'create',
    word: '测试禁用词',
    wordAction: 'block'
  })
  await assert.rejects(
    () =>
      demo.callDemo('post-create', {
        title: '包含测试禁用词',
        content: '正常内容',
        categoryId: 'c-study'
      }),
    /禁止发布的词/
  )
})
