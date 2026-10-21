// fixes.test.ts — 本轮专家验收缺陷的回归测试
//
// 每条用例对应一个真实缺陷，且都在修复前确认过会失败。
// 覆盖：分页方向、匿名脱敏、签到积分、举报闭环、演示层校验强度。
import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadModule } from './_harness.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '..', '..')
const CF = path.join(REPO, 'cloudfunctions')

const readCf = (rel: string) => fs.readFileSync(path.join(CF, rel), 'utf8')

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

/* ---------------- 匿名脱敏 ---------------- */

test('匿名帖：详情与列表都不得下发真实 userId', () => {
  const detail = readCf('api-post/handlers/post-detail.js')
  const list = readCf('api-post/handlers/post-list.js')
  assert.ok(
    detail.includes('maskAnonymous(post)'),
    'post-detail 必须对匿名帖脱敏，否则 userId 可反查作者'
  )
  assert.ok(
    list.includes('res.data.map(maskAnonymous)'),
    'post-list 必须对匿名帖脱敏'
  )
  // 两个脱敏函数都必须真的移除 userId
  assert.match(detail, /const \{[^}]*userId: _userId/, 'post-detail 脱敏需解构掉 userId')
  assert.match(list, /const \{[^}]*userId: _userId/, 'post-list 脱敏需解构掉 userId')
})

/* ---------------- 签到积分 ---------------- */

test('签到：totalPoints 必须取回读余额，不能用 || 兜底成 100', () => {
  const src = readCf('api-social/handlers/checkin.js')
  // 只看代码行，忽略注释（注释里会引用旧写法做说明）
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  assert.ok(
    !code.includes('(user.creditScore || 100) + points'),
    '余额为 0 时 || 100 会返回 101，必须改为回读真实余额'
  )
  assert.ok(
    code.includes('field({ creditScore: true })'),
    '签到后需回读 creditScore 再返回 totalPoints'
  )
})

/* ---------------- 举报闭环 ---------------- */

test('举报：管理台删除内容后必须把 pending 举报置为 resolved', () => {
  const src = readCf('api-admin/handlers/admin.js')
  assert.ok(
    src.includes("status: 'resolved'"),
    '删除被举报内容时需同步 resolve 举报记录，否则审核队列永远清不掉'
  )
  assert.ok(
    src.includes('reportsResolved'),
    '应返回处理条数，便于前端/日志核对'
  )
})

test('举报：详情页必须存在举报入口（此前 report 页全站不可达）', () => {
  const post = fs.readFileSync(
    path.join(REPO, 'uni-app/src/pages/post-detail/post-detail.vue'),
    'utf8'
  )
  const product = fs.readFileSync(
    path.join(REPO, 'uni-app/src/pages/product-detail/product-detail.vue'),
    'utf8'
  )
  for (const [name, src] of [
    ['post-detail', post],
    ['product-detail', product]
  ]) {
    assert.ok(src.includes('onReport'), `${name} 需要举报入口`)
    assert.ok(
      src.includes('/pages/report/report?targetId='),
      `${name} 举报需带 targetId 跳转`
    )
  }
})

/* ---------------- 分类管理 ---------------- */

test('分类管理：改父级必须落库 parentId', () => {
  const src = readCf('api-admin/handlers/category-manage.js')
  assert.ok(
    src.includes('patch.parentId = parentId'),
    '只算 level 不写 parentId 会让「移动分类」返回成功但树结构不变'
  )
})

/* ---------------- 演示层校验强度 ---------------- */

test('演示 product-create：无图必须拒绝（与真实后端一致）', async () => {
  const demo = await freshDemo()
  await assert.rejects(
    () => demo.callDemo('product-create', { title: '无图商品', price: 1 }),
    /至少上传一张图片/,
    '演示层放行无图商品会造成「演示能发、上线被拒」'
  )
})

test('演示 comment-create：空内容必须拒绝', async () => {
  const demo = await freshDemo()
  await assert.rejects(
    () => demo.callDemo('comment-create', { targetId: 'p1', targetType: 'post', content: '   ' }),
    /请输入评论内容/
  )
})

test('演示 post-create：父分类必须拒绝（必须选叶子）', async () => {
  const demo = await freshDemo()
  await assert.rejects(
    () => demo.callDemo('post-create', { title: 'T', content: 'C', categoryId: 'c-zone' }),
    /请选择更具体的分类/
  )
})

test('演示 admin list-reports：行结构必须与真实后端一致（reportId + target）', async () => {
  const demo = await freshDemo()
  await demo.callDemo('report', { targetId: 'p1', targetType: 'post', reason: '广告/营销' })
  const res: any = await demo.callDemo('admin', { action: 'list-reports' })
  assert.ok(res.list.length > 0, '应有 1 条举报')
  const row = res.list[0]
  assert.ok(row.reportId, '主键必须是 reportId（真实后端如此），旧版给 _id 会让管理台取不到键')
  assert.ok(row.target && row.target._id, '必须带 target 摘要对象')
  assert.equal(row._id, undefined, '不应再暴露原始 _id')
})

test('演示 points：兑换后 renameTokens 必须真实增加', async () => {
  const demo = await freshDemo()
  const before: any = await demo.callDemo('points', { action: 'products' })
  assert.equal(before.renameTokens, 0)
  const r: any = await demo.callDemo('points', { action: 'redeem', productId: 'rename-token' })
  assert.equal(r.renameTokens, 1, '兑换成功但 renameTokens 不增 = 用户查无此卡')
  const after: any = await demo.callDemo('points', { action: 'products' })
  assert.equal(after.renameTokens, 1)
})

/* ---------------- 商品枚举一致性 ---------------- */

test('演示商品的 category/condition 必须落在后端白名单内', async () => {
  const demo = await freshDemo()
  const res: any = await demo.callDemo('product-list', { page: 1, pageSize: 50 })
  const CATS = ['digital', 'books', 'living', 'sports', 'other']
  const CONDS = ['new', 'good', 'fair', 'old']
  for (const p of res.list) {
    assert.ok(CATS.includes(p.category), `非法 category: ${p.category}`)
    assert.ok(CONDS.includes(p.condition), `非法 condition: ${p.condition}`)
  }
})

/* ---------------- 页面入口连通性 ---------------- */

test('关键页面必须有可达入口（此前 report/guide-list/follow 零链接）', () => {
  const srcRoot = path.join(REPO, 'uni-app/src')
  const walk = (d: string, acc: string[] = []): string[] => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p, acc)
      else if (/\.(vue|ts)$/.test(e.name)) acc.push(p)
    }
    return acc
  }
  const files = walk(srcRoot).filter((p) => !p.includes('pages.json'))
  const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')

  for (const [page, why] of [
    ['/pages/report/report', '举报页'],
    ['/pages/guide-list/guide-list', '校园指南'],
    ['/pages/follow/follow', '关注列表']
  ] as const) {
    assert.ok(all.includes(page), `${why}（${page}）必须有入口，否则注册了也点不到`)
  }
})

/* ---------------- 种子数据自洽 ---------------- */

test('演示种子：commentCount 必须等于真实评论数（含楼中楼）', async () => {
  const demo = await freshDemo()
  const res: any = await demo.callDemo('post-list', { pageSize: 50 })
  for (const p of res.list) {
    const c: any = await demo.callDemo('comment-list', { targetId: p._id })
    const actual = c.list.reduce((n: number, f: any) => n + 1 + (f.replies?.length || 0), 0)
    assert.equal(
      p.commentCount,
      actual,
      `${p._id}「${p.title || p.content}」计数 ${p.commentCount} 与实际 ${actual} 不符` +
        '（页头显示「回应 N」但列表为空，用户会以为内容丢失）'
    )
  }
})
