// cloudfunctions/notification/index.js
// 站内通知：创建/列表/标记已读/全部已读/未读数
// notifications 集合: { userId, type, content, targetId, isRead, createdAt }
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser } = require('./common-bundle')

function toInt(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const { action = 'list' } = event

  const page = Math.max(1, toInt(event.page, 1))
  const pSize = Math.min(100, Math.max(1, toInt(event.pageSize, 20)))
  const skip = (page - 1) * pSize

  // ---- 列表 ----
  if (action === 'list') {
    const [listRes, unreadRes] = await Promise.all([
      db.collection('notifications')
        .where({ userId: user._id })
        .orderBy('createdAt', 'desc').skip(skip).limit(pSize).get(),
      db.collection('notifications').where({ userId: user._id, isRead: false }).count()
    ])
    return ok({ list: listRes.data || [], unreadCount: unreadRes.total, hasMore: listRes.data.length === pSize })
  }

  // ---- 未读数 ----
  if (action === 'unreadCount') {
    const res = await db.collection('notifications').where({ userId: user._id, isRead: false }).count()
    return ok({ unreadCount: res.total })
  }

  // ---- 标记单条已读 ----
  if (action === 'markRead') {
    const { notificationId } = event
    if (!notificationId) throw new AppError('缺少通知ID', 'INVALID_PARAM')
    // 属主校验：只能标记自己的通知（防 IDOR）
    const r = await db.collection('notifications')
      .where({ _id: notificationId, userId: user._id, isRead: false })
      .update({ data: { isRead: true } })
    const updated = (r && r.stats && r.stats.updated) || 0
    if (!updated) {
      // 不存在、不属于本人或已读 —— 统一幂等返回，不泄露他人数据存在性
      return ok({ marked: false })
    }
    return ok({ marked: true })
  }

  // ---- 下发订阅消息模板 ID（未配置环境变量时返回空，客户端静默跳过） ----
  if (action === 'tmplIds') {
    return ok({
      tmplIds: {
        comment: process.env.TMPL_COMMENT || '',
        like: process.env.TMPL_LIKE || '',
        follow: process.env.TMPL_FOLLOW || ''
      }
    })
  }

  // ---- 全部已读 ----
  if (action === 'markAllRead') {
    const res = await db.collection('notifications')
      .where({ userId: user._id, isRead: false })
      .update({ data: { isRead: true } })
    return ok({ updated: res.stats ? res.stats.updated : 0 })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
