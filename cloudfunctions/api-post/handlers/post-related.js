// cloudfunctions/post-related/index.js
// 相关帖子推荐：同分类 + 近 30 天 + 按点赞/时间排序，排除当前帖。
//
// 为什么不用向量检索：CloudBase 无向量能力，引入外部服务违背「一校一署近零成本」定位。
// 同分类 + 热度的启发式在校园体量（万级内容）下点击率足够，且查询完全走既有索引前缀。
const { getDB, getCmd, AppError, ok, wrap } = require('./common-bundle')

const LIMIT = 5
const WINDOW_DAYS = 30

module.exports = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { postId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  const curRes = await db
    .collection('posts')
    .doc(postId)
    .field({ _id: true, categoryId: true, tags: true, status: true })
    .get()
    .catch(() => ({ data: null }))
  const cur = curRes && curRes.data
  if (!cur) throw new AppError('帖子不存在', 'NOT_FOUND')

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000)
  const where = {
    status: 'normal',
    createdAt: _.gt(since),
    _id: _.neq(postId)
  }
  if (cur.categoryId) where.categoryId = cur.categoryId

  let res = await db
    .collection('posts')
    .where(where)
    .orderBy('likeCount', 'desc')
    .orderBy('createdAt', 'desc')
    .limit(LIMIT)
    .field({
      title: true,
      content: true,
      images: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      kind: true
    })
    .get()

  // 同分类内容不足时回退到全站热帖（仍排除当前帖），保证详情页不出现空区块
  if ((res.data || []).length < LIMIT) {
    const fill = await db
      .collection('posts')
      .where({ status: 'normal', createdAt: _.gt(since), _id: _.neq(postId) })
      .orderBy('likeCount', 'desc')
      .limit(LIMIT)
      .field({
        title: true,
        content: true,
        images: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        kind: true
      })
      .get()
    const seen = new Set((res.data || []).map((p) => p._id))
    const merged = [...(res.data || [])]
    for (const p of fill.data || []) {
      if (merged.length >= LIMIT) break
      if (seen.has(p._id)) continue
      merged.push(p)
    }
    res = { data: merged }
  }

  const list = (res.data || []).map((p) => ({
    _id: p._id,
    title: p.title || '',
    content: String(p.content || '').slice(0, 60),
    image: (Array.isArray(p.images) && p.images[0]) || '',
    likeCount: p.likeCount || 0,
    commentCount: p.commentCount || 0,
    createdAt: p.createdAt,
    kind: p.kind || 'post'
  }))
  return ok({ list })
})
