// contract.test.js — 源码契约测试：防止本次修复被后续改动回退
// 采用静态断言（读取源码文本），不需要云环境，专门盯防回归。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

test('P1: admin 删除内容必须传 openid（否则内核 checkAdmin(actor.openid) 永远拒绝）', () => {
  const src = read('cloudfunctions/admin/index.js')
  assert.match(src, /openid:\s*operatorOpenid/, 'admin delete 分支必须把 operatorOpenid 传给 actor')
  assert.ok(!/role:\s*'admin'/.test(src), 'admin 不再依赖已废弃的 role 字段判定')
})

test('P3: follow 关注改用 insertIdempotent（依赖唯一索引幂等，杜绝并发撞唯一键 500）', () => {
  const src = read('cloudfunctions/follow/index.js')
  assert.match(src, /insertIdempotent/, 'follow 必须引入 insertIdempotent')
  assert.ok(!src.includes("action === 'follow'") || !/collection\('follows'\)\s*\.\s*add/.test(src),
    'follow 分支不再使用裸 add（改为 insertIdempotent）')
})

test('P4: login 返回给客户端的用户文档必须剔除 openid', () => {
  const src = read('cloudfunctions/login/index.js')
  assert.match(src, /function\s+stripOpenid/, 'login 需定义 stripOpenid')
  assert.ok(!/ok\(\{\s*user:\s*userRes\.data\[0\]\s*\}\)/.test(src), 'login 所有返回点都要过 stripOpenid')
})

test('P4: user-update 不允许空昵称，且返回剔除 openid', () => {
  const src = read('cloudfunctions/user-update/index.js')
  assert.match(src, /昵称不能为空/, 'user-update 需校验空昵称')
  assert.match(src, /const\s*\{\s*openid:\s*_openid,[^}]*\}\s*=\s*updated\.data/, 'user-update 返回需剔除 openid')
})

test('P2: common-indexes 包含推荐流/热榜复合索引，且与 docs/INDEXES.md 对齐', () => {
  const def = read('cloudfunctions/common/common-indexes.js')
  const doc = read('docs/INDEXES.md')
  for (const idx of ['idx_posts_status_pinned_created', 'idx_posts_category_status_pinned_created', 'idx_posts_status_likes_created']) {
    assert.ok(def.includes(`name: '${idx}'`), `${idx} 必须在 common-indexes.js 定义`)
    assert.ok(doc.includes(idx), `${idx} 必须出现在 docs/INDEXES.md`)
  }
  // 定义的每个索引都应在文档里可找到（单一事实来源 ↔ 部署文档双向对齐）
  const defNames = [...def.matchAll(/name: '([a-z_]+)'/g)].map(m => m[1])
  for (const n of defNames) {
    assert.ok(doc.includes(n), `索引 ${n} 缺失于 docs/INDEXES.md`)
  }
})

test('P4: init-db 种子学校支持环境变量覆盖（SEED_SCHOOL_NAME / SEED_SCHOOL_ID）', () => {
  const src = read('cloudfunctions/init-db/index.js')
  assert.match(src, /SEED_SCHOOL_NAME/, 'init-db 需读取 SEED_SCHOOL_NAME')
  assert.match(src, /SEED_SCHOOL_ID/, 'init-db 需读取 SEED_SCHOOL_ID')
  assert.match(src, /applySchool/, 'init-db 需有 applySchool 替换逻辑')
})

test('P4: 所有 UGC 写入入口对非字符串输入做 String 化（防 .trim()/.length 抛 TypeError → 500）', () => {
  const targets = ['post-create', 'comment-create', 'feedback-create', 'product-create', 'report']
  for (const fn of targets) {
    const src = read(`cloudfunctions/${fn}/index.js`)
    assert.ok(!/if \(!title \|\| !title\.trim\(\)\)/.test(src), `${fn}: title 不应再裸 .trim()`)
    assert.ok(!/if \(!content \|\| !content\.trim\(\)\)/.test(src), `${fn}: content 不应再裸 .trim()`)
    assert.match(src, /统一 String 化|String\(raw|String\([^)]*== null/, `${fn}: 需对非字符串输入做 String 化`)
  }
})

test('P4: 落地页 index.html 统计与链接应保持最新（37/23/21/41/9 + Morningstar202604）', () => {
  const src = read('index.html')
  assert.ok(src.includes('Morningstar202604'), '落地页链接应指向当前仓库账号')
  assert.ok(!src.includes('weed33834'), '落地页不应残留旧账号 weed33834')
  for (const n of ['>37<', '>23<', '>21<', '>41<', '>9<']) {
    assert.ok(src.includes(n), `落地页统计应包含 ${n}`)
  }
  assert.match(src, /version-0.8.0-green/, '落地页版本 badge 应为 0.7.0')
})

test('P4: 文档统计数字与事实一致（37 云函数 / 23 页面 / 21 集合 / 41 索引 / 9 内核）', () => {
  const readme = read('README.md')
  const zh = read('docs/README.zh-CN.md')
  assert.ok(!readme.includes('| Cloud Functions | 34 |'), 'README 不应残留 34（旧值）')
  assert.ok(!zh.includes('| 云函数 | 34 |'), 'zh-CN 不应残留 34（旧值）')
  assert.ok(readme.includes('| Cloud Functions | 37 |'), 'README 云函数=37')
  assert.ok(readme.includes('Defined Indexes | 41'), 'README 索引=41')
  assert.ok(zh.includes('| 云函数 | 37 |'), 'zh-CN 云函数=37')
  assert.ok(zh.includes('| 数据集合 | 21 |'), 'zh-CN 集合=21')
  assert.ok(zh.includes('| 索引定义 | 41 |'), 'zh-CN 索引=41')
})

test('使用说明书：存在、README 已挂链接、覆盖全部 23 页面与 34 云函数', () => {
  const guide = read('docs/USER_GUIDE.md')
  const readme = read('README.md')
  const zh = read('docs/README.zh-CN.md')
  // README 两处入口
  assert.ok(readme.includes('./docs/USER_GUIDE.md'), 'README 需链接使用说明书')
  assert.ok(zh.includes('./USER_GUIDE.md'), 'zh-CN 需链接使用说明书')
  // 覆盖全部 23 个页面（以页面目录名 + 页面标题出现为准）
  const pages = ['admin', 'agreement', 'category-admin', 'expired', 'feedback', 'guide', 'guide-detail', 'index',
    'login', 'lost-found', 'market', 'my-list', 'notifications', 'post-detail', 'post-publish', 'product-detail',
    'product-publish', 'profile', 'profile-edit', 'search', 'user-profile', 'verify', 'wall']
  for (const p of pages) {
    assert.ok(guide.includes(p), `说明书应覆盖页面 ${p}`)
  }
  // 覆盖全部 37 个云函数
  const cfs = ['admin', 'category-list', 'category-manage', 'checkin', 'collect', 'comment-create', 'comment-delete',
    'comment-list', 'feedback-create', 'follow', 'guide-detail', 'guide-list', 'init-db', 'like', 'login', 'my-list',
    'notification', 'post-create', 'post-delete', 'post-detail', 'post-list', 'post-update', 'product-create',
    'product-delete', 'product-detail', 'product-list', 'product-update', 'report', 'resolve', 'search', 'task-expire',
    'user-profile', 'user-update', 'verify', 'backup-db', 'announcement', 'points']
  for (const c of cfs) {
    assert.ok(guide.includes(c), `说明书云函数清单应包含 ${c}`)
  }
  // 关键章节
  for (const sec of ['角色与权限', '页面使用手册', '功能模块详解', '管理后台操作手册', '常见问题']) {
    assert.ok(guide.includes(sec), `说明书应包含章节「${sec}」`)
  }
})
test('DEPLOY.md 索引清单与 common-indexes.js 双向完全一致（防止漏建索引）', () => {
  const def = read('cloudfunctions/common/common-indexes.js')
  const deploy = read('docs/DEPLOY.md')
  const srcNames = new Set([...def.matchAll(/name: '(idx_[a-z_]+)'/g)].map(m => m[1]))
  const depNames = new Set([...deploy.matchAll(/\|\s*(idx_[a-z_]+)\s*\|/g)].map(m => m[1]))
  for (const n of srcNames) {
    assert.ok(depNames.has(n), `DEPLOY.md 缺失索引 ${n}`)
  }
  for (const n of depNames) {
    assert.ok(srcNames.has(n), `DEPLOY.md 出现未知索引 ${n}`)
  }
  assert.strictEqual(srcNames.size, 41, 'common-indexes.js 应为 41 个索引')
  assert.strictEqual(depNames.size, 41, 'DEPLOY.md 应列出全部 41 个索引')
})

test('P5: 新增功能已真正落地（备份/公告/审计日志/搜索限频/积分闭环/深分页/海报）', () => {
  const fs = require('fs')
  const path = require('path')
  const root = path.join(__dirname, '..')

  // 1) 新云函数目录完整
  for (const fn of ['backup-db', 'announcement', 'points']) {
    assert.ok(fs.existsSync(path.join(root, 'cloudfunctions', fn, 'index.js')), `${fn}/index.js 存在`)
    assert.ok(fs.existsSync(path.join(root, 'cloudfunctions', fn, 'common-bundle.js')), `${fn} 已同步 common 内核`)
  }
  // 2) backup-db 定时触发器 + 备份集合逻辑
  assert.ok(fs.existsSync(path.join(root, 'cloudfunctions', 'backup-db', 'config.json')), 'backup-db 触发器配置存在')
  assert.ok(read('cloudfunctions/backup-db/index.js').includes("collection('backups')"), 'backup-db 写入 backups 集合')

  // 3) 新集合已登记进 init-db
  const init = read('cloudfunctions/init-db/index.js')
  for (const c of ['backups', 'search_queries', 'admin_logs', 'announcements', 'points_orders']) {
    assert.ok(init.includes(`'${c}'`), `init-db 应登记集合 ${c}`)
  }

  // 4) 公告系统：后端 5 动作 + 前端首页公告条 + 管理后台 tab
  const anno = read('cloudfunctions/announcement/index.js')
  for (const a of ['list', 'list-all', 'create', 'toggle', 'delete']) {
    assert.ok(anno.includes(`action === '${a}'`) || anno.includes(`'${a}'`), `公告动作 ${a}`)
  }
  assert.ok(read('miniprogram/pages/index/index.js').includes('loadAnnouncements'), '首页加载公告')
  assert.ok(read('miniprogram/pages/admin/admin.wxml').includes('公告'), '管理后台公告 tab')

  // 5) 管理审计日志：logAdmin 注入 + list-logs
  assert.ok(read('cloudfunctions/admin/index.js').includes('logAdmin'), 'admin 注入 logAdmin')
  assert.ok(read('cloudfunctions/admin/index.js').includes('list-logs'), 'admin 提供 list-logs')

  // 6) 搜索服务端限频 + 热词
  const search = read('cloudfunctions/search/index.js')
  assert.ok(search.includes('search_queries'), 'search 写入 search_queries')
  assert.ok(search.includes("action === 'hot'") || search.includes("'hot'"), 'search 提供 hot 热词')

  // 7) 积分消费闭环：points 商城 + 改名卡校验
  assert.ok(read('cloudfunctions/points/index.js').includes('rename-token'), '积分商城含改名卡')
  assert.ok(read('cloudfunctions/user-update/index.js').includes('RENAME_LIMITED'), 'user-update 改名卡校验')
  assert.ok(read('miniprogram/pages/profile-edit/profile-edit.js').includes('redeemRenameToken'), '前端兑换改名卡')

  // 8) 深分页 cursor：post-list latest 流 + comment-list
  assert.ok(read('cloudfunctions/post-list/index.js').includes('useCursor'), 'post-list 支持 cursor')
  assert.ok(read('cloudfunctions/comment-list/index.js').includes('useCursor'), 'comment-list 支持 cursor')
  assert.ok(read('miniprogram/pages/post-detail/post-detail.js').includes('commentCursor'), '前端评论 cursor 分页')

  // 9) 帖子海报
  assert.ok(read('miniprogram/pages/post-detail/post-detail.js').includes('onSharePoster'), '海报生成方法')
  assert.ok(read('miniprogram/pages/post-detail/post-detail.wxml').includes('posterCanvas'), '海报 canvas')

  // 10) 合规个人化：COMPLIANCE 文档 + 定位词收敛
  assert.ok(fs.existsSync(path.join(root, 'docs', 'COMPLIANCE.md')), 'COMPLIANCE.md 存在')
  assert.ok(read('docs/COMPLIANCE.md').includes('个体工商户'), '合规文档含个体工商户路径')
  const readme = read('README.md')
  assert.ok(!readme.includes('nationwide by default'), 'README 不应残留 nationwide 定位')
  assert.ok(!read('docs/README.zh-CN.md').includes('开源贴吧'), 'zh-CN 不应残留「贴吧」定位')
})

