// handlers-governance.test.js — v0.12.0 内容治理四个新入口的真实行为测试
//
// 覆盖：分级敏感词库（word-manage + post-create 接线）、编辑历史（post-update 快照 +
// revision-list 权限）、回收站（content-restore 恢复与计数回补）、运营看板（admin-stats）。
// 与既有测试同一套内存数据库桩，真实执行 handler 源码。
const { test, beforeEach, after, afterEach } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const mem = require('./lib/memory-db')

const CF = path.resolve(__dirname, '..', 'cloudfunctions')
const USER_OPENID = 'openid-user-gov'
const ADMIN_OPENID = 'openid-admin-gov'

let env

function loadUnit(unit, fn) {
  mem.ensureSourceShims()
  mem.purge(path.join('cloudfunctions', unit, 'handlers'))
  mem.purge(path.join('cloudfunctions', 'common'))
  const mod = require(path.join(CF, unit, 'handlers', fn + '.js'))
  const handler = typeof mod === 'function' ? mod : mod.main
  return { main: (event) => handler(event) }
}

function actAs(openid) {
  if (env) env.restore()
  env = mem.install({
    wxContext: { OPENID: openid },
    openapi: { security: { msgSecCheck: async () => ({}), imgSecCheck: async () => ({}) } }
  })
  mem.purge(path.join('cloudfunctions', 'common'))
}

function seedUser(over = {}) {
  mem.coll('users').set('u1', {
    _id: 'u1',
    openid: USER_OPENID,
    nickname: '治理测试用户',
    avatar: '',
    schoolId: 's1',
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
  })
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

function seedPost(over = {}) {
  const doc = {
    _id: 'p1',
    userId: 'u1',
    userNickname: '治理测试用户',
    title: '原标题',
    content: '原内容',
    images: [],
    tags: [],
    kind: 'post',
    status: 'normal',
    isAnonymous: false,
    categoryId: 'c-leaf',
    categoryPath: ['c-root', 'c-leaf'],
    schoolId: 's1',
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over
  }
  mem.coll('posts').set(doc._id, doc)
  return doc
}

beforeEach(() => {
  mem.reset()
  env = mem.install({
    wxContext: { OPENID: USER_OPENID },
    openapi: { security: { msgSecCheck: async () => ({}), imgSecCheck: async () => ({}) } }
  })
  process.env.ADMIN_OPENIDS = ADMIN_OPENID
  mem.coll('rate_limits').clear()
  seedUser()
  seedCategories()
})

afterEach(() => {
  env.restore()
  delete process.env.ADMIN_OPENIDS
})

after(() => mem.removeSourceShims())

/* ------------------------------ 分级敏感词库 ------------------------------ */

test('word-manage：非管理员一律拒绝', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-admin', 'word-manage')
  const res = await main({ action: 'list' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'FORBIDDEN')
})

test('word-manage：新增词条落到 sensitive_words，重复词返回 ALREADY', async () => {
  actAs(ADMIN_OPENID)
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified'
  })
  const { main } = loadUnit('api-admin', 'word-manage')
  const r1 = await main({ action: 'create', word: '代写代考', wordAction: 'block' })
  assert.equal(r1.success, true, JSON.stringify(r1))
  assert.ok(r1.wordId)
  const doc = mem.coll('sensitive_words').get(r1.wordId)
  assert.equal(doc.word, '代写代考')
  assert.equal(doc.action, 'block')
  assert.equal(doc.status, 'active')

  const r2 = await main({ action: 'create', word: '代写代考', wordAction: 'block' })
  assert.equal(r2.success, false)
  assert.equal(r2.code, 'ALREADY')
})

test('post-create：命中 block 词直接拒发，不落库', async () => {
  actAs(ADMIN_OPENID)
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified'
  })
  const wm = loadUnit('api-admin', 'word-manage')
  await wm.main({ action: 'create', word: '代写代考', wordAction: 'block' })

  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'post-create')
  const res = await main({
    title: '代写代考服务',
    content: '价格优惠',
    categoryId: 'c-leaf',
    kind: 'post'
  })
  assert.equal(res.success, false)
  assert.equal(res.code, 'CONTENT_RISKY')
  assert.equal(mem.coll('posts').size, 0, '命中 block 词不得落库')
})

test('post-create：命中 replace 词写入替换后的文本', async () => {
  actAs(ADMIN_OPENID)
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified'
  })
  const wm = loadUnit('api-admin', 'word-manage')
  await wm.main({ action: 'create', word: '加微信', wordAction: 'replace', replacement: '****' })

  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'post-create')
  const res = await main({
    title: '出闲置',
    content: '想要的话加微信详聊',
    categoryId: 'c-leaf',
    kind: 'post'
  })
  assert.equal(res.success, true, JSON.stringify(res))
  const doc = mem.coll('posts').get(res.postId)
  assert.equal(doc.content, '想要的话****详聊')
})

/* ------------------------------ 编辑历史 ------------------------------ */

test('post-update：编辑前写入旧值快照，revision-list 仅作者/管理员可读', async () => {
  seedPost()
  actAs(USER_OPENID)
  const upd = loadUnit('api-post', 'post-update')
  const res = await upd.main({ postId: 'p1', title: '新标题' })
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(mem.coll('posts').get('p1').title, '新标题')

  const revs = [...mem.coll('post_revisions').values()]
  assert.equal(revs.length, 1, '应写入一条历史快照')
  assert.equal(revs[0].title, '原标题', '快照必须是编辑前的旧值')

  const rl = loadUnit('api-post', 'revision-list')
  const mine = await rl.main({ postId: 'p1' })
  assert.equal(mine.success, true, JSON.stringify(mine))
  assert.equal(mine.list.length, 1)

  // 他人不可读
  mem.coll('users').set('u2', {
    _id: 'u2',
    openid: 'openid-other-gov',
    nickname: '路人',
    verifyStatus: 'unverified'
  })
  actAs('openid-other-gov')
  const rl2 = loadUnit('api-post', 'revision-list')
  const other = await rl2.main({ postId: 'p1' })
  assert.equal(other.success, false)
  assert.equal(other.code, 'FORBIDDEN')
})

test('post-update：历史只保留最近 10 版', async () => {
  seedPost()
  actAs(USER_OPENID)
  const upd = loadUnit('api-post', 'post-update')
  for (let i = 0; i < 12; i++) {
    // 每次换一个窗口，绕过 60s/6 次编辑限频（限频本身有独立测试）
    mem.coll('rate_limits').clear()
    const r = await upd.main({ postId: 'p1', title: `标题${i}` })
    assert.equal(r.success, true, JSON.stringify(r))
  }
  const revs = [...mem.coll('post_revisions').values()].filter((r) => r.postId === 'p1')
  assert.ok(revs.length <= 10, `历史应裁剪到 10 条，实际 ${revs.length}`)
})

/* ------------------------------ 回收站 ------------------------------ */

test('content-restore：非管理员拒绝；管理员恢复软删帖子并回补 postCount', async () => {
  seedPost({ status: 'deleted' })
  mem.coll('users').get('u1').postCount = 0

  actAs(USER_OPENID)
  let cr = loadUnit('api-admin', 'content-restore')
  const denied = await cr.main({ action: 'restore', targetType: 'post', targetId: 'p1' })
  assert.equal(denied.success, false)
  assert.equal(denied.code, 'FORBIDDEN')

  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified'
  })
  actAs(ADMIN_OPENID)
  // 切身份后必须重新加载 handler：common-bundle 的身份上下文绑定在 require 闭包上
  cr = loadUnit('api-admin', 'content-restore')
  const ok1 = await cr.main({ action: 'restore', targetType: 'post', targetId: 'p1' })
  assert.equal(ok1.success, true, JSON.stringify(ok1))
  assert.equal(ok1.restored, true)
  assert.equal(mem.coll('posts').get('p1').status, 'normal')
  assert.equal(mem.coll('users').get('u1').postCount, 1, '恢复后应回补 postCount')

  // 重复恢复幂等：不再补计数
  const ok2 = await cr.main({ action: 'restore', targetType: 'post', targetId: 'p1' })
  assert.equal(ok2.already, true)
  assert.equal(mem.coll('users').get('u1').postCount, 1)
})

test('content-restore：list 只返回 deleted 内容', async () => {
  seedPost()
  mem.coll('posts').set('p2', {
    _id: 'p2',
    userId: 'u1',
    title: '已删帖',
    content: 'x',
    status: 'deleted',
    updatedAt: new Date()
  })
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified'
  })
  actAs(ADMIN_OPENID)
  const cr = loadUnit('api-admin', 'content-restore')
  const res = await cr.main({ action: 'list', type: 'post' })
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(res.list.length, 1)
  assert.equal(res.list[0]._id, 'p2')
})

/* ------------------------------ 运营看板 ------------------------------ */

test('admin-stats：非管理员拒绝；管理员拿到聚合计数', async () => {
  actAs(USER_OPENID)
  let st = loadUnit('api-admin', 'admin-stats')
  const denied = await st.main({ days: 7 })
  assert.equal(denied.success, false)
  assert.equal(denied.code, 'FORBIDDEN')

  seedPost()
  mem.coll('reports').set('r1', {
    _id: 'r1',
    targetId: 'p1',
    targetType: 'post',
    status: 'pending',
    createdAt: new Date()
  })
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified'
  })
  actAs(ADMIN_OPENID)
  st = loadUnit('api-admin', 'admin-stats')
  const res = await st.main({ days: 7 })
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(res.posts.normal, 1)
  assert.equal(res.queue.reports, 1)
  assert.ok(res.users.total >= 2)
})

/* ------------------------------ 举报目标校验 ------------------------------ */

test('report：目标不存在时拒绝（防止往不存在的内容塞举报）', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-admin', 'report')
  const res = await main({ targetId: 'no-such-post', targetType: 'post', reason: '广告' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'NOT_FOUND')
})

test('report：私信只能由会话参与方举报', async () => {
  mem.coll('messages').set('m1', {
    _id: 'm1',
    conversationId: 'u1__u9',
    fromUserId: 'u9',
    toUserId: 'u1',
    content: '骚扰内容',
    createdAt: new Date()
  })
  mem.coll('users').set('u2', {
    _id: 'u2',
    openid: 'openid-other-gov',
    nickname: '路人',
    verifyStatus: 'unverified'
  })
  actAs('openid-other-gov')
  let rp = loadUnit('api-admin', 'report')
  const denied = await rp.main({ targetId: 'm1', targetType: 'message', reason: '骚扰' })
  assert.equal(denied.success, false)
  assert.equal(denied.code, 'FORBIDDEN')

  actAs(USER_OPENID)
  rp = loadUnit('api-admin', 'report')
  const okRes = await rp.main({ targetId: 'm1', targetType: 'message', reason: '骚扰' })
  assert.equal(okRes.success, true, JSON.stringify(okRes))
})

/* --------------------- 跨端身份：H5/APK 无 OPENID 的场景 --------------------- */

test('post-detail / product-detail / comment-list：H5 设备令牌下点赞态正确回填', async () => {
  // 模拟 REST：wxContext 没有 OPENID，只带 __identity 设备令牌
  mem.reset()
  process.env.IDENTITY_SECRET = 'test-secret-at-least-16-chars-long'
  if (env) env.restore()
  env = mem.install({
    wxContext: {},
    openapi: { security: { msgSecCheck: async () => ({}), imgSecCheck: async () => ({}) } }
  })
  mem.purge(path.join('cloudfunctions', 'common'))
  process.env.ADMIN_OPENIDS = ADMIN_OPENID

  const identity = require(path.join(CF, 'common', 'common-identity.js'))
  const token = identity.issueToken('devuid123')
  const openid = 'dev_devuid123'

  mem.coll('users').set('u-dev', {
    _id: 'u-dev',
    openid,
    nickname: 'H5 用户',
    verifyStatus: 'unverified',
    campusVerified: false,
    campusVerifyStatus: 'none',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    collectCount: 0,
    followerCount: 0,
    followingCount: 0,
    renameTokens: 0
  })
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'u-dev',
    userNickname: 'H5 用户',
    title: 'T',
    content: 'C',
    images: [],
    kind: 'post',
    status: 'normal',
    isAnonymous: false,
    likeCount: 1,
    commentCount: 0,
    collectCount: 1,
    viewCount: 0,
    createdAt: new Date()
  })
  mem.coll('products').set('pr1', {
    _id: 'pr1',
    userId: 'u-dev',
    userNickname: 'H5 用户',
    title: 'P',
    images: ['cloud://x/1.jpg'],
    price: 1,
    status: 'on_sale',
    likeCount: 1,
    collectCount: 1,
    viewCount: 0,
    createdAt: new Date()
  })
  mem.coll('likes').set('l1', {
    _id: 'l1',
    userId: 'u-dev',
    targetId: 'p1',
    type: 'post',
    createdAt: new Date()
  })
  mem.coll('collects').set('c1', {
    _id: 'c1',
    userId: 'u-dev',
    targetId: 'p1',
    type: 'post',
    createdAt: new Date()
  })
  mem.coll('likes').set('l2', {
    _id: 'l2',
    userId: 'u-dev',
    targetId: 'cmt1',
    type: 'comment',
    createdAt: new Date()
  })
  mem.coll('comments').set('cmt1', {
    _id: 'cmt1',
    targetId: 'p1',
    targetType: 'post',
    userId: 'u-dev',
    userNickname: 'H5 用户',
    content: '评论',
    parentId: null,
    likeCount: 1,
    status: 'normal',
    createdAt: new Date()
  })

  const detail = loadUnit('api-post', 'post-detail')
  const res = await detail.main({ postId: 'p1', __identity: token })
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(res.isLiked, true, 'H5 设备令牌下点赞态必须回填（旧实现读 OPENID 恒 false）')
  assert.equal(res.isCollected, true, 'H5 设备令牌下收藏态必须回填')
  assert.ok(res.post.viewCount >= 1, '浏览量必须能计数（旧实现无 OPENID 直接跳过）')

  const comments = loadUnit('api-comment', 'comment-list')
  const cl = await comments.main({ targetId: 'p1', __identity: token })
  assert.equal(cl.success, true, JSON.stringify(cl))
  assert.equal(cl.list[0].liked, true, 'H5 设备令牌下评论点赞态必须回填')

  const prod = loadUnit('api-product', 'product-detail')
  const pr = await prod.main({ productId: 'pr1', __identity: token })
  assert.equal(pr.success, true, JSON.stringify(pr))
  assert.equal(pr.isLiked, false, '该商品未点赞，应为 false 而不是因身份丢失而为 false')
  assert.equal(pr.isCollected, false)

  delete process.env.IDENTITY_SECRET
})

test('post-related：排除当前帖，最多 5 条，同分类优先', async () => {
  mem.reset()
  seedCategories()
  seedUser()
  seedPost({ _id: 'cur', categoryId: 'c-leaf', categoryPath: ['c-root', 'c-leaf'] })
  for (let i = 0; i < 7; i++) {
    mem.coll('posts').set(`same${i}`, {
      _id: `same${i}`,
      userId: 'u1',
      title: `同分类${i}`,
      content: 'x',
      images: [],
      kind: 'post',
      status: 'normal',
      categoryId: 'c-leaf',
      likeCount: i,
      commentCount: 0,
      createdAt: new Date()
    })
  }
  mem.coll('posts').set('other', {
    _id: 'other',
    userId: 'u1',
    title: '别的分类',
    content: 'x',
    images: [],
    kind: 'post',
    status: 'normal',
    categoryId: 'c-other',
    likeCount: 999,
    commentCount: 0,
    createdAt: new Date()
  })
  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'post-related')
  const res = await main({ postId: 'cur' })
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(res.list.length, 5)
  assert.ok(!res.list.some((p) => p._id === 'cur'), '不得推荐当前帖')
  assert.ok(res.list.every((p) => p.categoryId === undefined || p.categoryId === 'c-leaf'))
})
