// cloudfunctions/message/index.js
// 站内私信：发送 / 会话列表 / 会话详情 / 标记已读 / 未读数
// messages 集合: { conversationId, fromUserId, toUserId, content, isRead, createdAt }
//
// 会话 id 用双方 userId 的排序拼接（conversationIdOf）：同一对用户只有一个会话，
// 收发双方都能用自己的 id 推出同一个 key，不需要额外一张会话表。
//
// 与拉黑的联动（block，v0.11.0）：发送前双向检查——
//   我拉黑了对方 → 本地拒绝（用户自己可解）；
//   对方拉黑了我 → 拒收（不解释具体原因，避免"被拉黑"成为可探知状态）。
//   拉黑的意义就是"不想再有接触"，私信是接触面，必须闭环。
//
// 安全：内容过 msgSecCheck（fail-closed，与评论一致）+ 限频；已读标记按属主过滤（防 IDOR）。
const {
  getDB,
  getCmd,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  rateLimit,
  checkContents,
  pageParams
} = require('./common-bundle')

const CONTENT_MAX = 500
// 会话列表的合并窗口：收发各取最近 50 条，合并去重后足以覆盖一屏；
// 超出部分随分页自然截断（total 为窗口内去重数，非全量）。
const RECENT_WINDOW = 50

/** 双方用户 → 唯一会话 id（排序拼接，与谁先发无关） */
function conversationIdOf(a, b) {
  return [a, b].sort().join('__')
}

/** 发送前置校验：目标存在、不是自己、双方都没拉黑；返回目标用户文档 */
async function assertCanMessage(db, me, toUserId) {
  if (!toUserId) throw new AppError('缺少接收人ID', 'INVALID_PARAM')
  if (toUserId === me._id) throw new AppError('不能给自己发私信', 'INVALID_PARAM')

  const targetRes = await db
    .collection('users')
    .doc(toUserId)
    .field({ _id: true })
    .get()
    .catch(() => ({ data: null }))
  if (!targetRes || !targetRes.data) throw new AppError('用户不存在', 'NOT_FOUND')

  // 双向拉黑检查（一次查询带出方向）
  const _ = getCmd()
  const blockRes = await db
    .collection('blocks')
    .where(
      _.or([
        { blockerId: me._id, blockedId: toUserId },
        { blockerId: toUserId, blockedId: me._id }
      ])
    )
    .field({ blockerId: true })
    .limit(2)
    .get()
  if ((blockRes.data || []).length) {
    const mine = blockRes.data.some((b) => b.blockerId === me._id)
    throw new AppError(
      mine ? '你已拉黑对方，解除后才能发送' : '对方已拒收你的消息',
      mine ? 'BLOCKED_BY_ME' : 'MESSAGE_BLOCKED'
    )
  }
  return targetRes.data
}

/** 发送：审核 → 落库 → 给接收人写一条站内通知（best-effort，失败不影响发送） */
async function sendMessage(db, me, toUserId, content) {
  const text = String(content || '').trim()
  if (!text) throw new AppError('请输入私信内容', 'INVALID_PARAM')
  if (text.length > CONTENT_MAX) throw new AppError(`私信不能超过${CONTENT_MAX}字`, 'INVALID_PARAM')

  await checkContents([text], { openid: me.openid, scene: 2 })

  const conversationId = conversationIdOf(me._id, toUserId)
  const now = new Date()
  const addRes = await db.collection('messages').add({
    data: {
      conversationId,
      fromUserId: me._id,
      toUserId,
      content: text,
      isRead: false,
      createdAt: now
    }
  })

  try {
    await db.collection('notifications').add({
      data: {
        userId: toUserId,
        type: 'message',
        targetType: 'user',
        content: `${me.nickname} 给你发了一条私信`,
        targetId: me._id,
        isRead: false,
        createdAt: now
      }
    })
  } catch (e) {
    console.warn('[message] 私信通知写入失败:', e && (e.errMsg || e.message))
  }

  return { messageId: addRes && addRes._id, createdAt: now }
}

/** 会话列表：收发两侧各取最近 N 条，合并按时间去重，回填对方资料与未读数 */
async function listConversations(db, me, page, pSize) {
  const _ = getCmd()
  const skip = Math.max(0, (page - 1) * pSize)
  const [sent, received] = await Promise.all([
    db
      .collection('messages')
      .where({ fromUserId: me._id })
      .orderBy('createdAt', 'desc')
      .limit(RECENT_WINDOW)
      .get(),
    db
      .collection('messages')
      .where({ toUserId: me._id })
      .orderBy('createdAt', 'desc')
      .limit(RECENT_WINDOW)
      .get()
  ])

  const merged = [...(sent.data || []), ...(received.data || [])].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
  )
  // 同一毫秒内的连发会并列：预览取合并顺序里的第一条（收发两侧各自已是倒序），
  // 属于可接受的边缘态——不影响未读数与线程内容（thread 按 createdAt 正序全量返回）。
  const seen = new Set()
  const latest = []
  for (const m of merged) {
    if (seen.has(m.conversationId)) continue
    seen.add(m.conversationId)
    latest.push(m)
  }

  const items = latest.slice(skip, skip + pSize)
  const otherIds = [
    ...new Set(items.map((m) => (m.fromUserId === me._id ? m.toUserId : m.fromUserId)))
  ]
  let userMap = new Map()
  if (otherIds.length) {
    const userRes = await db
      .collection('users')
      .where({ _id: _.in(otherIds) })
      .field({ _id: true, nickname: true, avatar: true, school: true })
      .get()
    for (const u of userRes.data || []) userMap.set(u._id, u)
  }

  // 未读数：一次查本页所有会话的未收件（limit 100 覆盖一屏 20 个会话的未读总量）
  const convIds = items.map((m) => m.conversationId)
  const unreadMap = new Map()
  if (convIds.length) {
    const unreadRes = await db
      .collection('messages')
      .where({ toUserId: me._id, isRead: false, conversationId: _.in(convIds) })
      .field({ conversationId: true })
      .limit(100)
      .get()
    for (const m of unreadRes.data || []) {
      unreadMap.set(m.conversationId, (unreadMap.get(m.conversationId) || 0) + 1)
    }
  }

  const list = items.map((m) => {
    const otherId = m.fromUserId === me._id ? m.toUserId : m.fromUserId
    const u = userMap.get(otherId) || {}
    return {
      conversationId: m.conversationId,
      user: {
        _id: otherId,
        nickname: u.nickname || '同学',
        avatar: u.avatar || '',
        school: u.school || ''
      },
      lastMessage: {
        content: m.content,
        isMine: m.fromUserId === me._id,
        createdAt: m.createdAt
      },
      unread: unreadMap.get(m.conversationId) || 0
    }
  })

  return { list, total: latest.length, hasMore: latest.length > skip + items.length }
}

/** 会话详情：按时间正序（聊天流），isMine 让前端决定气泡站左还是右 */
async function listThread(db, me, withUserId, page, pSize) {
  if (!withUserId) throw new AppError('缺少对方用户ID', 'INVALID_PARAM')
  const skip = Math.max(0, (page - 1) * pSize)
  const conversationId = conversationIdOf(me._id, withUserId)
  const res = await db
    .collection('messages')
    .where({ conversationId })
    .orderBy('createdAt', 'asc')
    .skip(skip)
    .limit(pSize)
    .get()
  const list = (res.data || []).map((m) => ({ ...m, isMine: m.fromUserId === me._id }))
  return { list, hasMore: list.length === pSize }
}

/** 标记会话已读：只更新「发给我的」未读消息（属主过滤，防 IDOR） */
async function markThreadRead(db, me, withUserId) {
  if (!withUserId) throw new AppError('缺少对方用户ID', 'INVALID_PARAM')
  const conversationId = conversationIdOf(me._id, withUserId)
  const r = await db
    .collection('messages')
    .where({ conversationId, toUserId: me._id, isRead: false })
    .update({ data: { isRead: true } })
  const updated = (r && r.stats && r.stats.updated) || 0
  return { updated }
}

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const { action = 'conversations' } = event

  const { page, pageSize: pSize } = pageParams(event, { defaultSize: 20, maxSize: 100 })

  if (action === 'send') {
    // 限频先于一切：审核配额有限且 fail-closed，先审后限等于允许脚本耗尽配额（同 v0.9.4 修订）
    await rateLimit({
      collection: 'messages',
      match: { fromUserId: user._id },
      windowMs: 10000,
      max: 10
    })
    await assertCanMessage(db, user, event.toUserId)
    const sent = await sendMessage(db, user, event.toUserId, event.content)
    return ok({ sent: true, ...sent })
  }

  if (action === 'conversations') {
    const r = await listConversations(db, user, page, pSize)
    return ok(r)
  }

  if (action === 'thread') {
    const r = await listThread(db, user, event.withUserId, page, pSize)
    return ok(r)
  }

  if (action === 'read') {
    const r = await markThreadRead(db, user, event.withUserId)
    return ok({ read: true, ...r })
  }

  if (action === 'unreadCount') {
    const res = await db.collection('messages').where({ toUserId: user._id, isRead: false }).count()
    return ok({ unreadCount: res.total })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
