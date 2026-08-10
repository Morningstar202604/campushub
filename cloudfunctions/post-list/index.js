// cloudfunctions/post-list/index.js
// 帖子列表：支持按分类(categoryPath 包含筛选) 与 状态(status) 过滤
// 不再强制 schoolId —— 全国内容默认不过滤校区；可选传入 schoolId 仅看某校区
const { getDB, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { tab = 'recommend', page = 1, pageSize = 20, categoryId, schoolId, status = 'normal' } = event

  // 基础过滤：状态（首页只推 normal；过期页传 status='expired'）
  const where = { status }
  if (schoolId) where.schoolId = schoolId
  // 分类筛选：categoryPath 为数组，直接按元素包含匹配（前端传所选节点 id）
  if (categoryId) where.categoryPath = categoryId

  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  let res
  if (tab === 'latest') {
    res = await db.collection('posts')
      .where(where).orderBy('createdAt', 'desc').skip(skip).limit(size).get()
  } else {
    // 推荐：置顶优先 + 时间倒序（需为 isPinned, createdAt 建复合索引，见 docs/DATABASE_INDEXES.md）
    res = await db.collection('posts')
      .where(where).orderBy('isPinned', 'desc').orderBy('createdAt', 'desc').skip(skip).limit(size).get()
  }
  return ok({ list: res.data, hasMore: res.data.length === size })
})
