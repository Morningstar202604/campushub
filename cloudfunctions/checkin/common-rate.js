// common-rate.js — 统一频率限制
// 说明：微信云开发无内存级限速，这里用"时间窗内计数"实现。
// 部署前请为被计数集合的 (match字段, createdAt) 建复合索引以保证计数查询高效。
const { getDB } = require('./common-db')
const { AppError } = require('./common-error')

// collection: 计数集合；match: 附加匹配条件（如 { userId }）；
// windowMs: 时间窗；max: 窗口内允许的最大次数。
async function rateLimit({ collection, match = {}, windowMs = 30000, max = 1, now = Date.now() } = {}) {
  if (!collection) return
  const db = getDB()
  const since = new Date(now - windowMs)
  const res = await db.collection(collection)
    .where({ ...match, createdAt: db.command.gt(since) })
    .count()
  if (res.total >= max) {
    throw new AppError('操作过于频繁，请稍后再试', 'RATE_LIMITED')
  }
}

module.exports = { rateLimit }
