// cloudfunctions/announcement/index.js
// 公告系统（P1 运营刚需）
//  - list    ：全员可读，返回启用中的公告（置顶优先，最多 5 条）
//  - list-all：管理员查看全部
//  - create  ：管理员发布公告（标题/内容/置顶）
//  - toggle  ：管理员上/下线
//  - delete  ：管理员删除
const { getDB, AppError, ok, wrap, getOpenid, checkAdmin } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const { action = 'list' } = event

  if (action === 'list') {
    const res = await db.collection('announcements')
      .where({ status: 'active' })
      .orderBy('isPinned', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
    return ok({ list: res.data || [] })
  }

  // ==== 以下均为管理员操作 ====
  const openid = await getOpenid()
  if (!(await checkAdmin(db, openid))) throw new AppError('无权限', 'FORBIDDEN')

  if (action === 'list-all') {
    const res = await db.collection('announcements')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    return ok({ list: res.data || [] })
  }

  if (action === 'create') {
    const title = String(event.title || '').trim()
    const content = String(event.content || '').trim()
    if (!title || !content) throw new AppError('标题和内容不能为空', 'INVALID_PARAM')
    if (title.length > 50) throw new AppError('标题过长', 'INVALID_PARAM')
    if (content.length > 1000) throw new AppError('内容过长', 'INVALID_PARAM')
    const addRes = await db.collection('announcements').add({
      data: {
        title,
        content,
        isPinned: !!event.isPinned,
        status: 'active',
        createdBy: openid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    return ok({ announcementId: addRes._id })
  }

  if (action === 'toggle') {
    const id = String(event.id || '')
    if (!id) throw new AppError('缺少公告ID', 'INVALID_PARAM')
    const cur = await db.collection('announcements').doc(id).get().catch(() => ({ data: null }))
    if (!cur.data) throw new AppError('公告不存在', 'NOT_FOUND')
    const next = cur.data.status === 'active' ? 'inactive' : 'active'
    await db.collection('announcements').doc(id).update({
      data: { status: next, updatedAt: new Date() }
    })
    return ok({ id, status: next })
  }

  if (action === 'delete') {
    const id = String(event.id || '')
    if (!id) throw new AppError('缺少公告ID', 'INVALID_PARAM')
    await db.collection('announcements').doc(id).remove()
    return ok({ deleted: true })
  }

  throw new AppError('未知操作', 'INVALID_ACTION')
})
