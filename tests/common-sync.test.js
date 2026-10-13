// common-sync.test.js — 部署产物必须内联"当前内核"（D1 回归防护）
// v0.9.3 改了 cloudfunctions/common/ 却没重新同步 37 份副本，结果线上跑的是
// `if (!collection) return` 的 fail-open 限频器。现在副本机制已被构建期内联取代
// （见 tests/build-pipeline.test.js），所以本文件直接校验**真正上传到云端的那个文件**：
// 产物里只允许存在当前内核的行为，任何 fail-open 残留都视为回归。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '..', 'cloudfunctions')
const DIST = path.resolve(__dirname, '..', 'dist', 'cloudfunctions')

function builtFunctions() {
  if (!fs.existsSync(DIST)) {
    throw new Error('缺少 dist/cloudfunctions：先执行 npm run build:functions（gate 会自动跑）')
  }
  return fs.readdirSync(DIST).filter((d) => fs.existsSync(path.join(DIST, d, 'index.js')))
}

test('每个云函数产物里的限频器都必须是 fail-closed', () => {
  const failOpen = []
  for (const fn of builtFunctions()) {
    const code = fs.readFileSync(path.join(DIST, fn, 'index.js'), 'utf8')
    // 旧缺陷形态：缺 collection 参数时静默放行
    if (/if\s*\(!collection\)\s*return/.test(code)) failOpen.push(fn)
  }
  assert.deepEqual(failOpen, [], `产物中仍存在 fail-open 限频器：${failOpen.join(', ')}`)
})

test('产物必须带上当前的限频与分类内核（内联未失效）', () => {
  const missing = []
  for (const fn of builtFunctions()) {
    const code = fs.readFileSync(path.join(DIST, fn, 'index.js'), 'utf8')
    if (!/rateLimit 缺少 collection 参数/.test(code)) missing.push(`${fn}(限频文案缺失)`)
  }
  assert.deepEqual(missing, [], `产物内联内容过期：${missing.slice(0, 6).join(', ')}`)
})

test('内核源码本身不得重新引入 fail-open 分支', () => {
  const code = fs.readFileSync(path.join(SRC, 'common', 'common-rate.js'), 'utf8')
  assert.equal(/if \(!collection\) return/.test(code), false)
})

test('函数源码目录不得再出现内核副本（副本=漂移的载体）', () => {
  const copies = []
  for (const fn of fs.readdirSync(SRC)) {
    const dir = path.join(SRC, fn)
    if (fn === 'common' || !fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) if (/^common-[a-z]+\.js$/.test(f)) copies.push(`${fn}/${f}`)
  }
  assert.deepEqual(copies, [], `仍有 ${copies.length} 份副本：${copies.slice(0, 5).join(', ')}`)
})
