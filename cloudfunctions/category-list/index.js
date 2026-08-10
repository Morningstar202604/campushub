// cloudfunctions/category-list/index.js
// 返回分类树节点（全国性贴吧式多级目录）
//   parentId 缺省 -> 返回全部（前端本地建树、逐级下钻）
//   提供 parentId -> 仅返回该父节点下的直接子节点
const { getDB, ok, wrap } = require('./common-bundle')

exports.main = wrap(async (event = {}) => {
  const db = getDB()
  const { parentId } = event
  const where = { status: 'active' }
  if (parentId !== undefined && parentId !== null && parentId !== '') {
    where.parentId = parentId
  }
  const res = await db.collection('categories')
    .where(where)
    .orderBy('level', 'asc')
    .orderBy('order', 'asc')
    .limit(300)
    .get()
  return ok({ list: res.data })
})
