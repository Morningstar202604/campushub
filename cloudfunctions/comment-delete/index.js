// cloudfunctions/comment-delete/index.js
// 删除评论：统一经 removeContent（软删除 + 归属校验/管理员 + 目标评论数回退）
// 级联：删除主楼层时一并软删其全部子回复，并按实际条数补回退目标 commentCount，
// 避免"楼层删了、楼中楼变隐形孤儿但计数还在"的漂移。
const { getDB, getCmd, AppError, ok, wrap, getCurrentUser, requireActive, removeContent } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await getCurrentUser()
  requireActive(user)
  const db = getDB()
  const _ = getCmd()
  const { commentId } = event
  if (!commentId) throw new AppError('缺少评论ID', 'INVALID_PARAM')

  // 先取文档判断是否主楼层（removeContent 成功后原文档状态已变更）
  const docRes = await db.collection('comments').doc(commentId).get().catch(() => ({ data: null }))
  const doc = docRes && docRes.data
  if (!doc) throw new AppError('评论不存在', 'NOT_FOUND')

  const r = await removeContent({ collection: 'comments', docId: commentId, actor: user, opts: { targetComment: true } })
  if (r.alreadyDeleted) return ok({ deleted: true })

  // 主楼层级联软删子回复（条件更新原子占位，重复调用安全）
  if (!doc.parentId) {
    const claim = await db.collection('comments')
      .where({ parentId: commentId, status: _.neq('deleted') })
      .update({ data: { status: 'deleted', updatedAt: new Date() } })
    const cascaded = (claim && claim.stats && claim.stats.updated) || 0
    if (cascaded > 0 && doc.targetType && doc.targetId) {
      const tcol = doc.targetType === 'post' ? 'posts' : 'products'
      // 楼层本身的 -1 已由 removeContent 回退；此处补上 N 条子回复
      await db.collection(tcol).doc(doc.targetId)
        .update({ data: { commentCount: _.inc(-cascaded) } }).catch(() => {})
    }
  }

  return ok({ deleted: true })
})
