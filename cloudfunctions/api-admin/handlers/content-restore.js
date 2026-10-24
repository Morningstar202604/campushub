// cloudfunctions/content-restore/index.js
// 内容回收站：管理员列出已软删内容并恢复（仅管理员）。
//
// 为什么不做用户自助恢复：删除是用户主动动作，普通用户可回收会让「删除」失去确定性；
// 管理员恢复用于误删申诉、举报误判纠正。
//
// 恢复语义：status 回到 normal（帖子/商品）/ 评论回到 normal；计数按需回补。
// 计数一律「回补一次」并带幂等保护：恢复前先原子占位（deleted -> normal），
// 只有占位成功的请求才补计数，重复恢复不会重复 +1。
const {
  getDB,
  getCmd,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  checkAdmin,
  pageParams
} = require('./common-bundle')

const VALID_TYPES = {
  post: { col: 'posts', userCountField: 'postCount' },
  product: { col: 'products', userCountField: 'productCount' },
  comment: { col: 'comments', userCountField: null }
}

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()
  const isAdmin = await checkAdmin(db, user.openid)
  if (!isAdmin) throw new AppError('无权限执行该操作', 'FORBIDDEN')

  const { action = 'list' } = event

  if (action === 'list') {
    const { pageSize, skip } = pageParams(event, { defaultSize: 20, maxSize: 50 })
    const type = event.type || 'post'
    const cfg = VALID_TYPES[type]
    if (!cfg) throw new AppError('未知内容类型', 'INVALID_PARAM')
    const where = { status: 'deleted' }
    const [res, total] = await Promise.all([
      db
        .collection(cfg.col)
        .where(where)
        .orderBy('updatedAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get(),
      db.collection(cfg.col).where(where).count()
    ])
    return ok({ list: res.data || [], total: total.total, pageSize })
  }

  if (action === 'restore') {
    const { targetType, targetId } = event
    const cfg = VALID_TYPES[targetType]
    if (!cfg) throw new AppError('未知内容类型', 'INVALID_PARAM')
    if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')

    const docRes = await db
      .collection(cfg.col)
      .doc(targetId)
      .get()
      .catch(() => ({ data: null }))
    const doc = docRes && docRes.data
    if (!doc) throw new AppError('内容不存在', 'NOT_FOUND')
    if (doc.status !== 'deleted') return ok({ restored: false, already: true })

    // 原子占位：只有真正从 deleted 翻回 normal 的请求才回补计数
    const claim = await db
      .collection(cfg.col)
      .where({ _id: targetId, status: 'deleted' })
      .update({ data: { status: 'normal', updatedAt: new Date() } })
    if (!claim || !claim.stats || !claim.stats.updated) {
      return ok({ restored: false, already: true })
    }

    if (cfg.userCountField && doc.userId) {
      await db
        .collection('users')
        .doc(doc.userId)
        .update({ data: { [cfg.userCountField]: _.inc(1) } })
        .catch((e) =>
          console.error('[content-restore] 计数回补失败，需对账:', doc.userId, e && e.message)
        )
    }

    // 评论恢复：目标内容的 commentCount 补回
    if (targetType === 'comment' && doc.targetType && doc.targetId) {
      const tcol = doc.targetType === 'post' ? 'posts' : 'products'
      await db
        .collection(tcol)
        .doc(doc.targetId)
        .update({ data: { commentCount: _.inc(1) } })
        .catch(() => {})
    }

    await db.collection('admin_logs').add({
      data: {
        action: 'restore',
        operator: user.openid,
        detail: { targetType, targetId },
        createdAt: new Date()
      }
    })

    return ok({ restored: true })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
