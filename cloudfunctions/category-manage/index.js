// cloudfunctions/category-manage/index.js
// 内容分类的运营管理（仅管理员）：
//   create  新增分类节点（自动按父节点计算 level，限制 ≤ 3 级，继承父级 schoolId）
//   update  修改分类（改名/emoji/kind/schoolId/order，改父级时防环）
//   delete  删除分类（有子分类则拒绝；采用软删 status='deleted'，保留历史帖子引用）
//
// 设计要点：
//   - 真实权限在云端校验（requireActiveUser + checkAdmin），前端仅做入口隐藏。
//   - 软删除而非硬删：已发帖的 categoryPath 仍含该 _id，分类筛选不受影响。
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkAdmin } = require('./common-bundle')

const MAX_LEVEL = 3
const KINDS = ['zone', 'forum', 'board']

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const { action } = event

  // 仅管理员可管理分类
  const isAdmin = await checkAdmin(db, user.openid)
  if (!isAdmin) throw new AppError('无权限执行该操作', 'FORBIDDEN')

  if (action === 'create') return await createNode(db, event)
  if (action === 'update') return await updateNode(db, event)
  if (action === 'delete') return await deleteNode(db, event)
  throw new AppError('未知操作', 'INVALID_PARAM')
})

// 根据父节点解析 level 与继承的 schoolId
async function resolveLevel(db, parentId) {
  if (!parentId) return { level: 1, schoolId: null }
  const p = await db.collection('categories').doc(parentId).get().catch(() => ({ data: null }))
  if (!p || !p.data) throw new AppError('父分类不存在', 'NOT_FOUND')
  if (p.data.status !== 'active') throw new AppError('父分类不可用', 'INVALID_PARAM')
  if (p.data.level >= MAX_LEVEL) throw new AppError('分类层级不能超过 ' + MAX_LEVEL + ' 级', 'INVALID_PARAM')
  return { level: p.data.level + 1, schoolId: p.data.schoolId || null }
}

// 收集某节点的全部后代 _id（用于改父级时防环）
async function collectDescendants(db, rootId) {
  const _ = getCmd()
  const result = []
  let frontier = [rootId]
  while (frontier.length) {
    const res = await db.collection('categories')
      .where({ parentId: _.in(frontier), status: 'active' })
      .field({ _id: true })
      .get()
    const ids = (res.data || []).map(d => d._id)
    if (!ids.length) break
    result.push(...ids)
    frontier = ids
  }
  return result
}

async function createNode(db, event) {
  const { name, emoji = '', parentId = null, kind = 'forum', schoolId = null, order } = event
  if (!name || !String(name).trim()) throw new AppError('请输入分类名称', 'INVALID_PARAM')
  if (!KINDS.includes(kind)) throw new AppError('非法的分类类型', 'INVALID_PARAM')

  const { level, schoolId: inheritedSchool } = await resolveLevel(db, parentId || null)
  const finalSchool = (schoolId && String(schoolId).trim()) ? String(schoolId).trim() : (inheritedSchool || null)
  const finalOrder = Number.isFinite(Number(order)) ? Number(order) : 99
  const now = new Date()

  const doc = {
    name: String(name).trim(),
    emoji: String(emoji || '').trim(),
    parentId: parentId || null,
    level,
    kind,
    schoolId: finalSchool,
    order: finalOrder,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  const r = await db.collection('categories').add({ data: doc })
  return ok({ categoryId: r._id, ...doc })
}

async function updateNode(db, event) {
  const { id, name, emoji, parentId, kind, schoolId, order } = event
  if (!id) throw new AppError('缺少分类ID', 'INVALID_PARAM')

  const cur = await db.collection('categories').doc(id).get().catch(() => ({ data: null }))
  if (!cur || !cur.data) throw new AppError('分类不存在', 'NOT_FOUND')

  const patch = {}
  if (name !== undefined) {
    if (!String(name).trim()) throw new AppError('分类名称不能为空', 'INVALID_PARAM')
    patch.name = String(name).trim()
  }
  if (emoji !== undefined) patch.emoji = String(emoji || '').trim()
  if (kind !== undefined) {
    if (!KINDS.includes(kind)) throw new AppError('非法的分类类型', 'INVALID_PARAM')
    patch.kind = kind
  }
  if (schoolId !== undefined) patch.schoolId = (schoolId && String(schoolId).trim()) ? String(schoolId).trim() : null
  if (order !== undefined && Number.isFinite(Number(order))) patch.order = Number(order)

  // 改父级：防环（新父不能是自己或自己的后代）+ 重算 level + MAX_LEVEL 校验
  if (parentId !== undefined && parentId !== cur.data.parentId) {
    if (parentId === id) throw new AppError('不能将分类设为自身的父级', 'INVALID_PARAM')
    const descendants = await collectDescendants(db, id)
    if (descendants.includes(parentId)) throw new AppError('不能将分类移动到其自身子级之下', 'INVALID_PARAM')
    const { level, schoolId: inherited } = await resolveLevel(db, parentId || null)
    // 移动后新 level + 子树深度不能超过 MAX_LEVEL
    const subtreeDepth = await getSubtreeDepth(db, id)
    if (level + subtreeDepth > MAX_LEVEL) throw new AppError('移动后子树层级将超过 ' + MAX_LEVEL + ' 级', 'INVALID_PARAM')
    patch.level = level
    if (schoolId === undefined) patch.schoolId = inherited || null
    // 级联更新子节点的 level + schoolId
    await cascadeUpdateLevel(db, id, level, patch.schoolId || cur.data.schoolId)
  }

  patch.updatedAt = new Date()
  await db.collection('categories').doc(id).update({ data: patch })
  return ok({ updated: true })
}

async function deleteNode(db, event) {
  const { id } = event
  if (!id) throw new AppError('缺少分类ID', 'INVALID_PARAM')

  const cur = await db.collection('categories').doc(id).get().catch(() => ({ data: null }))
  if (!cur || !cur.data) throw new AppError('分类不存在', 'NOT_FOUND')

  const childCount = await db.collection('categories').where({ parentId: id, status: 'active' }).count()
  if (childCount.total > 0) {
    throw new AppError('该分类下还有子分类，请先删除子分类', 'INVALID_PARAM')
  }

  // 软删除：让该节点从分类树（仅查 active）中消失，但历史帖子的 categoryPath 引用仍可用
  await db.collection('categories').doc(id).update({ data: { status: 'deleted', updatedAt: new Date() } })
  return ok({ deleted: true })
}

// 计算某节点的子树最大深度（该节点自身深度=0）
async function getSubtreeDepth(db, rootId) {
  const _ = getCmd()
  let maxDepth = 0
  let frontier = [rootId]
  let depth = 0
  while (frontier.length) {
    const res = await db.collection('categories')
      .where({ parentId: _.in(frontier), status: 'active' })
      .field({ _id: true })
      .get()
    const ids = (res.data || []).map(d => d._id)
    if (!ids.length) break
    depth++
    if (depth > maxDepth) maxDepth = depth
    frontier = ids
  }
  return maxDepth
}

// 级联更新子节点的 level（+1 偏移）和 schoolId
async function cascadeUpdateLevel(db, rootId, newLevel, schoolId) {
  const _ = getCmd()
  let frontier = [rootId]
  let currentLevel = newLevel
  while (frontier.length) {
    const res = await db.collection('categories')
      .where({ parentId: _.in(frontier), status: 'active' })
      .get()
    const children = res.data || []
    if (!children.length) break
    currentLevel++
    const childIds = children.map(c => c._id)
    // 批量更新子节点 level + schoolId
    await db.collection('categories')
      .where({ _id: _.in(childIds) })
      .update({ data: { level: currentLevel, schoolId: schoolId || null } })
    frontier = childIds
  }
}
