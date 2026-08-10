// cloudfunctions/post-list/index.js
const { getDB, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { tab = 'recommend', page = 1, pageSize = 20, schoolId = 'HSFNC' } = event

  const where = { status: 'normal', schoolId }
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
