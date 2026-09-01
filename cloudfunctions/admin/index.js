// cloudfunctions/admin/index.js
// 管理员操作台：身份校验 + 封禁/解封 + 内容审核(list-reports/delete/resolve)
//
// 管理员识别优先级：
//   ① 云函数环境变量 ADMIN_OPENIDS（逗号分隔）
//   ② 数据库 config 集合 doc('global').adminOpenids 数组
// 部署后请至少在云函数环境变量中配置管理员 openid。
//
// action 一览：
//   check        返回 { isAdmin }（前端据此显示管理入口；非管理员也可调用，仅用于隐藏入口）
//   ban/unban    封禁/解封用户（支持 targetOpenid 或 targetUserId）
//   list-reports 分页列出待处理举报，并 join 目标内容摘要与作者
//   delete       删除指定内容（管理员越权，含云存储图片回收）
//   resolve      将举报标记为已处理（避免重复处理）
const { getDB, getCmd, AppError, ok, wrap, getOpenid, removeContent, checkAdmin, checkContents } = require('./common-bundle')

// 与 search 一致的正则转义，防关键词注入/查询报错
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

exports.main = wrap(async (event) => {
  const db = getDB()
  const operatorOpenid = await getOpenid()

  // 管理员身份识别（不依赖前端传入，云端可信）
  const isAdmin = await checkAdmin(db, operatorOpenid)
  const { action } = event

  // check 不要求必须是管理员，便于前端隐藏入口
  if (action === 'check') {
    return ok({ isAdmin })
  }
  if (!isAdmin) throw new AppError('无权限执行该操作', 'FORBIDDEN')
  const _ = getCmd()

  if (action === 'ban' || action === 'unban') {
    let { targetOpenid, targetUserId } = event
    if (!targetOpenid && targetUserId) {
      const u = await db.collection('users').doc(targetUserId).get().catch(() => ({ data: null }))
      if (!u || !u.data) throw new AppError('目标用户不存在', 'NOT_FOUND')
      targetOpenid = u.data.openid
    }
    if (!targetOpenid) throw new AppError('缺少目标用户', 'INVALID_PARAM')

    const status = action === 'ban' ? 'banned' : 'unverified'
    const res = await db.collection('users').where({ openid: targetOpenid }).update({
      data: { verifyStatus: status, updatedAt: new Date() }
    })
    await logAdmin(db, operatorOpenid, action, { targetOpenid })
    return ok({ action, targetOpenid, updated: res.stats ? res.stats.updated : undefined })
  }

  if (action === 'list-reports') {
    const { page = 1, pageSize = 20 } = event
    const pSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
    const skip = Math.max(0, (Number(page) - 1) * pSize)
    const [listRes, totalRes] = await Promise.all([
      db.collection('reports').where({ status: 'pending' }).orderBy('createdAt', 'desc').skip(skip).limit(pSize).get(),
      db.collection('reports').where({ status: 'pending' }).count()
    ])
    const items = await Promise.all((listRes.data || []).map(async (r) => ({
      reportId: r._id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      description: r.description,
      createdAt: r.createdAt,
      target: await getTargetSummary(db, r.targetType, r.targetId)
    })))
    return ok({ list: items, total: totalRes.total, page, pageSize: pSize })
  }

  if (action === 'delete') {
    const { targetType, targetId } = event
    if (!targetId || !targetType) throw new AppError('缺少目标', 'INVALID_PARAM')
    const map = {
      post: { col: 'posts', userCountField: 'postCount' },
      product: { col: 'products', userCountField: 'productCount' },
      comment: { col: 'comments', targetComment: true }
    }
    const cfg = map[targetType]
    if (!cfg) throw new AppError('未知内容类型', 'INVALID_PARAM')

    await removeContent({
      collection: cfg.col,
      docId: targetId,
      // 内核按 openid 维度判定管理员（checkAdmin），必须传 openid，否则恒判 FORBIDDEN
      actor: { _id: '__admin__', openid: operatorOpenid },
      opts: { userCountField: cfg.userCountField, targetComment: cfg.targetComment }
    })
    await logAdmin(db, operatorOpenid, 'delete', { targetType, targetId })
    return ok({ deleted: true })
  }

  if (action === 'resolve') {
    const { reportId } = event
    if (!reportId) throw new AppError('缺少举报ID', 'INVALID_PARAM')
    const updateRes = await db.collection('reports').doc(reportId).update({
      data: { status: 'resolved', resolvedAt: new Date() }
    })
    const updated = updateRes.stats ? updateRes.stats.updated : 0
    if (updated === 0) throw new AppError('举报不存在或已处理', 'NOT_FOUND')
    await logAdmin(db, operatorOpenid, 'resolve', { reportId })
    return ok({ resolved: true })
  }

  // ---- 置顶/取消置顶 ----
  if (action === 'pin' || action === 'unpin') {
    const { postId } = event
    if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')
    const updateRes = await db.collection('posts').doc(postId).update({
      data: { isPinned: action === 'pin', updatedAt: new Date() }
    }).catch(() => ({ stats: { updated: 0 } }))
    if (updateRes.stats && updateRes.stats.updated === 0) throw new AppError('帖子不存在', 'NOT_FOUND')
    await logAdmin(db, operatorOpenid, action, { postId })
    return ok({ action, postId, isPinned: action === 'pin' })
  }

  // ---- 加精/取消加精 ----
  if (action === 'essence' || action === 'unessence') {
    const { postId } = event
    if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')
    const updateRes = await db.collection('posts').doc(postId).update({
      data: { isEssence: action === 'essence', updatedAt: new Date() }
    }).catch(() => ({ stats: { updated: 0 } }))
    if (updateRes.stats && updateRes.stats.updated === 0) throw new AppError('帖子不存在', 'NOT_FOUND')
    await logAdmin(db, operatorOpenid, action, { postId })
    return ok({ action, postId, isEssence: action === 'essence' })
  }

  // ---- 用户列表（分页 + 搜索） ----
  if (action === 'list-users') {
    const { keyword, page = 1, pageSize = 20 } = event
    const pSize = Math.min(100, Math.max(1, Number(pageSize)))
    const skip = Math.max(0, (Number(page) - 1) * pSize)
    const where = {}
    if (keyword && String(keyword).trim()) {
      where.nickname = db.RegExp({ regexp: escapeRegExp(String(keyword).trim().slice(0, 20)), options: 'i' })
    }
    const [listRes, totalRes] = await Promise.all([
      db.collection('users').where(where).orderBy('createdAt', 'desc').skip(skip).limit(pSize)
        .field({ _id: true, nickname: true, avatar: true, school: true, verifyStatus: true, postCount: true, productCount: true, createdAt: true })
        .get(),
      db.collection('users').where(where).count()
    ])
    return ok({ list: listRes.data || [], total: totalRes.total, page, pageSize: pSize })
  }

  // ---- 反馈列表 ----
  if (action === 'list-feedbacks') {
    const { page = 1, pageSize = 20 } = event
    const pSize = Math.min(100, Math.max(1, Number(pageSize)))
    const skip = Math.max(0, (Number(page) - 1) * pSize)
    const [listRes, totalRes] = await Promise.all([
      db.collection('feedbacks').orderBy('createdAt', 'desc').skip(skip).limit(pSize).get(),
      db.collection('feedbacks').count()
    ])
    return ok({ list: listRes.data || [], total: totalRes.total, page, pageSize: pSize })
  }

  // ---- 更新反馈状态 ----
  if (action === 'resolve-feedback') {
    const { feedbackId, reply } = event
    if (!feedbackId) throw new AppError('缺少反馈ID', 'INVALID_PARAM')
    // 管理回复会展示给用户：限长 + 过内容安全（与其他面向用户的文本一致）
    const safeReply = String(reply || '').trim().slice(0, 500)
    if (safeReply) {
      await checkContents([safeReply], { openid: operatorOpenid, scene: 2 })
    }
    await db.collection('feedbacks').doc(feedbackId).update({
      data: { status: 'resolved', adminReply: safeReply, resolvedAt: new Date() }
    })
    await logAdmin(db, operatorOpenid, 'resolve-feedback', { feedbackId })
    return ok({ resolved: true })
  }

  // ---- 校园认证：待审列表（status=all 查全部） ----
  if (action === 'list-verifies') {
    const vPage = Math.max(1, Number(event.page) || 1)
    const vSize = Math.min(100, Math.max(1, Number(event.pageSize) || 20))
    const vStatus = event.status === 'all' ? undefined : (event.status || 'pending')
    const vWhere = vStatus ? { status: vStatus } : {}
    const [listRes, totalRes] = await Promise.all([
      db.collection('verify_requests').where(vWhere)
        .orderBy('createdAt', 'asc').skip((vPage - 1) * vSize).limit(vSize).get(),
      db.collection('verify_requests').where(vWhere).count()
    ])
    return ok({ list: listRes.data || [], total: totalRes.total })
  }

  // ---- 校园认证：审核通过/驳回（原子占位，防双击重复审批） ----
  if (action === 'verify-review') {
    const { requestId, approve, reason } = event
    if (!requestId) throw new AppError('缺少申请ID', 'INVALID_PARAM')
    const reqRes = await db.collection('verify_requests').doc(requestId).get().catch(() => ({ data: null }))
    const reqDoc = reqRes && reqRes.data
    if (!reqDoc) throw new AppError('申请不存在', 'NOT_FOUND')

    const claim = await db.collection('verify_requests')
      .where({ _id: requestId, status: 'pending' })
      .update({
        data: {
          status: approve ? 'approved' : 'rejected',
          rejectReason: approve ? '' : String(reason || '资料不符合要求').slice(0, 100),
          reviewedBy: operatorOpenid,
          reviewedAt: new Date()
        }
      })
    if (!claim || !claim.stats || !claim.stats.updated) {
      return ok({ reviewed: false, already: true })
    }

    await db.collection('users').doc(reqDoc.userId).update({
      data: {
        campusVerified: !!approve,
        campusVerifyStatus: approve ? 'approved' : 'rejected'
      }
    }).catch(() => {})
    await logAdmin(db, operatorOpenid, 'verify-review', { requestId, approve: !!approve })
    return ok({ reviewed: true })
  }
  // ---- 审计日志查询 ----
  if (action === 'list-logs') {
    const { page = 1, pageSize = 30 } = event
    const pSize = Math.min(100, Math.max(1, Number(pageSize)))
    const skip = Math.max(0, (Number(page) - 1) * pSize)
    const [listRes, totalRes] = await Promise.all([
      db.collection('admin_logs').orderBy('createdAt', 'desc').skip(skip).limit(pSize).get(),
      db.collection('admin_logs').count()
    ])
    return ok({ list: listRes.data || [], total: totalRes.total, page, pageSize: pSize })
  }
  throw new AppError('未知操作', 'INVALID_PARAM')
})

// 审计日志：所有敏感管理操作留痕，便于追责与合规调取
// 写入失败不阻断主流程（避免审计拖垮正常操作）
async function logAdmin(db, operatorOpenid, action, detail) {
  try {
    await db.collection('admin_logs').add({
      data: { action, operator: operatorOpenid, detail: detail || {}, createdAt: new Date() }
    })
  } catch (e) { /* 静默 */ }
}

// 取被举报内容摘要（用于审核台展示）
async function getTargetSummary(db, type, id) {
  const col = type === 'post' ? 'posts' : type === 'product' ? 'products' : 'comments'
  const r = await db.collection(col).doc(id).get().catch(() => ({ data: null }))
  if (!r || !r.data) return { notFound: true }
  const d = r.data
  const raw = d.title || d.content || ''
  return {
    ownerId: d.userId,
    ownerNickname: d.userNickname || '',
    snippet: String(raw).slice(0, 80)
  }
}
