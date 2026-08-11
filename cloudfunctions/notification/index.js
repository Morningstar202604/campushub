// cloudfunctions/notification/index.js
// 站内通知：创建/列表/标记已读/全部已读/未读数
// notifications 集合: { userId, type, content, targetId, isRead, createdAt }
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()
  const { action = 'list', page = 1, pageSize = 20 } = event

  const pSize = Math.min(100, Math.max(1, Number(pageSize)))
  const skip = Math.max(0, (Number(page) - 1) * pSize)

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
    await db.collection('notifications').doc(notificationId).update({ data: { isRead: true } })
    return ok({ marked: true })
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

// ---- 工具函数：创建通知（供其他云函数调用） ----
// 用法：在 like/comment/follow 等云函数中 require 此函数
async function createNotification(db, { userId, type, content, targetId }) {
  if (!userId || !content) return
  try {
    await db.collection('notifications').add({
      data: {
        userId,
        type: type || 'system',
        content,
        targetId: targetId || '',
        isRead: false,
        createdAt: new Date()
      }
    })
  } catch (e) {
    // 通知创建失败不影响主流程
    console.error('创建通知失败:', e)
  }
}

module.exports = { createNotification }
