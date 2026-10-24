// contract.test.js — 源码契约测试：防止本次修复被后续改动回退
// 采用静态断言（读取源码文本），不需要云环境，专门盯防回归。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const UNITS = require('./lib/unit-paths')

/**
 * 从源码推导"当前事实"，供文档一致性断言使用。
 * 目的：文档数字不再由人手抄，抄错/过期由测试当场拦下 —— 这也让本文件不再需要随
 * 云函数收敛这类结构调整去改一堆硬编码常量。
 */
function currentFacts() {
  const fsx = require('fs')
  const pathx = require('path')
  const pkg = JSON.parse(fsx.readFileSync(pathx.join(ROOT, 'package.json'), 'utf8'))
  const pages = JSON.parse(fsx.readFileSync(pathx.join(ROOT, 'uni-app/src/pages.json'), 'utf8'))
  const idxSrc = read('cloudfunctions/common/common-indexes.js')
  const idxNames = new Set([...idxSrc.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]))
  const kernel = fsx
    .readdirSync(pathx.join(ROOT, 'cloudfunctions/common'))
    .filter((f) => /^common-[a-z]+\.js$/.test(f))
  // 集合清单必须只取 init-db 里 `const collections = [...]` 这一段；
  // 早先直接对整份文件抓引号串，会把 action 名/字段名当集合，推出 56 这种假数字。
  const initSrc = read('cloudfunctions/init-db/index.js')
  const arrLiteral = initSrc.match(/const\s+collections\s*=\s*\[([\s\S]*?)\]/)
  const collNames = new Set(
    arrLiteral ? [...arrLiteral[1].matchAll(/'([a-z_-]+)'/g)].map((m) => m[1]) : []
  )
  return {
    version: pkg.version,
    deploys: UNITS.deployNames().length,
    units: UNITS.unitNames().length,
    pages: (pages.pages || []).length,
    indexes: idxNames.size,
    kernel: kernel.length,
    collections: collNames.size
  }
}

function read(rel) {
  // 收敛为资源型网关后，`cloudfunctions/<入口>/index.js` 对 34 个入口不再成立。
  // 这里按 gateway-routes 把逻辑入口解析到真实文件（网关 handler 或独立函数），
  // 使断言继续锁"行为"，而不是锁"某一种目录布局"。
  const m = rel.match(/^cloudfunctions\/([a-z0-9-]+)\/index\.js$/)
  if (m && UNITS.ROUTES[m[1]]) {
    rel = path.relative(ROOT, UNITS.sourceFile(m[1])).split(path.sep).join('/')
  }
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
  assert.ok(
    !src.includes("action === 'follow'") || !/collection\('follows'\)\s*\.\s*add/.test(src),
    'follow 分支不再使用裸 add（改为 insertIdempotent）'
  )
})

test('P4: login 返回给客户端的用户文档必须剔除 openid', () => {
  const src = read('cloudfunctions/login/index.js')
  assert.match(src, /function\s+stripOpenid/, 'login 需定义 stripOpenid')
  assert.ok(
    !/ok\(\{\s*user:\s*userRes\.data\[0\]\s*\}\)/.test(src),
    'login 所有返回点都要过 stripOpenid'
  )
})

test('P4: user-update 不允许空昵称，且返回剔除 openid', () => {
  const src = read('cloudfunctions/user-update/index.js')
  assert.match(src, /昵称不能为空/, 'user-update 需校验空昵称')
  assert.match(
    src,
    /const\s*\{\s*openid:\s*_openid,[^}]*\}\s*=\s*updated\.data/,
    'user-update 返回需剔除 openid'
  )
})

test('P2: common-indexes 包含推荐流/热榜复合索引，且与 docs/INDEXES.md 对齐', () => {
  const def = read('cloudfunctions/common/common-indexes.js')
  const doc = read('docs/INDEXES.md')
  for (const idx of [
    'idx_posts_status_pinned_created',
    'idx_posts_category_status_pinned_created',
    'idx_posts_status_likes_created'
  ]) {
    assert.ok(def.includes(`name: '${idx}'`), `${idx} 必须在 common-indexes.js 定义`)
    assert.ok(doc.includes(idx), `${idx} 必须出现在 docs/INDEXES.md`)
  }
  // 定义的每个索引都应在文档里可找到（单一事实来源 ↔ 部署文档双向对齐）
  const defNames = [...def.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1])
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
    assert.ok(
      !/if \(!content \|\| !content\.trim\(\)\)/.test(src),
      `${fn}: content 不应再裸 .trim()`
    )
    assert.match(
      src,
      /统一 String 化|String\(raw|String\([^)]*== null/,
      `${fn}: 需对非字符串输入做 String 化`
    )
  }
})

test('P4: 落地页 index.html 统计与版本必须等于当前事实（数字由源码推导，不写死）', () => {
  const src = read('index.html')
  assert.ok(src.includes('Morningstar202604'), '落地页链接应指向当前仓库账号')
  assert.ok(!src.includes('weed33834'), '落地页不应残留旧账号 weed33834')
  const facts = currentFacts()
  const expect = [
    [`>${facts.deploys}<`, '云函数部署单元'],
    [`>${facts.units}<`, '业务入口'],
    [`>${facts.pages}<`, '前端页面'],
    [`>${facts.collections}<`, '数据集合'],
    [`>${facts.indexes}<`, '数据库索引'],
    [`>${facts.kernel}<`, '共享内核模块']
  ]
  for (const [needle, label] of expect) {
    assert.ok(src.includes(needle), `落地页统计应包含 ${label}=${needle}`)
  }
  assert.ok(
    src.includes(`version-${facts.version}-green`),
    `落地页版本 badge 应为 ${facts.version}（package.json 为准）`
  )
})

test('P4: README 中英文版统计必须等于当前事实（部署单元 / 业务入口 / 集合 / 索引）', () => {
  const readme = read('README.md')
  const zh = read('docs/README.zh-CN.md')
  const f = currentFacts()
  assert.ok(readme.includes(`| 云函数（部署单元） | ${f.deploys} `), `README 部署单元=${f.deploys}`)
  assert.ok(readme.includes(`| 业务入口（handler） | ${f.units} |`), `README 业务入口=${f.units}`)
  assert.ok(readme.includes(`| 已定义索引 | ${f.indexes}`), `README 索引=${f.indexes}`)
  assert.ok(zh.includes(`| 云函数（部署单元） | ${f.deploys}`), `zh-CN 部署单元=${f.deploys}`)
  assert.ok(zh.includes(`| 业务入口（handler） | ${f.units} |`), `zh-CN 业务入口=${f.units}`)
  assert.ok(zh.includes(`| 数据集合 | ${f.collections} |`), `zh-CN 集合=${f.collections}`)
  assert.ok(zh.includes(`| 索引定义 | ${f.indexes} |`), `zh-CN 索引=${f.indexes}`)
  // 收敛后"云函数 = 37"这类旧口径不得残留，否则读者会按 37 个目录去找部署单元
  assert.ok(!readme.includes('| 云函数 | 37 |'), 'README 不应残留旧口径「云函数 | 37」')
})

test('文档不得残留已废弃机制与过期口径（sync-common / 旧计数写法）', () => {
  const readme = read('README.md')
  const zh = read('docs/README.zh-CN.md')
  const f = currentFacts()
  // sync-common.js 已随构建期内联一起删除，文档里再出现就是给新人指错路
  for (const [name, doc] of [
    ['README', readme],
    ['zh-CN', zh]
  ]) {
    assert.ok(!doc.includes('sync-common'), `${name} 仍引用已删除的 scripts/sync-common.js`)
    assert.ok(!doc.includes('sync:common'), `${name} 仍引用已废弃的 npm run sync:common`)
    assert.ok(!doc.includes('Cloud Functions × 37'), `${name} 仍写「37 个云函数」旧口径`)
  }
  // 文档必须用推导出来的部署单元数，而不是任何别的数字
  assert.ok(readme.includes(`云函数 × ${f.deploys} 个部署单元`), `README 部署单元应为 ${f.deploys}`)
})

test('使用说明书：存在、README 已挂链接、覆盖全部当前页面与云函数', () => {
  const guide = read('docs/USER_GUIDE.md')
  const readme = read('README.md')
  const zh = read('docs/README.zh-CN.md')
  // README 两处入口
  assert.ok(readme.includes('./docs/USER_GUIDE.md'), 'README 需链接使用说明书')
  assert.ok(zh.includes('./USER_GUIDE.md'), 'zh-CN 需链接使用说明书')
  // 覆盖全部页面 —— 清单由 pages.json 推导，不手填。
  // （手填清单是漂移源：早期版本锁死了原生小程序时代的 23 个页面名，
  //   uni-app 迁移后既包含已删除的 login/agreement/expired/profile，又漏掉
  //   checkin/points/follow/notification/report 等真实页面，导致断言长期空转。）
  const pageFacts = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'uni-app/src/pages.json'), 'utf8')
  ).pages
  const pages = pageFacts.map((p) => p.path.split('/').pop())
  for (const p of pages) {
    assert.ok(guide.includes(p), `说明书应覆盖页面 ${p}`)
  }
  assert.ok(pages.length > 0, 'pages.json 应至少声明一个页面')
  // 覆盖全部业务入口 —— 清单由 gateway-routes.json 推导，不手填（手填清单本身就是漂移源）
  const cfs = UNITS.unitNames()
  for (const c of cfs) {
    assert.ok(guide.includes(c), `说明书云函数清单应包含 ${c}`)
  }
  // 关键章节
  for (const sec of [
    '角色与权限',
    '页面使用手册',
    '功能模块详解',
    '管理后台操作手册',
    '常见问题'
  ]) {
    assert.ok(guide.includes(sec), `说明书应包含章节「${sec}」`)
  }
})
test('DEPLOY.md 索引清单与 common-indexes.js 双向完全一致（防止漏建索引）', () => {
  const def = read('cloudfunctions/common/common-indexes.js')
  const deploy = read('docs/DEPLOY.md')
  const srcNames = new Set([...def.matchAll(/name: '(idx_[a-z_]+)'/g)].map((m) => m[1]))
  const depNames = new Set([...deploy.matchAll(/\|\s*(idx_[a-z_]+)\s*\|/g)].map((m) => m[1]))
  for (const n of srcNames) {
    assert.ok(depNames.has(n), `DEPLOY.md 缺失索引 ${n}`)
  }
  for (const n of depNames) {
    assert.ok(srcNames.has(n), `DEPLOY.md 出现未知索引 ${n}`)
  }
  // v0.9.3 审计加固：46 = 45 + idx_verify_requests_status_created（M8: verify_requests 集合补索引）
  // v0.11.0 用户拉黑：48 = 46 + idx_blocks_blocker_created + idx_blocks_blocker_blocked；
  // v0.11.0 站内私信：51 = 48 + 3 个 messages 索引（会话线程 + 收发两侧窗口）
  // v0.12.0 内容治理：55 = 51 + posts 回收站 1 + post_revisions 1 + sensitive_words 2
  assert.strictEqual(srcNames.size, 55, 'common-indexes.js 应为 55 个索引')
  assert.strictEqual(depNames.size, 55, 'DEPLOY.md 应列出全部 55 个索引')
})

test('P5: 新增功能已真正落地（备份/公告/审计日志/搜索限频/积分闭环/深分页/海报）', () => {
  const fs = require('fs')
  const path = require('path')
  const root = path.join(__dirname, '..')

  // 1) 新云函数目录完整；内核不再以副本形式躺在函数目录里，
  //    改由 scripts/build-functions.js 构建期内联 —— 校验产物里确实带上了内核。
  for (const fn of ['backup-db', 'announcement', 'points']) {
    assert.ok(fs.existsSync(UNITS.sourceFile(fn)), `${fn} 源码存在（网关 handler 或独立函数）`)
    const built = path.join(root, 'dist', 'cloudfunctions', UNITS.deployOf(fn), 'index.js')
    assert.ok(fs.existsSync(built), `${fn} 缺少构建产物（请先 npm run build:functions）`)
    const code = fs.readFileSync(built, 'utf8')
    assert.ok(code.includes('wx-server-sdk'), `${fn} 产物应保留外部 wx-server-sdk 引用`)
    assert.ok(
      /function (initCloud|getDB)\b|getDB2?\b/.test(code),
      `${fn} 产物未内联 common 内核（构建期内联失效）`
    )
  }
  // 2) backup-db 定时触发器 + 备份集合逻辑
  assert.ok(
    fs.existsSync(path.join(root, 'cloudfunctions', 'backup-db', 'config.json')),
    'backup-db 触发器配置存在'
  )
  assert.ok(
    read('cloudfunctions/backup-db/index.js').includes("collection('backups')"),
    'backup-db 写入 backups 集合'
  )

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
  // 4b) uni-app 前端接入（旧 miniprogram 断言已随前端替换退役）
  assert.ok(
    read('uni-app/src/pages/index/index.vue').includes('loadAnnouncements'),
    'uni-app 首页加载公告'
  )
  assert.ok(read('uni-app/src/adapters/index.ts').includes('adaptNotice'), 'uni-app 通知适配层')

  // 5) 管理审计日志：logAdmin 注入 + list-logs
  assert.ok(read('cloudfunctions/admin/index.js').includes('logAdmin'), 'admin 注入 logAdmin')
  assert.ok(read('cloudfunctions/admin/index.js').includes('list-logs'), 'admin 提供 list-logs')

  // 6) 搜索服务端限频 + 热词
  const search = read('cloudfunctions/search/index.js')
  assert.ok(search.includes('search_queries'), 'search 写入 search_queries')
  assert.ok(search.includes("action === 'hot'") || search.includes("'hot'"), 'search 提供 hot 热词')

  // 7) 积分消费闭环：points 商城 + 改名卡校验
  assert.ok(read('cloudfunctions/points/index.js').includes('rename-token'), '积分商城含改名卡')
  assert.ok(
    read('cloudfunctions/user-update/index.js').includes('RENAME_LIMITED'),
    'user-update 改名卡校验'
  )
  assert.ok(read('uni-app/src/pages/points/points.vue').includes('redeem'), 'uni-app 前端积分兑换')

  // 8) 深分页 cursor：post-list latest 流 + comment-list（后端侧；前端 cursor 分页待 uni-app 接入）
  assert.ok(
    read('cloudfunctions/post-list/index.js').includes('useCursor'),
    'post-list 支持 cursor'
  )

  // 8b) 失物招领「全部」= lost + found 两类，必须传 kinds 多选；
  //     若退化为不传 kind，普通帖与表白会混入该页（曾出现的真实 bug）。
  const lostFoundSrc = read('uni-app/src/pages/lost-found/lost-found.vue')
  assert.ok(
    lostFoundSrc.includes("q.kinds = ['lost', 'found']"),
    '失物招领「全部」需用 kinds=[lost,found] 过滤'
  )
  assert.ok(
    read('cloudfunctions/post-list/index.js').includes('kinds'),
    'post-list 需支持 kinds 多选过滤'
  )
  assert.ok(
    read('cloudfunctions/comment-list/index.js').includes('useCursor'),
    'comment-list 支持 cursor'
  )

  // 9) 合规个人化：COMPLIANCE 文档 + 定位词收敛
  assert.ok(fs.existsSync(path.join(root, 'docs', 'COMPLIANCE.md')), 'COMPLIANCE.md 存在')
  assert.ok(read('docs/COMPLIANCE.md').includes('个体工商户'), '合规文档含个体工商户路径')
  const readme = read('README.md')
  assert.ok(!readme.includes('nationwide by default'), 'README 不应残留 nationwide 定位')
  assert.ok(!read('docs/README.zh-CN.md').includes('开源贴吧'), 'zh-CN 不应残留「贴吧」定位')
})

test('站内私信：messages 集合/索引/路由/handler 齐备，发送链路接审核与拉黑（v0.11.0）', () => {
  // ① 集合登记
  const init = read('cloudfunctions/init-db/index.js')
  assert.ok(init.includes("'messages'"), 'init-db 应登记 messages 集合')

  // ② 三个索引：会话线程 / 收发两侧的会话列表窗口
  const idx = read('cloudfunctions/common/common-indexes.js')
  for (const n of [
    'idx_messages_conversation_created',
    'idx_messages_from_created',
    'idx_messages_to_created'
  ]) {
    assert.ok(idx.includes(`name: '${n}'`), `messages 索引 ${n} 未定义`)
  }

  // ③ 路由 + handler
  const routes = JSON.parse(read('gateway-routes.json'))
  assert.equal(routes.routes.message, 'api-social', 'message 应登记到 api-social 网关')
  assert.ok(
    fs.existsSync(path.join(ROOT, 'cloudfunctions/api-social/handlers/message.js')),
    'message handler 源码存在'
  )

  // ④ 发送链路的安全三件套：审核（fail-closed）+ 限频 + 双向拉黑检查
  const src = read('cloudfunctions/message/index.js')
  assert.ok(src.includes('checkContents'), '私信发送必须过内容审核（fail-closed）')
  assert.ok(src.includes('rateLimit'), '私信发送必须限频')
  assert.ok(src.includes("collection('blocks')"), '发送前必须做双向拉黑检查（拉黑闭环）')
})

test('用户拉黑：blocks 集合/唯一索引/路由/handler/读侧过滤五要素齐备（v0.11.0）', () => {
  // ① 集合登记：init-db 不建集合，线上查询直接报错
  const init = read('cloudfunctions/init-db/index.js')
  assert.ok(init.includes("'blocks'"), 'init-db 应登记 blocks 集合')

  // ② 唯一索引：insertIdempotent 的幂等靠它，缺了并发双点会撞唯一键抛 500
  const idx = read('cloudfunctions/common/common-indexes.js')
  assert.ok(idx.includes("name: 'idx_blocks_blocker_blocked'"), 'blocks 唯一索引未定义')
  assert.match(idx, /collection: 'blocks'[\s\S]*?unique: true/, 'blocks 必须定义唯一索引')

  // ③ 路由：callFunction 有白名单，未登记的入口前端直接抛错
  const routes = JSON.parse(read('gateway-routes.json'))
  assert.equal(routes.routes.block, 'api-social', 'block 应登记到 api-social 网关')

  // ④ handler 源码存在（网关分发表由路由表生成，缺文件 gen:gateways --check 会拦）
  assert.ok(
    fs.existsSync(path.join(ROOT, 'cloudfunctions/api-social/handlers/block.js')),
    'block handler 源码存在'
  )

  // ⑤ 读侧过滤：拉黑的语义是"拉黑方看不到内容"，三个列表入口都必须接
  for (const fn of ['post-list', 'product-list', 'comment-list']) {
    const src = read(`cloudfunctions/${fn}/index.js`)
    assert.ok(src.includes('blockedUserIds'), `${fn} 必须做黑名单读侧过滤（common-blocklist）`)
  }
})

test('云函数超时必须显式声明（F-011：平台默认 3s，带图发布链路会超时）', () => {
  const offenders = []
  for (const deploy of UNITS.deployNames()) {
    const cfgPath = path.join(ROOT, 'cloudfunctions', deploy, 'config.json')
    let cfg = null
    try {
      cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    } catch {
      offenders.push(`${deploy}(无 config.json)`)
      continue
    }
    const t = cfg.timeout
    if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > 60) {
      offenders.push(`${deploy}(timeout=${JSON.stringify(t)})`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `全部部署单元都应在 config.json 声明 1-60s 超时：${offenders.join(', ')}`
  )
})

test('开源治理：运营方信息外置、无未使用依赖、归档索引存在（v0.10.0）', () => {
  const schoolCfg = read('uni-app/src/config/school.config.js')
  assert.match(schoolCfg, /operator\s*:\s*\{/, 'school.config.js 必须有 operator 段')
  for (const k of ['name', 'contact', 'region']) {
    assert.ok(schoolCfg.includes(`${k}:`), `operator 段缺少 ${k}`)
  }
  const legal = read('uni-app/src/pages/legal/legal.vue')
  assert.ok(legal.includes('schoolConfig'), 'legal.vue 必须读 school.config.js 的运营方信息')
  assert.ok(!legal.includes('CampusHub 运营方'), 'legal.vue 不得再把「CampusHub 运营方」当主体名')

  const uniPkg = JSON.parse(read('uni-app/package.json'))
  const deps = { ...(uniPkg.dependencies || {}), ...(uniPkg.devDependencies || {}) }
  // 这两个包曾装而不用，白增安装体积与审计面
  assert.ok(!deps['wot-design-uni'], 'wot-design-uni 已移除，不得重新引入（源码零 wd-* 引用）')
  assert.ok(!deps['dayjs'], 'dayjs 已移除，fmtTime 使用原生 Date')

  for (const f of [
    'docs/archive/README.md',
    'docs/archive/AUDIT_REPORT_v0.8.1.md',
    'docs/screenshots/README.md'
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), `缺少 ${f}`)
  }
  // 已删除的历史物料不得被文档再次引用。
  // v0.12.0 重新制作了演示视频（docs/screenshots/demo.mp4），因此从本清单移除；
  // 仍禁止引用旧版 preview.html 与不带 -v1 后缀的旧总览图。
  for (const stale of ['docs/preview.html', 'screenshots/overview.png']) {
    for (const doc of ['README.md', 'docs/README.zh-CN.md', 'docs/screenshots/README.md']) {
      assert.ok(!read(doc).includes(stale), `${doc} 仍引用已删除的 ${stale}`)
    }
  }
})
