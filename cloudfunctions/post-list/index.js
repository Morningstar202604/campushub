// cloudfunctions/post-list/index.js
// 帖子列表：支持按分类(categoryPath 包含筛选) 与 状态(status) 过滤
// 不再强制 schoolId —— 全国内容默认不过滤校区；可选传入 schoolId 仅看某校区
// 降本 C3（惰性过期）：normal 流在读侧排除「已过时未解决的任务帖」，
// 即使 task-expire cron 尚未执行，过期任务也不会出现在信息流；
// cron 降频为每 6 小时兜底归档（config.json）。
const { getDB, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = db.command
  const { tab = 'recommend', page = 1, pageSize = 20, categoryId, schoolId, status = 'normal', kind, cursor } = event
  // 游标分页（深翻页优化）：latest 流支持传上一页最后一条 createdAt，用索引定位而非 skip
  const cursorDate = cursor ? new Date(String(cursor)) : null
  const useCursor = !!(cursorDate && !isNaN(cursorDate.getTime()) && tab === 'latest')

  // 状态白名单 — 仅允许 normal 与 expired，防止客户端枚举已删帖
  const ALLOWED_STATUS = ['normal', 'expired']
  const safeStatus = ALLOWED_STATUS.includes(status) ? status : 'normal'

  // 基础过滤：状态（首页只推 normal；过期页传 status='expired'）
  let where = { status: safeStatus }
  if (schoolId) where.schoolId = schoolId
  // kind 筛选（表白墙/失物/招领专属列表页用）
  const VALID_KINDS = ['post', 'task', 'lost', 'found', 'confession']
  if (kind && VALID_KINDS.includes(kind)) where.kind = kind
  // 分类筛选：categoryPath 为数组，直接按元素包含匹配（前端传所选节点 id）
  if (categoryId) where.categoryPath = categoryId

  // 惰性过期：仅作用于 normal 流。语义与 task-expire cron 一致：
  // 任务帖(kind=task)一旦 expireAt 过去且未 resolved 就不再展示。
  if (safeStatus === 'normal') {
    const now = new Date()
    where = _.and([
      where,
      _.or([
        { kind: _.neq('task') },
        { resolved: true },
        { expireAt: _.gt(now) }
      ])
    ])
  }

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  let res
  if (tab === 'hot') {
    // 热榜：近 7 天按点赞数排序（需 idx_posts_status_likes 索引）
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    res = await db.collection('posts')
      .where(_.and([where, { createdAt: _.gt(since) }]))
      .orderBy('likeCount', 'desc').orderBy('createdAt', 'desc')
      .skip(skip).limit(size).get()
  } else if (tab === 'latest') {
    const q = useCursor ? _.and([where, { createdAt: _.lt(cursorDate) }]) : where
    res = await db.collection('posts')
      .where(q).orderBy('createdAt', 'desc').skip(useCursor ? 0 : skip).limit(size).get()
  } else {
    // 推荐：置顶优先 + 时间倒序（需为 isPinned, createdAt 建复合索引，定义见 docs/INDEXES.md 与 common-indexes.js）
    res = await db.collection('posts')
      .where(where).orderBy('isPinned', 'desc').orderBy('createdAt', 'desc').skip(skip).limit(size).get()
  }
  return ok({ list: res.data, hasMore: res.data.length === size })
})
