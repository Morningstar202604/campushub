// cloudfunctions/category-list/index.js
// 返回分类树节点（全国性贴吧式多级目录）
//   parentId 缺省 -> 返回全部（前端本地建树、逐级下钻）
//   提供 parentId -> 仅返回该父节点下的直接子节点
const { getDB, ok, wrap, sanitizeQuery } = require('./common-bundle')

exports.main = wrap(async (event = {}) => {
  const db = getDB()
  // 客户端查询字段过白名单标量断言，防对象/操作符注入 where（v0.9.2 统一口径）
  const { parentId } = sanitizeQuery(event, ['parentId'])
  const where = { status: 'active' }
  if (parentId !== undefined && parentId !== null && parentId !== '') {
    where.parentId = parentId
  }
  const res = await db.collection('categories')
    .where(where)
    .orderBy('level', 'asc')
    .orderBy('order', 'asc')
    .limit(1000)
    .get()
  return ok({ list: res.data })
})
