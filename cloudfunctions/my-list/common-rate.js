// common-rate.js — 统一频率限制
// v0.9.2 重写：原实现「时间窗内 count 业务集合」存在 TOCTOU 并发绕过——
// N 个并发请求在任一条业务记录落库前都读到 0 → 全部放行，刷帖/刷品可绕过「30s 内 1 条」。
// 现改为 rate_limits 集合「确定性 _id 占位 + 原子自增」：
//   - _id = rl_<collection>_<match 序列化>_<窗口起点>：窗口内首个请求 add 成功即占位（主键唯一保证原子）；
//   - 并发/后续请求 add 撞主键失败：max=1 直接拒绝；max>1 原子 _.inc 自增后回读判定；
//   - 残余竞态仅剩 max>1 时「自增后回读同值」（超限量 ≤ 并发数），杜绝原实现的 N 倍洪峰。
// 取舍：滑动窗口 → 固定窗口（窗口边界处最多 2×max 突发），换取计数原子性与一次主键查询的确定成本。
// 占位文档带 expireAt（3 个窗宽），由 task-expire 定时清理（云开发无自动 TTL）；
// 需要 init-db 预创建 rate_limits 集合 + idx_rate_limits_expire 索引（见 docs/INDEXES.md）。
const { getDB, isDuplicateKeyError } = require('./common-db')
const { AppError } = require('./common-error')

// collection: 业务集合名（兼作限频 scene 标识）；match: 主体匹配条件（如 { userId }，值须为服务端身份标量）；
// windowMs: 时间窗；max: 窗口内允许的最大次数。
async function rateLimit({ collection, match = {}, windowMs = 30000, max = 1, now = Date.now() } = {}) {
  if (!collection) return
  const db = getDB()
  const _ = db.command
  const windowStart = Math.floor(now / windowMs) * windowMs
  const subject = Object.keys(match).sort().map(k => `${k}:${String(match[k])}`).join('|')
  const _id = `rl_${collection}_${subject}_${windowStart}`
  const expireAt = new Date(windowStart + windowMs * 3)
  try {
    await db.collection('rate_limits').add({
      data: { _id, scene: collection, subject, count: 1, expireAt, createdAt: new Date(now) }
    })
    return // 窗口内首请求：占位成功即放行
  } catch (e) {
    if (!isDuplicateKeyError(e)) throw e
  }
  // 已有占位：max=1 时主键唯一性保证窗口内恰一次放行，其余全拒（原子，无竞态）
  if (max <= 1) throw new AppError('操作过于频繁，请稍后再试', 'RATE_LIMITED')
  // max>1：原子自增后回读判定（自增失败按限频拒绝，fail-closed）
  await db.collection('rate_limits').doc(_id)
    .update({ data: { count: _.inc(1) } })
    .catch(() => { throw new AppError('操作过于频繁，请稍后再试', 'RATE_LIMITED') })
  const doc = await db.collection('rate_limits').doc(_id).get().catch(() => ({ data: null }))
  const count = (doc && doc.data && doc.data.count) || (max + 1)
  if (count > max) throw new AppError('操作过于频繁，请稍后再试', 'RATE_LIMITED')
}

module.exports = { rateLimit }
