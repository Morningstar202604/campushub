// common-sync.test.js — 内核单一事实来源（D1 回归防护）
// 背景：v0.9.3 改了 cloudfunctions/common/ 源码却没有重新同步 37 份部署副本，
// 导致部署态的 rateLimit 退化为 `if (!collection) return`（fail-open）。
// 本测试锁死两件事：① 副本必须与源码逐字节一致；② 部署态限频必须是 fail-closed。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..', 'cloudfunctions')
const COMMON_DIR = path.join(ROOT, 'common')

const COMMON_FILES = fs
  .readdirSync(COMMON_DIR)
  .filter((f) => f.startsWith('common-') && f.endsWith('.js'))

function funcDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'common' && d.name !== 'node_modules')
    .map((d) => d.name)
}

function sha1(file) {
  return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex')
}

test('每个云函数目录的内核副本必须与 common 源码逐字节一致', () => {
  const drifted = []
  for (const name of funcDirs()) {
    for (const f of COMMON_FILES) {
      const src = path.join(COMMON_DIR, f)
      const dst = path.join(ROOT, name, f)
      if (!fs.existsSync(dst)) continue // 构建期内联后副本可以不存在，见下一条用例
      if (sha1(src) !== sha1(dst)) drifted.push(`${name}/${f}`)
    }
  }
  assert.deepEqual(drifted, [], `内核副本漂移（部署态会跑旧内核）：${drifted.join(', ')}`)
})

test('部署态限频器必须 fail-closed：缺 collection 参数要抛错，不得静默放行', () => {
  const bad = []
  for (const name of funcDirs()) {
    const dst = path.join(ROOT, name, 'common-rate.js')
    if (!fs.existsSync(dst)) continue
    const code = fs.readFileSync(dst, 'utf8')
    if (/if \(!collection\) return/.test(code)) bad.push(name)
    if (!/throw new AppError\('rateLimit 缺少 collection 参数'/.test(code)) bad.push(name)
  }
  assert.deepEqual([...new Set(bad)], [], `以下函数的限频器是 fail-open：${[...new Set(bad)].join(', ')}`)
})

test('内核源码本身不得重新引入 fail-open 分支', () => {
  const code = fs.readFileSync(path.join(COMMON_DIR, 'common-rate.js'), 'utf8')
  assert.equal(/if \(!collection\) return/.test(code), false)
})
