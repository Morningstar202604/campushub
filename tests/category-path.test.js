// category-path.test.js — 分类祖先链必须服务端推导（D2 回归防护）
// 背景：post-create / post-update 直接落库客户端传来的 categoryPath，
// 而 post-list 用 `where.categoryPath = categoryId` 做版块筛选且不校验分类状态，
// 因此调用者可伪造祖先链，把内容投进管理员已停用/已删除的版块。
const { test, afterEach } = require('node:test')
const assert = require('node:assert')
const Module = require('module')
const fs = require('fs')
const path = require('path')

const COMMON_DIR = path.resolve(__dirname, '..', 'cloudfunctions', 'common')
const ROOT = path.resolve(__dirname, '..', 'cloudfunctions')
const originalLoad = Module._load

function readIndex(fn) {
  return fs.readFileSync(path.join(ROOT, fn, 'index.js'), 'utf8')
}

// common-content.js 会经 common-db.js 拉起 wx-server-sdk，测试里注入空壳即可（本用例不碰云调用）


// 用给定分类树构造 mock db；categories 集合按 _id 取文档
function makeDb(tree) {
  return {
    collection(name) {
      assert.equal(name, 'categories')
      return {
        doc: (id) => ({
          get: async () => (tree[id] ? { data: { _id: id, ...tree[id] } } : { data: null })
        })
      }
    }
  }
}

function loadContent() {
  const originalLoad = Module._load
  Module._load = function (request) {
    if (request === 'wx-server-sdk') {
      return {
        DYNAMIC_CURRENT_ENV: 'test',
        init() {},
        getWXContext: () => ({ OPENID: 't' }),
        database: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: null }) }) }), command: {} })
      }
    }
    return originalLoad.apply(this, arguments)
  }
  for (const f of ['common-db.js', 'common-error.js', 'common-security.js', 'common-content.js']) {
    delete require.cache[path.join(COMMON_DIR, f)]
  }
  const mod = require(path.join(COMMON_DIR, 'common-content.js'))
  Module._load = originalLoad
  return mod
}

afterEach(() => {
  Module._load = originalLoad
})

test('resolveCategoryPath：由叶子沿 parentId 回溯，返回根在前的祖先链', async () => {
  const { resolveCategoryPath } = loadContent()
  assert.equal(typeof resolveCategoryPath, 'function', '内核必须导出 resolveCategoryPath')
  const db = makeDb({
    zone_a: { name: '校区A', parentId: null, status: 'active' },
    cat_b: { name: '失物', parentId: 'zone_a', status: 'active' },
    board_c: { name: '教学楼', parentId: 'cat_b', status: 'active' }
  })
  const r = await resolveCategoryPath({ db, categoryId: 'board_c' })
  assert.deepEqual(r.chain, ['zone_a', 'cat_b', 'board_c'])
  assert.equal(r.leaf.name, '教学楼')
})

test('resolveCategoryPath：任一祖先被停用即拒绝（禁止把内容投进已停用版块）', async () => {
  const { resolveCategoryPath } = loadContent()
  const db = makeDb({
    zone_a: { name: '校区A', parentId: null, status: 'active' },
    cat_b: { name: '失物', parentId: 'zone_a', status: 'inactive' },
    board_c: { name: '教学楼', parentId: 'cat_b', status: 'active' }
  })
  await assert.rejects(
    resolveCategoryPath({ db, categoryId: 'board_c' }),
    (e) => e.code === 'CATEGORY_INACTIVE'
  )
})

test('resolveCategoryPath：祖先链断裂（引用不存在的分类）拒绝', async () => {
  const { resolveCategoryPath } = loadContent()
  const db = makeDb({ board_c: { name: '教学楼', parentId: 'ghost', status: 'active' } })
  await assert.rejects(
    resolveCategoryPath({ db, categoryId: 'board_c' }),
    (e) => e.code === 'CATEGORY_NOT_FOUND'
  )
})

test('resolveCategoryPath：parentId 成环时拒绝而不是无限上溯', async () => {
  const { resolveCategoryPath } = loadContent()
  const db = makeDb({
    x: { name: 'X', parentId: 'y', status: 'active' },
    y: { name: 'Y', parentId: 'x', status: 'active' }
  })
  await assert.rejects(
    resolveCategoryPath({ db, categoryId: 'x' }),
    (e) => e.code === 'CATEGORY_CYCLE'
  )
})

test('resolveCategoryPath：深度超过 3 级（Zone>Category>Board）拒绝', async () => {
  const { resolveCategoryPath } = loadContent()
  const db = makeDb({
    l1: { name: '1', parentId: null, status: 'active' },
    l2: { name: '2', parentId: 'l1', status: 'active' },
    l3: { name: '3', parentId: 'l2', status: 'active' },
    l4: { name: '4', parentId: 'l3', status: 'active' }
  })
  await assert.rejects(
    resolveCategoryPath({ db, categoryId: 'l4' }),
    (e) => e.code === 'CATEGORY_TOO_DEEP'
  )
})

test('写入侧必须忽略客户端 categoryPath，一律采用服务端推导结果', () => {
  // 注意：商品（product-*）不使用分类树，走独立 category 枚举，故不在断言范围内。
  const offenders = []
  for (const fn of ['post-create', 'post-update']) {
    const code = readIndex(fn)
    if (!code.includes('resolveCategoryPath')) offenders.push(`${fn}(未调用推导)`)
    // 落库语句里不得再出现客户端 categoryPath 变量
    if (/categoryPath:\s*(Array\.isArray\(categoryPath\)\s*\?\s*categoryPath|categoryPath)\b/.test(code)) {
      offenders.push(`${fn}(仍落库客户端值)`)
    }
  }
  assert.deepEqual(offenders, [], `分类链未收口：${offenders.join(', ')}`)
})
