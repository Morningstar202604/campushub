// handlers-extra.test.js — 最后一轮覆盖率补齐
//
// 目标文件：announcement(61%) / verify(51%) / product-create(67%) / user-update(76%)
// 以及 common-content / common-subscribe 的剩余分支。
const { test, beforeEach, after, afterEach } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const mem = require('./lib/memory-db')

const CF = path.resolve(__dirname, '..', 'cloudfunctions')
const ADMIN_OPENID = 'openid-admin-3'
const USER_OPENID = 'openid-user-3'

let env

function loadUnit(unit, fn) {
  mem.ensureSourceShims()
  mem.purge(path.join('cloudfunctions', unit, 'handlers'))
  mem.purge(path.join('cloudfunctions', 'common'))
  const mod = require(path.join(CF, unit, 'handlers', fn + '.js'))
  const handler = typeof mod === 'function' ? mod : mod.main
  return { main: (event) => handler(event) }
}

function actAs(openid, extra = {}) {
  if (env) env.restore()
  env = mem.install({
    wxContext: { OPENID: openid },
    openapi: { security: { msgSecCheck: async () => ({}), imgSecCheck: async () => ({}) } },
    ...extra
  })
  mem.purge(path.join('cloudfunctions', 'common'))
}

function seed() {
  mem.coll('users').set('admin', {
    _id: 'admin',
    openid: ADMIN_OPENID,
    nickname: '管理员',
    verifyStatus: 'unverified',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    renameTokens: 0
  })
  mem.coll('users').set('u1', {
    _id: 'u1',
    openid: USER_OPENID,
    nickname: '阿三',
    avatar: '',
    school: 'S',
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
    renameTokens: 0,
    hasRenamed: false
  })
  mem.coll('categories').set('c-leaf', {
    _id: 'c-leaf',
    name: '学习',
    parentId: '',
    level: 1,
    status: 'active',
    schoolId: 's1'
  })
}

beforeEach(() => {
  mem.reset()
  env = mem.install({ wxContext: {}, openapi: {} })
  process.env.ADMIN_OPENIDS = ADMIN_OPENID
  seed()
  actAs(ADMIN_OPENID)
  mem.coll('rate_limits').clear()
})

afterEach(() => {
  env.restore()
  delete process.env.ADMIN_OPENIDS
})

/* ---------------------------- announcement ---------------------------- */

test('announcement：toggle 两次回到 active', async () => {
  mem.coll('announcements').set('a1', { _id: 'a1', title: 'T', status: 'active' })
  const { main } = loadUnit('api-admin', 'announcement')
  const off = await main({ action: 'toggle', id: 'a1' })
  assert.equal(off.status, 'inactive')
  const on = await main({ action: 'toggle', id: 'a1' })
  assert.equal(on.status, 'active')
})

test('announcement：toggle 不存在的 ID 报 NOT_FOUND', async () => {
  const { main } = loadUnit('api-admin', 'announcement')
  const res = await main({ action: 'toggle', id: 'nope' })
  assert.equal(res.success, false)
  assert.equal(res.code, 'NOT_FOUND')
})

test('announcement：标题/内容为空或超长拒绝', async () => {
  const { main } = loadUnit('api-admin', 'announcement')
  assert.equal((await main({ action: 'create', title: '', content: 'C' })).success, false)
  assert.equal(
    (await main({ action: 'create', title: 'T', content: '' })).success,
    false,
    '内容不能为空'
  )
  assert.equal(
    (await main({ action: 'create', title: 'x'.repeat(51), content: 'C' })).success,
    false
  )
  assert.equal(
    (await main({ action: 'create', title: 'T', content: 'y'.repeat(1001) })).success,
    false
  )
})

test('announcement：delete 移除公告', async () => {
  mem.coll('announcements').set('a1', { _id: 'a1', title: 'T', status: 'active' })
  const { main } = loadUnit('api-admin', 'announcement')
  const res = await main({ action: 'delete', id: 'a1' })
  assert.equal(res.success, true)
  assert.equal(mem.coll('announcements').size, 0)
})

test('announcement：list-all 含下线公告', async () => {
  mem.coll('announcements').set('a1', { _id: 'a1', title: 'A', status: 'active' })
  mem.coll('announcements').set('a2', { _id: 'a2', title: 'B', status: 'inactive' })
  const { main } = loadUnit('api-admin', 'announcement')
  const res = await main({ action: 'list-all' })
  assert.equal(res.list.length, 2)
  const pub = await main({ action: 'list' })
  assert.equal(pub.list.length, 1)
})

/* ---------------------------- verify 全分支 ---------------------------- */

test('verify：status 无申请时返回 none', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({ action: 'status' })
  assert.equal(res.success, true)
  assert.equal(res.status, 'none')
  assert.equal(res.request, null)
})

test('verify：submit 成功后 users.campusVerifyStatus=pending', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({
    action: 'submit',
    school: '测试大学',
    studentId: '20230001',
    imageFileID: 'cloud://env/v.jpg'
  })
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(mem.coll('users').get('u1').campusVerifyStatus, 'pending')
  assert.equal(mem.coll('verify_requests').size, 1)
})

test('verify：被驳回后可以重新提交', async () => {
  mem.coll('users').get('u1').campusVerifyStatus = 'rejected'
  mem.coll('verify_requests').set('v0', {
    _id: 'v0',
    userId: 'u1',
    status: 'rejected',
    createdAt: new Date(1)
  })
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({
    action: 'submit',
    school: 'X',
    studentId: '20230001',
    imageFileID: 'cloud://env/v2.jpg'
  })
  assert.equal(res.success, true)
})

test('verify：未知 action 拒绝', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'verify')
  const res = await main({ action: 'nonsense' })
  assert.equal(res.success, false)
})

/* ---------------------------- product-create 全分支 ---------------------------- */

test('product-create：带原价、交易方式、地点、联系方式一并落库', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-create')
  const res = await main({
    title: '自行车',
    description: '好骑',
    images: ['cloud://env/b.jpg'],
    price: 200,
    originalPrice: 800,
    category: 'sports',
    condition: 'fair',
    tradeType: 'both',
    location: '车棚',
    contactInfo: '微信'
  })
  assert.equal(res.success, true, JSON.stringify(res))
  const doc = mem.coll('products').get(res.productId)
  assert.equal(doc.originalPrice, 800)
  assert.equal(doc.tradeType, 'both')
  assert.equal(doc.location, '车棚')
  assert.equal(doc.contactInfo, '微信')
})

test('product-create：图片超过 9 张拒绝', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-create')
  const res = await main({
    title: 'T',
    description: 'D',
    images: Array.from({ length: 10 }, (_, i) => `cloud://e/${i}.jpg`),
    price: 1,
    category: 'digital',
    condition: 'good',
    tradeType: 'face'
  })
  assert.equal(res.success, false)
})

test('product-create：标题超长拒绝', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-create')
  const res = await main({
    title: 'x'.repeat(31),
    description: 'D',
    images: ['cloud://e/1.jpg'],
    price: 1,
    category: 'digital',
    condition: 'good',
    tradeType: 'face'
  })
  assert.equal(res.success, false)
})

test('product-create：幂等 —— 同 clientReqId 不产生双商品', async () => {
  mem.setUnique('idempotency', ['clientReqId'])
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-create')
  const payload = {
    title: 'T',
    description: 'D',
    images: ['cloud://e/1.jpg'],
    price: 1,
    category: 'digital',
    condition: 'good',
    tradeType: 'face',
    clientReqId: 'pr-req-1'
  }
  const r1 = await main(payload)
  mem.coll('rate_limits').clear()
  const r2 = await main(payload)
  assert.equal(r1.success, true, JSON.stringify(r1))
  assert.equal(r2.success, true)
  assert.equal(r2.productId, r1.productId)
  assert.equal(mem.coll('products').size, 1)
})

/* ---------------------------- user-update 全分支 ---------------------------- */

test('user-update：空昵称拒绝；超长昵称按 20 字截断（非报错）', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'user-update')
  assert.equal((await main({ nickname: '   ' })).success, false, '空昵称应拒绝')

  // 超长是「静默截断到 20 字」而不是报错 —— 这是产品选择（前端 maxlength 已限制），
  // 后端兜底截断而不是让保存失败。断言这个行为，避免以后误改成报错。
  const res = await main({ nickname: 'x'.repeat(30) })
  assert.equal(res.success, true)
  assert.equal(res.user.nickname.length, 20)
})

test('user-update：无可更新字段时报错', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'user-update')
  const res = await main({})
  assert.equal(res.success, false)
})

test('user-update：性别/标签/学院等字段落库', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-auth', 'user-update')
  const res = await main({
    nickname: '新名',
    gender: 1,
    tags: ['跑步', '读书'],
    college: '计算机学院',
    major: '软件工程',
    grade: '大三'
  })
  assert.equal(res.success, true)
  const u = mem.coll('users').get('u1')
  assert.equal(u.gender, 1)
  assert.deepEqual(u.tags, ['跑步', '读书'])
  assert.equal(u.college, '计算机学院')
})

/* ---------------------------- common-content 剩余分支 ---------------------------- */

test('countViewOnce：同一人同一天只计一次浏览', async () => {
  mem.coll('posts').set('p1', { _id: 'p1', viewCount: 0, status: 'normal' })
  actAs(USER_OPENID)
  const { main } = loadUnit('api-post', 'post-detail')

  const r1 = await main({ postId: 'p1' })
  assert.equal(r1.post.viewCount, 1, '首次浏览计数')
  const r2 = await main({ postId: 'p1' })
  assert.equal(r2.post.viewCount, 1, '同一人同一天不应重复计数')
})

test('removeContent：图片回收失败不影响主删除', async () => {
  mem.coll('posts').set('p1', {
    _id: 'p1',
    userId: 'u1',
    status: 'normal',
    images: ['cloud://env/1.jpg', 'https://cdn/x.jpg']
  })
  actAs(USER_OPENID, {
    deleteFile: async () => {
      throw new Error('storage down')
    }
  })
  const { main } = loadUnit('api-post', 'post-delete')
  const res = await main({ postId: 'p1' })
  assert.equal(res.success, true, '图片回收失败不能阻断删除')
  assert.equal(mem.coll('posts').get('p1').status, 'deleted')
})

test('task-expire：过期任务归档 + 计数对账', async () => {
  const past = new Date(Date.now() - 86400000)
  mem.coll('posts').set('t1', {
    _id: 't1',
    kind: 'task',
    status: 'normal',
    expireAt: past,
    resolved: false,
    userId: 'u1'
  })
  mem.coll('posts').set('t2', {
    _id: 't2',
    kind: 'task',
    status: 'normal',
    expireAt: past,
    resolved: true,
    userId: 'u1'
  })
  mem.coll('users').get('u1').postCount = 0

  mem.purge(path.join('cloudfunctions', 'task-expire'))
  const mod = require(path.join(CF, 'task-expire', 'index.js'))
  // task-expire 是独立函数（exports.main = wrap(async()=>{})），不走网关
  const res = await mod.main()
  assert.equal(res.success, true, JSON.stringify(res))
  assert.equal(mem.coll('posts').get('t1').status, 'expired', '过期未解决的任务应归档')
  assert.equal(mem.coll('posts').get('t2').status, 'normal', '已解决的不归档')
})

/* ---------------------------- common-subscribe ---------------------------- */

test('sendSubscribe：未配置模板时静默跳过，不抛错', async () => {
  mem.purge(path.join('cloudfunctions', 'common'))
  const sub = require(path.join(CF, 'common', 'common-subscribe.js'))
  await sub.sendSubscribe('openid-x', 'comment', 'pages/index/index', {})
  assert.ok(true, '未配置模板时不抛错即为通过')
})

test('getOpenidByUserId：用户不存在返回空串', async () => {
  mem.purge(path.join('cloudfunctions', 'common'))
  const sub = require(path.join(CF, 'common', 'common-subscribe.js'))
  const r = await sub.getOpenidByUserId(
    {
      collection: () => ({ doc: () => ({ field: () => ({ get: async () => ({ data: null }) }) }) })
    },
    'nobody'
  )
  assert.ok(!r, '用户不存在时应返回空值（null 或空串）')
})

// 测试结束后清掉运行时生成的 shim，避免污染构建门禁的「源码目录不得有多余文件」检查
after(() => mem.removeSourceShims())

/* ===== 商品编辑字段级分支（追加，避免新建文件被杀软拦截） ===== */

test('product-update：全部可编辑字段落库', async () => {
  mem.coll('users').get('u1').verifyStatus = 'unverified'
  mem.coll('products').set('pr1', {
    _id: 'pr1',
    userId: 'u1',
    userNickname: '卖家',
    status: 'on_sale',
    title: '旧',
    description: '旧',
    images: ['cloud://e/old.jpg'],
    price: 100,
    originalPrice: 300,
    category: 'digital',
    condition: 'good',
    tradeType: 'face',
    location: '',
    contactInfo: '',
    likeCount: 0,
    collectCount: 0
  })
  mem.coll('rate_limits').clear()
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-update')
  const res = await main({
    productId: 'pr1',
    title: '新标题',
    description: '新描述',
    price: 80,
    originalPrice: 200,
    category: 'books',
    condition: 'fair',
    tradeType: 'mail',
    location: '图书馆',
    contactInfo: '微信'
  })
  assert.equal(res.success, true, JSON.stringify(res))
  const d = mem.coll('products').get('pr1')
  assert.equal(d.title, '新标题')
  assert.equal(d.price, 80)
  assert.equal(d.category, 'books')
  assert.equal(d.condition, 'fair')
  assert.equal(d.tradeType, 'mail')
})

test('product-update：负价格 / 原价低于售价 / 非法枚举 拒绝', async () => {
  mem.coll('products').set('pr1', {
    _id: 'pr1',
    userId: 'u1',
    status: 'on_sale',
    title: 'T',
    images: ['cloud://e/1.jpg'],
    price: 100,
    originalPrice: 300,
    category: 'digital',
    condition: 'good',
    tradeType: 'face'
  })
  mem.coll('rate_limits').clear()
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-update')
  assert.equal((await main({ productId: 'pr1', price: -5 })).success, false)
  assert.equal((await main({ productId: 'pr1', price: 500, originalPrice: 100 })).success, false)
  assert.equal((await main({ productId: 'pr1', category: 'nope' })).success, false)
  assert.equal((await main({ productId: 'pr1', condition: 'like_new' })).success, false)
  assert.equal((await main({ productId: 'pr1', tradeType: 'teleport' })).success, false)
})

test('product-update：图片为空拒绝，替换后落库', async () => {
  mem.coll('products').set('pr1', {
    _id: 'pr1',
    userId: 'u1',
    status: 'on_sale',
    title: 'T',
    images: ['cloud://e/old.jpg'],
    price: 100,
    category: 'digital',
    condition: 'good',
    tradeType: 'face'
  })
  mem.coll('rate_limits').clear()
  actAs(USER_OPENID)
  const { main } = loadUnit('api-product', 'product-update')
  assert.equal((await main({ productId: 'pr1', images: [] })).success, false)
  assert.equal((await main({ productId: 'pr1', images: ['cloud://e/new.jpg'] })).success, true)
  assert.deepEqual(mem.coll('products').get('pr1').images, ['cloud://e/new.jpg'])
})

test('follow：following / followers 列表', async () => {
  mem.coll('users').set('u2', { _id: 'u2', nickname: '对方', avatar: '', school: 'S' })
  mem.coll('follows').set('f1', {
    _id: 'f1',
    followerId: 'u1',
    followingId: 'u2',
    createdAt: new Date()
  })
  actAs(USER_OPENID)
  const { main } = loadUnit('api-social', 'follow')
  const following = await main({ action: 'following' })
  assert.equal(following.list.length, 1)
  assert.equal(following.list[0].nickname, '对方')

  mem.coll('follows').set('f2', {
    _id: 'f2',
    followerId: 'u2',
    followingId: 'u1',
    createdAt: new Date()
  })
  const followers = await main({ action: 'followers' })
  assert.equal(followers.list.length, 1)
})

test('follow：未知 action 拒绝', async () => {
  actAs(USER_OPENID)
  const { main } = loadUnit('api-social', 'follow')
  assert.equal((await main({ action: 'wtf' })).success, false)
})
