// cloudfunctions/my-list/index.js
// 我的内容：登录 + 仅本人数据；软删除(status='deleted')不展示
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  const db = getDB()
  const _ = getCmd()

  const { type = 'posts', page = 1, pageSize = 20 } = event
  const userId = user._id
  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const size = Math.min(100, Math.max(1, Number(pageSize)))

  if (type === 'posts' || type === 'products') {
    const collection = type === 'posts' ? 'posts' : 'products'
    const res = await db.collection(collection)
      .where({ userId, status: _.neq('deleted') })
      .orderBy('createdAt', 'desc').skip(skip).limit(size).get()
    return ok({ list: res.data, hasMore: res.data.length === size })
  }

  if (type === 'collects') {
    const collectRes = await db.collection('collects')
      .where({ userId }).orderBy('createdAt', 'desc').skip(skip).limit(size).get()
    if (collectRes.data.length === 0) return ok({ list: [], hasMore: false })

    const postIds = collectRes.data.filter(c => c.type === 'post').map(c => c.targetId)
    const productIds = collectRes.data.filter(c => c.type === 'product').map(c => c.targetId)

    let posts = [], products = []
    if (postIds.length) {
      const r = await db.collection('posts').where({ _id: _.in(postIds), status: _.neq('deleted') }).get()
      posts = r.data
    }
    if (productIds.length) {
      const r = await db.collection('products').where({ _id: _.in(productIds), status: _.neq('deleted') }).get()
      products = r.data
    }

    // 按收藏时间归一排序（旧实现帖子在前商品在后，与用户时间线预期不符）；
    // 已删除/下架的收藏目标被过滤后自然消失
    const orderMap = {}
    collectRes.data.forEach((c, i) => { orderMap[c.targetId] = i })
    const merged = [...posts, ...products].sort(
      (a, b) => (orderMap[a._id] ?? 0) - (orderMap[b._id] ?? 0)
    )
    return ok({ list: merged, hasMore: collectRes.data.length === size })
  }

  throw new AppError('未知类型', 'INVALID_PARAM')
})
