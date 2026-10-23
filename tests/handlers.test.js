// handlers.test.js — 云函数 handler 的真实行为测试（跑通业务逻辑，不是读源码）
//
// 为什么要有这个文件：此前 96 条测试里没有一条执行过 handler 的成功路径。
// 把 post-create 从 199 行删到 5 行 return ok()，测试依然 96/96 全绿。
// 这里用内存数据库真实执行 handler 源码，断言落库结果与返回契约。
const { test, beforeEach, after, afterEach } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const mem = require('./lib/memory-db')

// 加载源码 handler（不是 dist 产物）：覆盖率才有意义。
// 源码 handler 的 `require('./common-bundle')` 指向构建期内联的内核，
// 测试运行时由 mem.ensureSourceShims() 生成转发桩补上。
const CF = path.resolve(__dirname, '..', 'cloudfunctions')
const USER_OPENID = 'openid-user-1'
const ADMIN_OPENID = 'openid-admin-1'

let env

/**
 * 按「部署单元 + 业务入口」加载源码 handler。
 * 源码 handler 是 `module.exports = wrap(...)`（可调用），产物才是 exports.main。
 */
function loadUnit(unit, fn) {
  mem.ensureSourceShims()
  mem.purge(path.join('cloudfunctions', unit, 'handlers'))
  mem.purge(path.join('cloudfunctions', 'common'))
  const mod = require(path.join(CF, unit, 'handlers', fn + '.js'))
  const handler = typeof mod === 'function' ? mod : mod.main
  return { main: (event) => handler(event) }
}

function okOpenapi() {
  return {
    security: {
      msgSecCheck: async () => ({}),
      imgSecCheck: async () => ({})
    }
  }
}

/**
 * 切换当前调用者身份。
 * 必须同时做两件事：换 wxContext 桩 + 清 common 缓存 —— common-bundle 的
 * getWXContext 闭包绑定在 require 时的那份桩上，只换桩不重载会继续用旧身份。
 */
function actAs(openid) {
  env.restore()
  env = mem.install({ wxContext: { OPENID: openid }, openapi: okOpenapi() })
  mem.purge(path.join('cloudfunctions', 'common'))
}

function seedUser(over = {}) {
  const data = {
    _id: 'u1',
    openid: USER_OPENID,
    nickname: '测试同学',
    avatar: '',
    schoolId: 's1',
    school: '测试大学',
    verifyStatus: 'unverified',
    campusVerified: false,
    campusVerifyStatus: 'none',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    collectCount: 0,
    followerCount: 0,
    followingCount: 0,
    checkinStreak: 0,
    lastCheckinDate: '',
    renameTokens: 0,
    ...over
  }
  mem.coll('users').set(data._id, data)
  return data
}

function seedCategories() {
  mem.coll('categories').set('c-root', {
    _id: 'c-root',
    name: '本校',
    parentId: '',
    level: 1,
    status: 'active',
    schoolId: 's1'
  })
  mem.coll('categories').set('c-leaf', {
    _id: 'c-leaf',
    name: '学习',
    parentId: 'c-root',
    level: 2,
    status: 'active',
    schoolId: 's1'
  })
}

beforeEach(() => {
  mem.reset()
  env = mem.install({ wxContext: { OPENID: USER_OPENID }, openapi: okOpenapi() })
  // 限频窗口按真实时间计算，同一进程内连续用例会互相挡住；
  // 每个用例从干净窗口开始（限频本身有独立测试覆盖）。
  mem.coll('rate_limits').clear()
  process.env.ADMIN_OPENIDS = ADMIN_OPENID
  seedUser()
  seedCategories()
})

afterEach(() => {
  env.restore()
  delete process.env.ADMIN_OPENIDS
})

/* ------------------------------ post-create ------------------------------ */

test('post-create：真实落库，字段与计数正确', async () => {
  const { main } = loadUnit('api-post', 'post-create')
  const res = await main({
    title: '测试标题',
    content: '测试内容',
    categoryId: 'c-leaf',
    kind: 'post'
  })

  assert.equal(res.success, true, '应返回 success')
  assert.ok(res.postId, '应返回 postId')

  const doc = mem.coll('posts').get(res.postId)
  assert.ok(doc, '帖子必须真的落库')
  assert.equal(doc.title, '测试标题')
  assert.equal(doc.content, '测试内容')
  assert.equal(doc.status, 'normal')
  assert.equal(doc.likeCount, 0)
  assert.equal(doc.commentCount, 0)
  assert.equal(doc.userId, 'u1', '作者必须是当前登录用户')
  assert.deepEqual(doc.categoryPath, ['c-root', 'c-leaf'], '分类链必须服务端推导')
  assert.equal(mem.coll('users').get('u1').postCount, 1, '用户发帖数应 +1')
})

test('post-create：表白帖强制匿名且不要求标题', async () => {
  mem.coll('rate_limits').clear()
  const { main } = loadUnit('api-post', 'post-create')
  const res = await main({
    title: '',
    content: '表白内容',
    categoryId: 'c-leaf',
    kind: 'confession',
    isAnonymous: false
  })
  assert.equal(res.success, true, JSON.stringify(res))
  const doc = mem.coll('posts').get(res.postId)
  assert.equal(doc.isAnonymous, true, '表白墙必须强制匿名，客户端传 false 不算数')
  assert.equal(doc.userNickname, '匿名同学')
})

test('post-create：父分类必须拒绝（要求叶子）', async () => {
  const { main } = loadUnit('api-post', 'post-create')
  const res = await main({ title: 'T', content: 'C', categoryId: 'c-root', kind: 'post' })
  assert.equal(res.success, false)
  assert.match(res.message, /更具体/)
})

test('post-create：标题超长拒绝', async () => {
  const { main } = loadUnit('api-post', 'post-create')
  const res = await main({ title: 'x'.repeat(31), content: 'C', categoryId: 'c-leaf' })
  assert.equal(res.success, false)
  assert.match(res.message, /30/)
})

test('post-create：幂等 —— 同一 clientReqId 不产生双帖', async () => {
  // 幂等靠 idx_idempotency_reqid 唯一索引，测试桩必须同构声明
  mem.setUnique('idempotency', ['clientReqId'])
  const { main } = loadUnit('api-post', 'post-create')
  const payload = {
    title: '幂等测试',
    content: 'C',
    categoryId: 'c-leaf',
    clientReqId: 'req-1'
  }
  const r1 = await main(payload)
  // 清限频窗口：幂等语义测的是「同一次提交的重复请求」，与限频无关
  mem.coll('rate_limits').clear()
  const r2 = await main(payload)
  assert.equal(r1.success, true)
  assert.equal(r2.success, true)
  assert.equal(r2.postId, r1.postId, '重复请求应返回同一 postId')
  assert.equal(mem.coll('posts').size, 1, '只能落库一条')
})

/* ------------------------------ post-list ------------------------------ */

test('post-list：只返回 normal 状态，且支持 kind 过滤', async () => {
  const mk = (id, kind, status) =>
    mem.coll('posts').set(id, {
      _id: id,
      title: id,
      kind,
      status,
      createdAt: new Date(),
      isPinned: false,
      likeCount: 0
    })
  mk('p1', 'post', 'normal')
  mk('p2', 'confession', 'normal')
  mk('p3', 'post', 'deleted')

  const { main } = loadUnit('api-post', 'post-list')
  const all = await main({ tab: 'latest' })
  assert.equal(all.list.length, 2, 'deleted 不应出现')
  const onlyPost = await main({ tab: 'latest', kind: 'post' })
  assert.equal(onlyPost.list.length, 1)
  assert.equal(onlyPost.list[0]._id, 'p1')
})

test('post-list：kinds 多选过滤（失物页「全部」用）', async () => {
  for (const [id, kind] of [
    ['p1', 'lost'],
    ['p2', 'found'],
    ['p3', 'post']
  ]) {
    mem.coll('posts').set(id, {
      _id: id,
      kind,
      status: 'normal',
      createdAt: new Date(),
      isPinned: false,
      likeCount: 0
    })
  }
  const { main } = loadUnit('api-post', 'post-list')
  const res = await main({ kinds: ['lost', 'found'] })
  assert.equal(res.list.length, 2)
  assert.ok(res.list.every((p) => ['lost', 'found'].includes(p.kind)))
})

test('post-list：hasMore 反映是否还有下一页', async () => {
  for (let i = 0; i < 3; i++) {
    mem.coll('posts').set(`p${i}`, {
      _id: `p${i}`,
      status: 'normal',
      createdAt: new Date(Date.now() - i * 1000),
      isPinned: false,
      likeCount: 0
    })
  }
  const { main } = loadUnit('api-post', 'post-list')
  const page1 = await main({ page: 1, pageSize: 2 })
  assert.equal(page1.list.length, 2)
  assert.equal(page1.hasMore, true, '还有第 3 条，hasMore 应为 true')
  const page2 = await main({ page: 2, pageSize: 2 })
  assert.equal(page2.list.length, 1)
  assert.equal(page2.hasMore, false)
})

/* ------------------------------ post-update ------------------------------ */

test('post-update：非作者不能编辑他人帖子', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', title: '原' })
  const { main } = loadUnit('api-post', 'post-update')
  const res = await main({ postId: 'p1', title: '篡改' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
  assert.equal(mem.coll('posts').get('p1').title, '原', '不得被修改')
})

test('post-update：作者可改，且 categoryPath 由服务端重算', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'u1',
    status: 'normal',
    title: '原',
    content: 'c',
    kind: 'post',
    categoryPath: ['old']
  })
  const { main } = loadUnit('api-post', 'post-update')
  const res = await main({ postId: 'p1', title: '新标题', categoryId: 'c-leaf' })
  assert.equal(res.success, true)
  const doc = mem.coll('posts').get('p1')
  assert.equal(doc.title, '新标题')
  assert.deepEqual(doc.categoryPath, ['c-root', 'c-leaf'], '必须忽略客户端传值')
})

/* ------------------------------ post-delete ------------------------------ */

test('post-delete：软删 + 计数回退 + 重复删除幂等', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'u1', status: 'normal', images: [] })
  mem.coll('users').get('u1').postCount = 1

  const { main } = loadUnit('api-post', 'post-delete')
  const r1 = await main({ postId: 'p1' })
  assert.equal(r1.success, true)
  assert.equal(mem.coll('posts').get('p1').status, 'deleted')
  assert.equal(mem.coll('users').get('u1').postCount, 0, '应回退 postCount')

  const r2 = await main({ postId: 'p1' })
  assert.equal(r2.success, true, '重复删除应幂等成功')
  assert.equal(mem.coll('users').get('u1').postCount, 0, '不得二次扣减')
})

test('post-delete：非作者且非管理员拒绝', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal' })
  const { main } = loadUnit('api-post', 'post-delete')
  const res = await main({ postId: 'p1' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
})

/* ------------------------------ post-detail ------------------------------ */

test('post-detail：匿名帖脱敏，普通帖保留 userId', async () => {
  mem.coll('posts').set('anon', {
    _id: 'anon',
    userId: 'real-user',
    userNickname: '匿名同学',
    isAnonymous: true,
    status: 'normal'
  })
  mem.coll('posts').set('normal', {
    _id: 'normal',
    userId: 'real-user',
    userNickname: '张三',
    isAnonymous: false,
    status: 'normal'
  })

  const { main } = loadUnit('api-post', 'post-detail')
  const a = await main({ postId: 'anon' })
  assert.equal(a.success, true)
  assert.equal(a.post.userId, '', '匿名帖不得下发真实 userId')
  assert.equal(a.post.userNickname, '匿名同学')

  const n = await main({ postId: 'normal' })
  assert.equal(n.post.userId, 'real-user', '普通帖保留作者 id')
})

/* ------------------------------ like / collect ------------------------------ */

test('like：点赞幂等，计数只加一次', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', likeCount: 0 })
  mem.setUnique('likes', ['userId', 'targetId', 'type'])

  const { main } = loadUnit('api-social', 'like')
  const r1 = await main({ targetId: 'p1', type: 'post', action: 'like' })
  assert.equal(r1.liked, true)
  assert.equal(mem.coll('posts').get('p1').likeCount, 1)

  const r2 = await main({ targetId: 'p1', type: 'post', action: 'like' })
  assert.equal(r2.already, true, '重复点赞应幂等')
  assert.equal(mem.coll('posts').get('p1').likeCount, 1, '不得重复计数')

  await main({ targetId: 'p1', type: 'post', action: 'unlike' })
  assert.equal(mem.coll('posts').get('p1').likeCount, 0)
})

test('like：目标不存在时拒绝', async () => {
  mem.setUnique('likes', ['userId', 'targetId', 'type'])
  const { main } = loadUnit('api-social', 'like')
  const res = await main({ targetId: 'nope', type: 'post', action: 'like' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'NOT_FOUND')
})

test('collect：收藏/取消收藏，用户与目标计数同步', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', collectCount: 0 })
  mem.setUnique('collects', ['userId', 'targetId', 'type'])
  const { main } = loadUnit('api-social', 'collect')

  const r1 = await main({ targetId: 'p1', type: 'post', action: 'collect' })
  assert.equal(r1.collected, true)
  assert.equal(mem.coll('posts').get('p1').collectCount, 1)
  assert.equal(mem.coll('users').get('u1').collectCount, 1)

  const r2 = await main({ targetId: 'p1', type: 'post', action: 'collect' })
  assert.equal(r2.already, true, '重复收藏幂等')

  await main({ targetId: 'p1', type: 'post', action: 'uncollect' })
  assert.equal(mem.coll('posts').get('p1').collectCount, 0)
})

/* ------------------------------ comment ------------------------------ */

test('comment-create：落库 + 目标计数 +1 + 返回 commentId', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', commentCount: 0 })
  const { main } = loadUnit('api-comment', 'comment-create')
  const res = await main({ targetId: 'p1', targetType: 'post', content: '第一条' })
  assert.equal(res.success, true)
  assert.ok(res.commentId, '必须返回 commentId（前端曾误读 res._id）')
  assert.equal(mem.coll('comments').size, 1)
  assert.equal(mem.coll('posts').get('p1').commentCount, 1)
})

test('comment-create：空内容拒绝', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', commentCount: 0 })
  const { main } = loadUnit('api-comment', 'comment-create')
  const res = await main({ targetId: 'p1', targetType: 'post', content: '   ' })
  assert.equal(res.success, false)
})

test('comment-create：父评论不属于同一目标时拒绝（楼中楼越界）', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', commentCount: 0 })
  mem.coll('comments').set('cm1', {
    _id: 'cm1',
    targetId: 'OTHER',
    targetType: 'post',
    status: 'normal'
  })
  const { main } = loadUnit('api-comment', 'comment-create')
  const res = await main({
    targetId: 'p1',
    targetType: 'post',
    content: '回复',
    parentId: 'cm1'
  })
  assert.equal(res.success, false)
})

test('comment-list：主楼层 + 楼中楼挂在正确楼层下', async () => {
  mem.coll('comments').set('f1', {
    _id: 'f1',
    targetId: 'p1',
    parentId: null,
    status: 'normal',
    content: '楼层',
    createdAt: new Date(1)
  })
  mem.coll('comments').set('r1', {
    _id: 'r1',
    targetId: 'p1',
    parentId: 'f1',
    status: 'normal',
    content: '回复',
    createdAt: new Date(2)
  })
  mem.coll('comments').set('f2', {
    _id: 'f2',
    targetId: 'p1',
    parentId: null,
    status: 'normal',
    content: '另一楼',
    createdAt: new Date(3)
  })

  const { main } = loadUnit('api-comment', 'comment-list')
  const res = await main({ targetId: 'p1' })
  assert.equal(res.success, true)
  assert.equal(res.list.length, 2, '只应有 2 个主楼层')
  const floor = res.list.find((f) => f._id === 'f1')
  assert.equal(floor.replies.length, 1)
  assert.equal(floor.replies[0]._id, 'r1')
})

test('comment-list：已删除评论不出现', async () => {
  mem.coll('comments').set('f1', {
    _id: 'f1',
    targetId: 'p1',
    parentId: null,
    status: 'deleted',
    content: '删了',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-comment', 'comment-list')
  const res = await main({ targetId: 'p1' })
  assert.equal(res.list.length, 0)
})

test('comment-delete：主楼层级联软删子回复，计数回退', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', commentCount: 2 })
  mem.coll('comments').set('f1', {
    _id: 'f1',
    targetId: 'p1',
    targetType: 'post',
    userId: 'u1',
    parentId: null,
    status: 'normal'
  })
  mem.coll('comments').set('r1', {
    _id: 'r1',
    targetId: 'p1',
    targetType: 'post',
    userId: 'u1',
    parentId: 'f1',
    status: 'normal'
  })

  const { main } = loadUnit('api-comment', 'comment-delete')
  const res = await main({ commentId: 'f1' })
  assert.equal(res.success, true)
  assert.equal(mem.coll('comments').get('f1').status, 'deleted')
  assert.equal(mem.coll('comments').get('r1').status, 'deleted', '子回复应级联删除')
  assert.equal(mem.coll('posts').get('p1').commentCount, 0, '两条评论都应回退')
})

/* ------------------------------ follow ------------------------------ */

test('follow：关注/取关计数正确，不能关注自己', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2', nickname: '被关注' })
  mem.setUnique('follows', ['followerId', 'followingId'])

  const { main } = loadUnit('api-social', 'follow')
  const self = await main({ action: 'follow', targetUserId: 'u1' })
  assert.equal(self.success, false, '不能关注自己')

  const r = await main({ action: 'follow', targetUserId: 'u2' })
  assert.equal(r.following, true)
  assert.equal(mem.coll('users').get('u1').followingCount, 1)
  assert.equal(mem.coll('users').get('u2').followerCount, 1)

  const un = await main({ action: 'unfollow', targetUserId: 'u2' })
  assert.equal(un.following, false)
  assert.equal(mem.coll('users').get('u2').followerCount, 0)
})

test('follow：check 返回关注态', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  mem.coll('follows').set('f1', { _id: 'f1', followerId: 'u1', followingId: 'u2' })
  const { main } = loadUnit('api-social', 'follow')
  const res = await main({ action: 'check', targetUserId: 'u2' })
  assert.equal(res.isFollowing, true)
})

/* ------------------------------ block ------------------------------ */

test('block：拉黑/取消/幂等，不能拉黑自己，目标必须存在', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  mem.setUnique('blocks', ['blockerId', 'blockedId'])

  const { main } = loadUnit('api-social', 'block')

  const self = await main({ action: 'block', targetUserId: 'u1' })
  assert.equal(self.success, false, '不能拉黑自己')
  assert.equal(self.code, 'INVALID_PARAM')

  const ghost = await main({ action: 'block', targetUserId: 'u-nope' })
  assert.equal(ghost.success, false, '目标用户不存在必须拒绝')
  assert.equal(ghost.code, 'NOT_FOUND')

  const r1 = await main({ action: 'block', targetUserId: 'u2' })
  assert.equal(r1.success, true)
  assert.equal(r1.blocked, true)
  assert.equal(r1.already, false)
  assert.equal(mem.coll('blocks').size, 1, '拉黑必须落库')

  const r2 = await main({ action: 'block', targetUserId: 'u2' })
  assert.equal(r2.already, true, '重复拉黑按幂等处理，不是错误')
  assert.equal(mem.coll('blocks').size, 1, '重复拉黑不得产生第二条记录')

  const chk = await main({ action: 'check', targetUserId: 'u2' })
  assert.equal(chk.isBlocked, true)

  const un = await main({ action: 'unblock', targetUserId: 'u2' })
  assert.equal(un.blocked, false)
  assert.equal(mem.coll('blocks').size, 0, '取消拉黑必须真的删除')
  const chk2 = await main({ action: 'check', targetUserId: 'u2' })
  assert.equal(chk2.isBlocked, false)
})

test('block：list 返回黑名单用户资料', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2', nickname: '被拉黑' })
  mem.coll('blocks').set('b1', { _id: 'b1', blockerId: 'u1', blockedId: 'u2' })
  const { main } = loadUnit('api-social', 'block')
  const res = await main({ action: 'list' })
  assert.equal(res.total, 1)
  assert.equal(res.list[0]._id, 'u2')
  assert.equal(res.list[0].nickname, '被拉黑')
})

test('block：未知动作拒绝', async () => {
  const { main } = loadUnit('api-social', 'block')
  const r = await main({ action: 'no-such' })
  assert.equal(r.success, false)
  assert.equal(r.code, 'INVALID_PARAM')
})

test('黑名单读侧过滤：post-list 对拉黑方隐藏对方内容，他人与游客不受影响', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  seedUser({ _id: 'u3', openid: 'openid-3' })
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'u1', status: 'normal', kind: 'post', createdAt: 3 })
  mem.coll('posts').set('p2', { _id: 'p2', userId: 'u2', status: 'normal', kind: 'post', createdAt: 2 })
  mem.coll('posts').set('p3', { _id: 'p3', userId: 'u3', status: 'normal', kind: 'post', createdAt: 1 })

  const { main: blockMain } = loadUnit('api-social', 'block')
  await blockMain({ action: 'block', targetUserId: 'u2' })

  const { main: postList } = loadUnit('api-post', 'post-list')
  const mine = await postList({})
  const ids = (mine.list || []).map((p) => p._id)
  assert.ok(ids.includes('p1') && ids.includes('p3'), '自己与无关用户的内容应在')
  assert.ok(!ids.includes('p2'), '被拉黑用户的内容必须被过滤掉')

  // 换身份必须重新 loadUnit：handler 的 require 闭包绑在加载时的那份内核/桩上
  actAs('openid-3')
  const { main: postListOther } = loadUnit('api-post', 'post-list')
  const others = await postListOther({})
  assert.ok((others.list || []).some((p) => p._id === 'p2'), '拉黑是单向的：他人视角应仍能看到')

  actAs('') // 游客：无黑名单，不加过滤条件
  const { main: postListGuest } = loadUnit('api-post', 'post-list')
  const guest = await postListGuest({})
  assert.ok((guest.list || []).some((p) => p._id === 'p2'), '游客视角应看到全部内容')
})

test('黑名单读侧过滤：product-list 对拉黑方隐藏对方商品', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  mem.coll('products').set('pr1', { _id: 'pr1', userId: 'u1', status: 'on_sale', createdAt: 2 })
  mem.coll('products').set('pr2', { _id: 'pr2', userId: 'u2', status: 'on_sale', createdAt: 1 })

  const { main: blockMain } = loadUnit('api-social', 'block')
  await blockMain({ action: 'block', targetUserId: 'u2' })

  const { main: productList } = loadUnit('api-product', 'product-list')
  const res = await productList({})
  const ids = (res.list || []).map((p) => p._id)
  assert.ok(ids.includes('pr1'))
  assert.ok(!ids.includes('pr2'), '被拉黑用户的商品必须被过滤掉')
})

test('黑名单读侧过滤：comment-list 隐藏对方楼层与回复，且不留孤儿楼层', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  mem.coll('comments').set('f1', { _id: 'f1', targetId: 'p1', userId: 'u1', status: 'normal', parentId: null, createdAt: 1 })
  mem.coll('comments').set('f2', { _id: 'f2', targetId: 'p1', userId: 'u2', status: 'normal', parentId: null, createdAt: 2 })
  mem.coll('comments').set('r1', { _id: 'r1', targetId: 'p1', userId: 'u2', status: 'normal', parentId: 'f1', createdAt: 3 })
  mem.coll('comments').set('r2', { _id: 'r2', targetId: 'p1', userId: 'u1', status: 'normal', parentId: 'f2', createdAt: 4 })

  const { main: blockMain } = loadUnit('api-social', 'block')
  await blockMain({ action: 'block', targetUserId: 'u2' })

  const { main: commentList } = loadUnit('api-comment', 'comment-list')
  const res = await commentList({ targetId: 'p1' })
  const floorIds = (res.list || []).map((f) => f._id)
  assert.deepEqual(floorIds, ['f1'], '被拉黑用户的楼层必须消失')
  const replyIds = (res.list[0].replies || []).map((r) => r._id)
  assert.deepEqual(replyIds, [], '被拉黑用户在我的楼层下的回复也必须消失')
  // 未拉黑时两层都在（对照：证明上面的过滤来自黑名单而非查询写错）
  const { main: blockOff } = loadUnit('api-social', 'block')
  await blockOff({ action: 'unblock', targetUserId: 'u2' })
  const res2 = await commentList({ targetId: 'p1' })
  assert.equal(res2.list.length, 2, '取消拉黑后双方内容都应恢复')
})

test('user-profile：isBlocked 随拉黑状态变化，本人页恒 false', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  const { main: blockMain } = loadUnit('api-social', 'block')
  const { main: profile } = loadUnit('api-auth', 'user-profile')

  const before = await profile({ userId: 'u2' })
  assert.equal(before.success, true)
  assert.equal(before.isBlocked, false)

  await blockMain({ action: 'block', targetUserId: 'u2' })
  const after = await profile({ userId: 'u2' })
  assert.equal(after.isBlocked, true, '拉黑后他人主页应带回拉黑态（前端显示「已拉黑」）')

  const mine = await profile({ userId: 'u1' })
  assert.equal(mine.isBlocked, false, '本人主页不显示拉黑态')
})

/* ------------------------------ message ------------------------------ */

test('message：发送落库 + 对方收到通知；空内容/超长/自发/不存在目标一律拒绝', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2', nickname: '接收方' })
  const { main } = loadUnit('api-social', 'message')

  const empty = await main({ action: 'send', toUserId: 'u2', content: '   ' })
  assert.equal(empty.success, false, '空白内容必须拒绝')

  const tooLong = await main({ action: 'send', toUserId: 'u2', content: 'x'.repeat(501) })
  assert.equal(tooLong.success, false, '超 500 字必须拒绝')

  const self = await main({ action: 'send', toUserId: 'u1', content: 'hi' })
  assert.equal(self.success, false, '不能给自己发私信')

  const ghost = await main({ action: 'send', toUserId: 'u-nope', content: 'hi' })
  assert.equal(ghost.success, false, '目标不存在必须拒绝')
  assert.equal(ghost.code, 'NOT_FOUND')

  const r = await main({ action: 'send', toUserId: 'u2', content: '你好' })
  assert.equal(r.success, true)
  assert.ok(r.messageId, '必须回传 messageId')
  assert.equal(mem.coll('messages').size, 1, '私信必须落库')
  const doc = [...mem.coll('messages').values()][0]
  assert.equal(doc.conversationId, 'u1__u2', '会话 id 必须是双方 id 的排序拼接')
  assert.equal(doc.isRead, false)

  const notices = [...mem.coll('notifications').values()]
  assert.equal(notices.length, 1, '接收方应收到一条站内通知')
  assert.equal(notices[0].type, 'message')
  assert.equal(notices[0].userId, 'u2')
})

test('message：会话列表回填对方资料与未读数，thread 带 isMine 且按时间正序', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2', nickname: '接收方' })
  const { main } = loadUnit('api-social', 'message')

  await main({ action: 'send', toUserId: 'u2', content: '第一条' })
  await new Promise((r) => setTimeout(r, 5)) // 让两条消息的 createdAt 可区分（同毫秒并列时预览取哪条是边缘态）
  await main({ action: 'send', toUserId: 'u2', content: '第二条' })

  const conv = await main({ action: 'conversations' })
  assert.equal(conv.total, 1)
  assert.equal(conv.list[0].user._id, 'u2')
  assert.equal(conv.list[0].user.nickname, '接收方')
  assert.equal(conv.list[0].lastMessage.content, '第二条', '列表应展示最新一条')
  assert.equal(conv.list[0].lastMessage.isMine, true)
  assert.equal(conv.list[0].unread, 0, '我发的消息不算我的未读')

  const thread = await main({ action: 'thread', withUserId: 'u2' })
  assert.equal(thread.list.length, 2)
  assert.equal(thread.list[0].content, '第一条', '聊天流按时间正序')
  assert.equal(thread.list[0].isMine, true)

  // 对方视角：收到未读 + 已读标记只清自己的
  actAs('openid-2')
  const { main: msg2 } = loadUnit('api-social', 'message')
  const conv2 = await msg2({ action: 'conversations' })
  assert.equal(conv2.list[0].unread, 2, '接收方应看到 2 条未读')
  assert.equal(conv2.list[0].lastMessage.isMine, false)
  const unread = await msg2({ action: 'unreadCount' })
  assert.equal(unread.unreadCount, 2)

  const read = await msg2({ action: 'read', withUserId: 'u1' })
  assert.equal(read.success, true)
  const unread2 = await msg2({ action: 'unreadCount' })
  assert.equal(unread2.unreadCount, 0, '标记已读后未读清零')

  // 发送方视角未读不受影响（没有发给我的消息）
  actAs(USER_OPENID)
  const { main: msg3 } = loadUnit('api-social', 'message')
  const unread3 = await msg3({ action: 'unreadCount' })
  assert.equal(unread3.unreadCount, 0)
})

test('message：拉黑双向拦截——我拉黑的拒发（BLOCKED_BY_ME），被拉黑的拒收（MESSAGE_BLOCKED）', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2' })
  seedUser({ _id: 'u3', openid: 'openid-3' })
  const { main: block } = loadUnit('api-social', 'block')
  const { main: msg } = loadUnit('api-social', 'message')

  // 我拉黑了 u2 → 我发不出去
  await block({ action: 'block', targetUserId: 'u2' })
  const mine = await msg({ action: 'send', toUserId: 'u2', content: 'hi' })
  assert.equal(mine.success, false)
  assert.equal(mine.code, 'BLOCKED_BY_ME', '我拉黑的人，错误码要让前端能引导去解除')
  assert.equal(mem.coll('messages').size, 0, '被拦截的消息不得落库')

  // u3 拉黑了我 → 我发不出去，且不泄露"你被拉黑了"的可判定状态
  await block({ action: 'unblock', targetUserId: 'u2' })
  actAs('openid-3')
  const { main: block3 } = loadUnit('api-social', 'block')
  await block3({ action: 'block', targetUserId: 'u1' })
  actAs(USER_OPENID)
  const { main: msg2 } = loadUnit('api-social', 'message')
  const theirs = await msg2({ action: 'send', toUserId: 'u3', content: 'hi' })
  assert.equal(theirs.success, false)
  assert.equal(theirs.code, 'MESSAGE_BLOCKED')
  assert.equal(mem.coll('messages').size, 0, '被拦截的消息不得落库')
})

test('message：未知动作拒绝', async () => {
  const { main } = loadUnit('api-social', 'message')
  const r = await main({ action: 'no-such' })
  assert.equal(r.success, false)
  assert.equal(r.code, 'INVALID_PARAM')
})

/* ------------------------------ checkin / points ------------------------------ */

test('checkin：签到成功、积分回读真实余额、重复签到拒绝', async () => {
  mem.setUnique('checkins', ['userId', 'date'])
  mem.coll('users').get('u1').creditScore = 0

  const { main } = loadUnit('api-social', 'checkin')
  const r1 = await main({})
  assert.equal(r1.success, true)
  assert.equal(r1.points, 1)
  assert.equal(r1.totalPoints, 1, '余额 0 + 1 分必须是 1，不能因 || 100 变成 101')
  assert.equal(mem.coll('users').get('u1').creditScore, 1)

  const r2 = await main({})
  assert.equal(r2.success, false)
  assert.equal(r2.code, 'ALREADY')
})

test('points：兑换扣分并发放改名卡', async () => {
  mem.coll('users').get('u1').creditScore = 150
  const { main } = loadUnit('api-social', 'points')

  const products = await main({ action: 'products' })
  assert.equal(products.creditScore, 150)
  assert.equal(products.renameTokens, 0, '投影必须包含 renameTokens，否则恒为 0')

  const r = await main({ action: 'redeem', productId: 'rename-token' })
  assert.equal(r.success, true)
  assert.equal(r.creditScore, 50)
  assert.equal(mem.coll('users').get('u1').renameTokens, 1, '改名卡必须真的入库')
})

test('points：积分不足拒绝且不扣分', async () => {
  mem.coll('users').get('u1').creditScore = 10
  const { main } = loadUnit('api-social', 'points')
  const r = await main({ action: 'redeem', productId: 'rename-token' })
  assert.equal(r.success, false)
  assert.equal(r.code, 'INSUFFICIENT_POINTS')
  assert.equal(mem.coll('users').get('u1').creditScore, 10)
})

/* ------------------------------ product ------------------------------ */

function seedProduct(over = {}) {
  const doc = {
    _id: 'pr1',
    userId: 'u1',
    userNickname: '测试同学',
    status: 'on_sale',
    title: '旧物',
    description: '描述',
    images: ['cloud://env/a.jpg'],
    price: 10,
    category: 'digital',
    condition: 'good',
    tradeType: 'face',
    likeCount: 0,
    collectCount: 0,
    createdAt: new Date(),
    ...over
  }
  mem.coll('products').set(doc._id, doc)
  return doc
}

test('product-create：落库成功，用户 productCount +1', async () => {
  const { main } = loadUnit('api-product', 'product-create')
  const res = await main({
    title: 'iPad',
    description: '九成新',
    images: ['cloud://env/1.jpg'],
    price: 100,
    category: 'digital',
    condition: 'good',
    tradeType: 'face'
  })
  assert.equal(res.success, true)
  assert.ok(res.productId)
  const doc = mem.coll('products').get(res.productId)
  assert.equal(doc.title, 'iPad')
  assert.equal(doc.status, 'on_sale')
  assert.equal(mem.coll('users').get('u1').productCount, 1)
})

test('product-create：无图拒绝 / 非法分类拒绝', async () => {
  const { main } = loadUnit('api-product', 'product-create')
  const noImg = await main({ title: 'T', description: 'D', price: 1 })
  assert.equal(noImg.success, false, '商品必须有图')
  const badCat = await main({
    title: 'T',
    description: 'D',
    images: ['cloud://x/1.jpg'],
    price: 1,
    category: 'not-a-category'
  })
  assert.equal(badCat.success, false)
})

test('product-list：只返回 on_sale，支持分类筛选', async () => {
  seedProduct({ _id: 'a', category: 'digital' })
  seedProduct({ _id: 'b', category: 'books' })
  seedProduct({ _id: 'c', category: 'digital', status: 'sold' })
  const { main } = loadUnit('api-product', 'product-list')
  const all = await main({})
  assert.equal(all.list.length, 2, 'sold 不应出现在市集')
  const d = await main({ category: 'digital' })
  assert.equal(d.list.length, 1)
  assert.equal(d.list[0]._id, 'a')
})

test('product-update：markSold 状态机 —— off_shelf 不可直接上架', async () => {
  seedProduct({ _id: 'p1', status: 'off_shelf' })
  const { main } = loadUnit('api-product', 'product-update')
  const res = await main({ productId: 'p1', markSold: false })
  assert.equal(res.success, false)
  assert.equal(res.code, 'INVALID_STATUS')
  assert.equal(mem.coll('products').get('p1').status, 'off_shelf', '不得被拉回在售')
})

test('product-update：markSold 正常二态切换', async () => {
  seedProduct({ _id: 'p1', status: 'on_sale' })
  const { main } = loadUnit('api-product', 'product-update')
  const sold = await main({ productId: 'p1', markSold: true })
  assert.equal(sold.status, 'sold')
  const back = await main({ productId: 'p1', markSold: false })
  assert.equal(back.status, 'on_sale')
})

test('product-update：非作者不能改', async () => {
  seedProduct({ _id: 'p1', userId: 'other' })
  const { main } = loadUnit('api-product', 'product-update')
  const res = await main({ productId: 'p1', title: '篡改' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
})

/* ------------------------------ admin ------------------------------ */

test('admin：非管理员拒绝高危操作', async () => {
  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'ban', targetUserId: 'u1' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
})

test('admin：管理员可封禁', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2', nickname: '待封' })
  actAs(ADMIN_OPENID)
  const admin = loadUnit('api-admin', 'admin')
  const r = await admin.main({ action: 'ban', targetUserId: 'u2' })
  assert.equal(r.success, true)
  assert.equal(mem.coll('users').get('u2').verifyStatus, 'banned')
})

test('admin：删除被举报内容时同步 resolve 举报', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal', images: [] })
  mem.coll('reports').set('r1', {
    _id: 'r1',
    targetType: 'post',
    targetId: 'p1',
    reporterId: 'u1',
    status: 'pending',
    reason: '广告'
  })
  actAs(ADMIN_OPENID)
  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'delete', targetType: 'post', targetId: 'p1' })
  assert.equal(res.success, true)
  assert.equal(mem.coll('reports').get('r1').status, 'resolved', '举报应被置为已处理')
})

test('announcement：非管理员不能创建公告', async () => {
  const { main } = loadUnit('api-admin', 'announcement')
  const res = await main({ action: 'create', title: 'T', content: 'C' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
})

test('announcement：管理员创建 + list 只返回 active', async () => {
  actAs(ADMIN_OPENID)
  const admin = loadUnit('api-admin', 'announcement')
  const c = await admin.main({ action: 'create', title: '公告1', content: '内容', isPinned: true })
  assert.equal(c.success, true)
  const list = await admin.main({ action: 'list' })
  assert.equal(list.list.length, 1)
  assert.equal(list.list[0].title, '公告1')
})

test('category-manage：非管理员拒绝', async () => {
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'create', name: 'X' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
})

/* ------------------------------ notification ------------------------------ */

test('notification：只能标记自己的通知（IDOR 防护）', async () => {
  mem.coll('notifications').set('n1', { _id: 'n1', userId: 'other', isRead: false })
  mem.coll('notifications').set('n2', { _id: 'n2', userId: 'u1', isRead: false })

  const { main } = loadUnit('api-social', 'notification')
  const r1 = await main({ action: 'markRead', notificationId: 'n1' })
  assert.equal(r1.marked, false, '不能标记他人通知')
  assert.equal(mem.coll('notifications').get('n1').isRead, false)

  const r2 = await main({ action: 'markRead', notificationId: 'n2' })
  assert.equal(r2.marked, true)
  assert.equal(mem.coll('notifications').get('n2').isRead, true)
})

test('notification：list 返回未读数与分页', async () => {
  for (let i = 0; i < 3; i++) {
    mem.coll('notifications').set(`n${i}`, {
      _id: `n${i}`,
      userId: 'u1',
      isRead: i === 2,
      createdAt: new Date(Date.now() - i * 1000),
      content: `通知${i}`
    })
  }
  const { main } = loadUnit('api-social', 'notification')
  const res = await main({ action: 'list', page: 1, pageSize: 2 })
  assert.equal(res.list.length, 2)
  assert.equal(res.hasMore, true)
  assert.equal(res.unreadCount, 2)
})

test('notification：markAllRead 只影响自己的', async () => {
  mem.coll('notifications').set('n1', { _id: 'n1', userId: 'u1', isRead: false })
  mem.coll('notifications').set('n2', { _id: 'n2', userId: 'other', isRead: false })
  const { main } = loadUnit('api-social', 'notification')
  const res = await main({ action: 'markAllRead' })
  assert.equal(res.updated, 1)
  assert.equal(mem.coll('notifications').get('n2').isRead, false, '他人通知不受影响')
})

/* ------------------------------ guide / search ------------------------------ */

test('guide-list：只返回 published，附带分类', async () => {
  mem.coll('guide_categories').set('gc1', { _id: 'gc1', name: '新生', sort: 1 })
  mem.coll('guides').set('g1', {
    _id: 'g1',
    title: '指南1',
    status: 'published',
    categoryId: 'gc1',
    sort: 1
  })
  mem.coll('guides').set('g2', {
    _id: 'g2',
    title: '未发布',
    status: 'draft',
    categoryId: 'gc1',
    sort: 2
  })
  const { main } = loadUnit('api-content', 'guide-list')
  const res = await main({})
  assert.equal(res.success, true)
  assert.equal(res.guides.length, 1, 'draft 不出现')
  assert.equal(res.categories.length, 1)
})

test('guide-detail：未发布返回 NOT_FOUND，已发布返回正文', async () => {
  mem.coll('guides').set('g1', { _id: 'g1', title: 'A', status: 'published', content: '<p>x</p>' })
  mem.coll('guides').set('g2', { _id: 'g2', title: 'B', status: 'draft', content: '' })
  const { main } = loadUnit('api-content', 'guide-detail')
  const ok1 = await main({ guideId: 'g1' })
  assert.equal(ok1.success, true)
  assert.equal(ok1.guide.content, '<p>x</p>')
  const bad = await main({ guideId: 'g2' })
  assert.equal(bad.success, false)
})

test('search：关键词命中，正则元字符被转义', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    title: '高数复习',
    content: '微积分',
    status: 'normal',
    createdAt: new Date()
  })
  mem.coll('posts').set('p2', {
    _id: 'p2',
    title: '无关',
    content: '无关',
    status: 'normal',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-content', 'search')
  const hit = await main({ keyword: '高数' })
  assert.equal(hit.posts.length, 1)
  assert.equal(hit.posts[0]._id, 'p1')

  const weird = await main({ keyword: '.*' })
  assert.equal(weird.posts.length, 0, '.* 应按字面量处理，不能匹配全部')
})

test('search：空关键词返回空结果，hot 聚合不报错', async () => {
  const { main } = loadUnit('api-content', 'search')
  const empty = await main({ keyword: '  ' })
  assert.equal(empty.posts.length, 0)
  const hot = await main({ action: 'hot' })
  assert.equal(hot.success, true)
  assert.ok(Array.isArray(hot.hot))
})

/* ------------------------------ user / verify / feedback / report ------------------------------ */

test('login：返回 user 且不含 openid，首登自动建号', async () => {
  mem.coll('users').clear()
  const { main } = loadUnit('api-auth', 'login')
  const res = await main({})
  assert.equal(res.success, true)
  assert.ok(res.user._id)
  assert.equal(res.user.openid, undefined, 'openid 是服务端可信字段，不得下发')
  assert.ok(['admin', 'user'].includes(res.user.role), 'role 必须由 checkAdmin 现算')
})

test('user-profile：他人资料脱敏，不返回积分/签到统计', async () => {
  seedUser({ _id: 'u2', openid: 'openid-2', nickname: '别人', creditScore: 999 })
  const { main } = loadUnit('api-auth', 'user-profile')
  const res = await main({ userId: 'u2' })
  assert.equal(res.success, true)
  assert.equal(res.profile.nickname, '别人')
  assert.equal(res.profile.creditScore, undefined, '他人资料不得暴露积分')
  assert.equal(res.profile.checkinStreak, undefined)
})

test('user-profile：本人可见完整资料', async () => {
  const { main } = loadUnit('api-auth', 'user-profile')
  const res = await main({ userId: 'u1' })
  assert.equal(res.success, true)
  assert.equal(res.profile.creditScore, 100)
})

test('verify：学号格式非法拒绝', async () => {
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({
    action: 'submit',
    school: 'X',
    studentId: 'a',
    imageFileID: 'cloud://x/1.jpg'
  })
  assert.equal(res.success, false)
})

test('feedback-create：落库并按类型白名单归档', async () => {
  const { main } = loadUnit('api-admin', 'feedback-create')
  const res = await main({ content: '有个 bug', type: 'bug', contact: 'wx123' })
  assert.equal(res.success, true)
  assert.equal(mem.coll('feedbacks').size, 1)
  const doc = [...mem.coll('feedbacks').values()][0]
  assert.equal(doc.type, 'bug')
  assert.equal(doc.status, 'pending')
})

test('feedback-create：空内容拒绝', async () => {
  const { main } = loadUnit('api-admin', 'feedback-create')
  const res = await main({ content: '   ' })
  assert.equal(res.success, false)
})

test('report：举报落库，重复举报同一内容被拒', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'other', status: 'normal' })
  const { main } = loadUnit('api-admin', 'report')
  const r1 = await main({ targetId: 'p1', targetType: 'post', reason: '广告/营销' })
  assert.equal(r1.success, true)
  assert.equal(mem.coll('reports').size, 1)
  const r2 = await main({ targetId: 'p1', targetType: 'post', reason: '广告/营销' })
  assert.equal(r2.success, false)
  assert.equal(r2.code, 'ALREADY')
})

/* ------------------------------ my-list / resolve ------------------------------ */

test('my-list：stats 返回三类真实计数', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'u1', status: 'normal' })
  mem.coll('posts').set('p2', { _id: 'p2', userId: 'u1', status: 'deleted' })
  mem.coll('products').set('pr1', { _id: 'pr1', userId: 'u1', status: 'on_sale' })
  mem.coll('collects').set('c1', { _id: 'c1', userId: 'u1', targetId: 'x', type: 'post' })

  const { main } = loadUnit('api-post', 'my-list')
  const res = await main({ stats: true })
  assert.deepEqual(res.counts, { posts: 1, products: 1, collects: 1 })
})

test('my-list：type=posts 只返回本人未删除内容', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'u1',
    status: 'normal',
    createdAt: new Date()
  })
  mem.coll('posts').set('p2', {
    _id: 'p2',
    userId: 'other',
    status: 'normal',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-post', 'my-list')
  const res = await main({ type: 'posts' })
  assert.equal(res.list.length, 1)
  assert.equal(res.list[0]._id, 'p1')
})

test('resolve：作者可标记已解决，非作者拒绝', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'u1',
    kind: 'task',
    status: 'normal',
    resolved: false
  })
  const { main } = loadUnit('api-post', 'resolve')
  const r = await main({ postId: 'p1' })
  assert.equal(r.success, true)
  assert.equal(mem.coll('posts').get('p1').resolved, true)

  mem.coll('posts').set('p2', { _id: 'p2', userId: 'other', kind: 'task', status: 'normal' })
  const bad = await main({ postId: 'p2' })
  assert.equal(bad.success, false)
})

test('user-update：更新昵称并返回 role，不泄露 openid', async () => {
  const { main } = loadUnit('api-auth', 'user-update')
  const res = await main({ nickname: '新昵称', bio: '简介' })
  assert.equal(res.success, true)
  assert.equal(res.user.nickname, '新昵称')
  assert.equal(res.user.openid, undefined, '不得下发 openid')
  assert.ok(['admin', 'user'].includes(res.user.role))
})

// 测试结束后清掉运行时生成的 shim，避免污染构建门禁的「源码目录不得有多余文件」检查
after(() => mem.removeSourceShims())
