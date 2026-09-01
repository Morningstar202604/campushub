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
