// common-blocklist.js — 黑名单读侧过滤（单一事实来源）
//
// 拉黑的语义是「拉黑方看不到被拉黑者的内容」：所有读接口在拼查询条件前
// 调用 blockedUserIds，把被拉黑者的 userId 排除掉。语义只做单向——
// 被拉黑者本人无感知、内容不删（那是删除/封禁的语义，不属于拉黑）。
//
// 为什么放在内核：post-list / product-list / comment-list / user-profile
// 四处都要用，散着写就是四份会各自漂移的实现（F-003 的教训）。
//
// 游客没有黑名单：userId 为空时直接返回空数组，调用方据此不加查询条件，
// 避免为游客多打一次 blocks 查询。
const { getDB } = require('./common-db')

/** 当前用户拉黑掉的 userId 列表（无登录态返回 []） */
async function blockedUserIds(userId) {
  if (!userId) return []
  const db = getDB()
  const res = await db
    .collection('blocks')
    .where({ blockerId: userId })
    .field({ blockedId: true })
    .get()
  return (res.data || []).map((d) => d.blockedId).filter(Boolean)
}

module.exports = { blockedUserIds }
