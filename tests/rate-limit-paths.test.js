// rate-limit-paths.test.js — 变异路径限频与审核顺序（D3 回归防护）
// 背景两条：
// ① post-update / product-update / user-update / post-delete / comment-delete 全都没有 rateLimit，
//    攻击者可无限次编辑，每次编辑都会触发一次 msgSecCheck/imgSecCheck。
// ② 已有 create 路径把 rateLimit 放在审核之后，等于"先烧配额再拦截"；
//    在 fail-closed 设计下，审核配额一旦被耗尽，全站都发不出内容（自我 DDoS）。
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', 'cloudfunctions')

function readIndex(fn) {
  return fs.readFileSync(path.join(ROOT, fn, 'index.js'), 'utf8')
}

const MUTATION_PATHS = [
  'post-create',
  'post-update',
  'post-delete',
  'product-create',
  'product-update',
  'product-delete',
  'comment-create',
  'comment-delete',
  'user-update',
  'like',
  'collect',
  'follow',
  'report',
  'feedback-create',
  'verify'
]

// checkin 不走窗口限频：它由唯一索引 idx_checkins_user_date(userId+date) 天然幂等，
// 再加一层 rateLimit 只会多写一条 rate_limits（云开发写配额 3 万次/天，是更贵的代价）。
test('签到由唯一索引防双签，而不是靠窗口限频', () => {
  const indexes = fs.readFileSync(path.join(ROOT, 'common', 'common-indexes.js'), 'utf8')
  assert.match(indexes, /collection: 'checkins'[\s\S]*?unique: true/)
})

test('所有用户可触发的写路径都必须限频', () => {
  const missing = MUTATION_PATHS.filter((fn) => {
    const code = readIndex(fn)
    return !/await\s+rateLimit\(/.test(code)
  })
  assert.deepEqual(missing, [], `以下写路径未限频：${missing.join(', ')}`)
})

test('审核调用（文本/图片）必须排在限频之后，避免用编辑烧穿审核配额', () => {
  const misordered = []
  for (const fn of MUTATION_PATHS) {
    const code = readIndex(fn)
    const iRate = code.search(/await\s+rateLimit\(/)
    if (iRate === -1) continue
    const iSec = Math.min(
      ...[code.search(/await\s+checkContents?\(/), code.search(/await\s+checkImages?\(/)].filter(
        (n) => n !== -1
      )
    )
    if (Number.isFinite(iSec) && iSec < iRate) misordered.push(fn)
  }
  assert.deepEqual(misordered, [], `审核在限频之前执行：${misordered.join(', ')}`)
})

test('限频主体必须是服务端身份标量，不得使用客户端可控字段', () => {
  const offenders = []
  for (const fn of MUTATION_PATHS) {
    const code = readIndex(fn)
    const m = code.match(/rateLimit\(\{([\s\S]*?)\}\)/)
    if (!m) continue
    const matchSeg = (m[1].match(/match:\s*\{([^}]*)\}/) || [])[1] || ''
    // 只允许 user._id / user.openid / me._id / me.openid 这类服务端派生标量
    if (!/(user|me)\.(_id|openid)/.test(matchSeg)) offenders.push(fn)
  }
  assert.deepEqual(offenders, [], `限频主体可疑（可能被绕过）：${offenders.join(', ')}`)
})
