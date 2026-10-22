// handlers-admin.test.js — 管理台 / 认证 / 我的内容 的补充行为测试
//
// 目的：把 admin.js（35%）、category-manage（18%）、verify（43%）、my-list（54%）
// 这几个覆盖率洼地补上来。它们恰好也是权限最敏感的区域，负向用例比正向更重要。
const { test, beforeEach, after, afterEach } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const mem = require('./lib/memory-db')

const CF = path.resolve(__dirname, '..', 'cloudfunctions')
const ADMIN_OPENID = 'openid-admin-2'
const USER_OPENID = 'openid-user-2'

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

function seedUsers() {
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    followerCount: 0,
    followingCount: 0,
    collectCount: 0,
    renameTokens: 0
  })
  mem.coll('users').set('u1', {
    _id: 'u1',
    openid: USER_OPENID,
    nickname: '普通用户',
    verifyStatus: 'unverified',
    campusVerified: false,
    campusVerifyStatus: 'none',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    followerCount: 0,
    followingCount: 0,
    collectCount: 0,
    renameTokens: 0
  })
}

beforeEach(() => {
  mem.reset()
  env = mem.install({ wxContext: {}, openapi: {} })
  process.env.ADMIN_OPENIDS = ADMIN_OPENID
  seedUsers()
  actAs(ADMIN_OPENID)
  mem.coll('rate_limits').clear()
})

afterEach(() => {
  env.restore()
  delete process.env.ADMIN_OPENIDS
})

/* ---------------------------- admin: 用户管理 ---------------------------- */

test('admin list-users：分页 + 关键词搜索', async () => {
  const { main } = loadUnit('api-admin', 'admin')
  const all = await main({ action: 'list-users', page: 1, pageSize: 10 })
  assert.equal(all.success, true)
  assert.equal(all.total, 2)

  const kw = await main({ action: 'list-users', keyword: '管理员' })
  assert.equal(kw.list.length, 1)
  assert.equal(kw.list[0].nickname, '管理员')
})

test('admin ban / unban：状态正确切换', async () => {
  const { main } = loadUnit('api-admin', 'admin')
  const ban = await main({ action: 'ban', targetUserId: 'u1' })
  assert.equal(ban.success, true)
  assert.equal(mem.coll('users').get('u1').verifyStatus, 'banned')

  const unban = await main({ action: 'unban', targetUserId: 'u1' })
  assert.equal(unban.success, true)
  assert.equal(mem.coll('users').get('u1').verifyStatus, 'unverified')
})

test('admin ban：目标不存在报 NOT_FOUND', async () => {
  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'ban', targetUserId: 'nobody' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'NOT_FOUND')
})

test('admin pin / unpin：置顶状态落库', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', title: 'A', status: 'normal', isPinned: false })
  const { main } = loadUnit('api-admin', 'admin')

  const pin = await main({ action: 'pin', postId: 'p1' })
  assert.equal(pin.isPinned, true)
  assert.equal(mem.coll('posts').get('p1').isPinned, true)

  const unpin = await main({ action: 'unpin', postId: 'p1' })
  assert.equal(unpin.isPinned, false)
  assert.equal(mem.coll('posts').get('p1').isPinned, false)
})

test('admin essence / unessence：加精状态落库', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', title: 'A', status: 'normal', isEssence: false })
  const { main } = loadUnit('api-admin', 'admin')

  const e = await main({ action: 'essence', postId: 'p1' })
  assert.equal(e.isEssence, true)
  assert.equal(mem.coll('posts').get('p1').isEssence, true)

  const u = await main({ action: 'unessence', postId: 'p1' })
  assert.equal(u.isEssence, false)
})

test('admin list-reports：返回 reportId + target 摘要', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'u1',
    userNickname: '普通用户',
    title: '被举报的帖子',
    status: 'normal'
  })
  mem.coll('reports').set('r1', {
    _id: 'r1',
    targetType: 'post',
    targetId: 'p1',
    reason: '广告/营销',
    description: '刷屏',
    status: 'pending',
    createdAt: new Date()
  })

  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'list-reports' })
  assert.equal(res.success, true)
  assert.equal(res.list.length, 1)
  const row = res.list[0]
  assert.equal(row.reportId, 'r1', '主键必须是 reportId')
  assert.equal(row.target.snippet, '被举报的帖子')
  assert.equal(row.target.ownerNickname, '普通用户')
})

test('admin resolve：忽略举报后 status 变 resolved', async () => {
  mem.coll('reports').set('r1', {
    _id: 'r1',
    targetType: 'post',
    targetId: 'p1',
    status: 'pending'
  })
  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'resolve', reportId: 'r1' })
  assert.equal(res.success, true)
  assert.equal(mem.coll('reports').get('r1').status, 'resolved')
})

test('admin list-logs：审计日志按时间倒序', async () => {
  mem.coll('admin_logs').set('l1', {
    _id: 'l1',
    action: 'ban',
    operatorOpenid: ADMIN_OPENID,
    createdAt: new Date(1)
  })
  mem.coll('admin_logs').set('l2', {
    _id: 'l2',
    action: 'pin',
    operatorOpenid: ADMIN_OPENID,
    createdAt: new Date(2)
  })
  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'list-logs' })
  assert.equal(res.success, true)
  assert.equal(res.list[0]._id, 'l2', '最新的在前')
})

test('admin list-verifies：按状态筛选认证申请', async () => {
  mem.coll('verify_requests').set('v1', {
    _id: 'v1',
    userId: 'u1',
    status: 'pending',
    school: 'X',
    studentId: '2023',
    createdAt: new Date()
  })
  mem.coll('verify_requests').set('v2', {
    _id: 'v2',
    userId: 'u1',
    status: 'approved',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-admin', 'admin')
  const pending = await main({ action: 'list-verifies', status: 'pending' })
  assert.equal(pending.list.length, 1)
  assert.equal(pending.list[0]._id, 'v1')
})

test('admin verify-review：通过后用户 campusVerified=true', async () => {
  mem.coll('verify_requests').set('v1', {
    _id: 'v1',
    userId: 'u1',
    status: 'pending',
    school: 'X',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'verify-review', requestId: 'v1', approve: true })
  assert.equal(res.success, true)
  assert.equal(mem.coll('users').get('u1').campusVerified, true)
  assert.equal(mem.coll('verify_requests').get('v1').status, 'approved')
})

test('admin verify-review：重复审批幂等（不重复生效）', async () => {
  mem.coll('verify_requests').set('v1', {
    _id: 'v1',
    userId: 'u1',
    status: 'pending',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-admin', 'admin')
  await main({ action: 'verify-review', requestId: 'v1', approve: true })
  const second = await main({ action: 'verify-review', requestId: 'v1', approve: true })
  assert.equal(second.already, true, '第二次应返回 already')
})

test('admin list-feedbacks / resolve-feedback', async () => {
  mem.coll('feedbacks').set('f1', {
    _id: 'f1',
    content: 'bug',
    status: 'pending',
    createdAt: new Date()
  })
  const { main } = loadUnit('api-admin', 'admin')
  const list = await main({ action: 'list-feedbacks' })
  assert.equal(list.list.length, 1)

  const resolved = await main({ action: 'resolve-feedback', feedbackId: 'f1' })
  assert.equal(resolved.success, true)
  assert.equal(mem.coll('feedbacks').get('f1').status, 'resolved')
})

/* ---------------------------- category-manage ---------------------------- */

test('category-manage：创建根分类与子分类', async () => {
  const { main } = loadUnit('api-admin', 'category-manage')
  const root = await main({ action: 'create', name: '根', parentId: '' })
  assert.equal(root.success, true)
  const child = await main({ action: 'create', name: '子', parentId: root.categoryId })
  assert.equal(child.success, true)
  assert.equal(mem.coll('categories').get(child.categoryId).level, 2)
})

test('category-manage：名字为空拒绝', async () => {
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'create', name: '   ', parentId: '' })
  assert.equal(res.success, false)
})

test('category-manage：改名 + 排序落库', async () => {
  mem.coll('categories').set('c1', {
    _id: 'c1',
    name: '旧名',
    parentId: '',
    level: 1,
    order: 1,
    status: 'active'
  })
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'update', id: 'c1', name: '新名', order: 5 })
  assert.equal(res.success, true)
  const doc = mem.coll('categories').get('c1')
  assert.equal(doc.name, '新名')
  assert.equal(doc.order, 5)
})

test('category-manage：改父级必须落库 parentId（回归）', async () => {
  mem.coll('categories').set('a', { _id: 'a', name: 'A', parentId: '', level: 1, status: 'active' })
  mem.coll('categories').set('b', {
    _id: 'b',
    name: 'B',
    parentId: 'a',
    level: 2,
    status: 'active'
  })
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'update', id: 'b', parentId: '' })
  assert.equal(res.success, true, JSON.stringify(res))
  const doc = mem.coll('categories').get('b')
  assert.equal(doc.parentId, '', '移到根分类后 parentId 必须为空')
  assert.equal(doc.level, 1)
})

test('category-manage：不能把分类移到自己的子级下（防环）', async () => {
  mem.coll('categories').set('a', { _id: 'a', name: 'A', parentId: '', level: 1, status: 'active' })
  mem.coll('categories').set('b', {
    _id: 'b',
    name: 'B',
    parentId: 'a',
    level: 2,
    status: 'active'
  })
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'update', id: 'a', parentId: 'b' })
  assert.equal(res.success, false)
})

test('category-manage：有子分类时不能删除', async () => {
  mem.coll('categories').set('a', { _id: 'a', name: 'A', parentId: '', level: 1, status: 'active' })
  mem.coll('categories').set('b', {
    _id: 'b',
    name: 'B',
    parentId: 'a',
    level: 2,
    status: 'active'
  })
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'delete', id: 'a' })
  assert.equal(res.success, false, '有子节点时不应允许删除')
})

test('category-manage：删除叶子分类成功', async () => {
  mem.coll('categories').set('leaf', {
    _id: 'leaf',
    name: '叶',
    parentId: '',
    level: 1,
    status: 'active'
  })
  const { main } = loadUnit('api-admin', 'category-manage')
  const res = await main({ action: 'delete', id: 'leaf' })
  assert.equal(res.success, true)
})

/* ---------------------------- verify 全流程 ---------------------------- */

test('verify：已认证用户不能重复提交', async () => {
  mem.coll('users').get('u1').campusVerified = true
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({
    action: 'submit',
    school: 'X',
    studentId: '20230001',
    imageFileID: 'cloud://x/1.jpg'
  })
  assert.equal(res.success, false)
  assert.equal(res.code, 'ALREADY')
})

test('verify：已有 pending 申请时不能再提交', async () => {
  mem.coll('users').get('u1').campusVerifyStatus = 'pending'
  mem.coll('verify_requests').set('v1', {
    _id: 'v1',
    userId: 'u1',
    status: 'pending',
    createdAt: new Date()
  })
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({
    action: 'submit',
    school: 'X',
    studentId: '20230001',
    imageFileID: 'cloud://x/1.jpg'
  })
  assert.equal(res.success, false)
  assert.equal(res.code, 'ALREADY')
})

test('verify：缺证件照拒绝', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({ action: 'submit', school: 'X', studentId: '20230001' })
  assert.equal(res.success, false)
})

/* ---------------------------- my-list 三种类型 ---------------------------- */

test('my-list：type=collects 返回收藏的帖子与商品，按收藏时间排序', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'other',
    title: '帖子',
    status: 'normal',
    createdAt: new Date()
  })
  mem.coll('products').set('pr1', {
    _id: 'pr1',
    userId: 'other',
    title: '商品',
    price: 10,
    status: 'on_sale',
    createdAt: new Date()
  })
  mem.coll('collects').set('c1', {
    _id: 'c1',
    userId: 'u1',
    targetId: 'p1',
    type: 'post',
    createdAt: new Date(1)
  })
  mem.coll('collects').set('c2', {
    _id: 'c2',
    userId: 'u1',
    targetId: 'pr1',
    type: 'product',
    createdAt: new Date(2)
  })

  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'my-list')
  const res = await main({ type: 'collects' })
  assert.equal(res.success, true)
  assert.equal(res.list.length, 2)
})

test('my-list：type=products 只返回本人商品', async () => {
  mem.coll('products').set('a', {
    _id: 'a',
    userId: 'u1',
    status: 'on_sale',
    createdAt: new Date()
  })
  mem.coll('products').set('b', {
    _id: 'b',
    userId: 'other',
    status: 'on_sale',
    createdAt: new Date()
  })
  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'my-list')
  const res = await main({ type: 'products' })
  assert.equal(res.list.length, 1)
  assert.equal(res.list[0]._id, 'a')
})

test('my-list：未知 type 报错', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'my-list')
  const res = await main({ type: 'nope' })
  assert.equal(res.success, false)
})

/* ---------------------------- product-create 校验分支 ---------------------------- */

test('product-create：价格非法/成色非法拒绝', async () => {
  const { main } = loadUnit('api-product', 'product-create')
  const badPrice = await main({
    title: 'T',
    description: 'D',
    images: ['cloud://x/1.jpg'],
    price: -1,
    category: 'digital',
    condition: 'good',
    tradeType: 'face'
  })
  assert.equal(badPrice.success, false, '负价格应拒绝')

  const badCond = await main({
    title: 'T',
    description: 'D',
    images: ['cloud://x/1.jpg'],
    price: 1,
    category: 'digital',
    condition: 'like_new',
    tradeType: 'face'
  })
  assert.equal(badCond.success, false, '成色必须在白名单内')
})

test('product-create：tradeType 非法拒绝', async () => {
  const { main } = loadUnit('api-product', 'product-create')
  const res = await main({
    title: 'T',
    description: 'D',
    images: ['cloud://x/1.jpg'],
    price: 1,
    category: 'digital',
    condition: 'good',
    tradeType: 'teleport'
  })
  assert.equal(res.success, false)
})

/* ---------------------------- 审计：admin 删除评论级联 ---------------------------- */

test('admin delete comment：级联软删子回复并回退计数', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', userId: 'u1', status: 'normal', commentCount: 2 })
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

  const { main } = loadUnit('api-admin', 'admin')
  const res = await main({ action: 'delete', targetType: 'comment', targetId: 'f1' })
  assert.equal(res.success, true)
  assert.equal(mem.coll('comments').get('r1').status, 'deleted', '子回复应级联')
  assert.equal(mem.coll('posts').get('p1').commentCount, 0)
})

// 测试结束后清掉运行时生成的 shim，避免污染构建门禁的「源码目录不得有多余文件」检查
after(() => mem.removeSourceShims())
