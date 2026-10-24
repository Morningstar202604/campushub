// cloudfunctions/word-manage/index.js
// 敏感词库管理（仅管理员）：list / create / update / delete
//
// 词表分级语义见 common-words.js：block 拒发、replace 替换、flag 进审核队列。
// 词表存 sensitive_words 集合，内核 5 分钟缓存；本入口写操作后立即清缓存。
const {
  getDB,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  checkAdmin,
  VALID_ACTIONS,
  invalidateWordCache
} = require('./common-bundle')

function normalizeAction(v) {
  return VALID_ACTIONS.includes(v) ? v : 'block'
}

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const isAdmin = await checkAdmin(db, user.openid)
  if (!isAdmin) throw new AppError('无权限执行该操作', 'FORBIDDEN')

  const { action = 'list' } = event

  if (action === 'list') {
    const page = Math.max(1, Number(event.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(event.pageSize) || 30))
    const res = await db
      .collection('sensitive_words')
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    const total = await db.collection('sensitive_words').count()
    return ok({ list: res.data || [], total: total.total, page, pageSize })
  }

  if (action === 'create') {
    const word = String(event.word || '')
      .trim()
      .slice(0, 50)
    if (!word) throw new AppError('请输入敏感词', 'INVALID_PARAM')
    const dup = await db.collection('sensitive_words').where({ word }).count()
    if (dup.total > 0) throw new AppError('该词已存在', 'ALREADY')
    const addRes = await db.collection('sensitive_words').add({
      data: {
        word,
        action: normalizeAction(event.wordAction),
        replacement: String(event.replacement || '').slice(0, 20),
        status: 'active',
        createdBy: user._id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    invalidateWordCache()
    return ok({ wordId: addRes._id })
  }

  if (action === 'update') {
    const { wordId } = event
    if (!wordId) throw new AppError('缺少词条ID', 'INVALID_PARAM')
    const patch = { updatedAt: new Date() }
    if (event.word !== undefined) {
      const word = String(event.word || '')
        .trim()
        .slice(0, 50)
      if (!word) throw new AppError('请输入敏感词', 'INVALID_PARAM')
      patch.word = word
    }
    if (event.wordAction !== undefined) patch.action = normalizeAction(event.wordAction)
    if (event.replacement !== undefined)
      patch.replacement = String(event.replacement || '').slice(0, 20)
    if (event.status !== undefined) patch.status = event.status === 'active' ? 'active' : 'inactive'
    const r = await db.collection('sensitive_words').doc(wordId).update({ data: patch })
    if (!r.stats || !r.stats.updated) throw new AppError('词条不存在', 'NOT_FOUND')
    invalidateWordCache()
    return ok({ updated: true })
  }

  if (action === 'delete') {
    const { wordId } = event
    if (!wordId) throw new AppError('缺少词条ID', 'INVALID_PARAM')
    await db.collection('sensitive_words').doc(wordId).remove()
    invalidateWordCache()
    return ok({ deleted: true })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
