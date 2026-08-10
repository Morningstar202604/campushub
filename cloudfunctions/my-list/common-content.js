// common-content.js — 内容删除的单一事实来源
// 根本性消除 post-delete / product-delete / comment-delete / admin 删除四处近乎相同的"软删除+回收图片+计数回退"逻辑。
// 所有删除都经它，保证行为（云存储孤儿回收、计数回退、管理员越权）完全一致。
const { getDB, getCmd, cloud } = require('./common-db')
const { AppError } = require('./common-error')

/**
 * 软删除一条内容并回收其云存储图片。
 * @param {object} opts
 * @param {string} opts.collection  集合名 posts/products/comments
 * @param {string} opts.docId       文档 _id
 * @param {object} opts.actor       操作者 { _id, role }（role==='admin' 可越权）
 * @param {object} opts.opts        附加选项
 * @param {string} [opts.opts.imageField='images']  图片字段名
 * @param {string} [opts.opts.userCountField]       删除后回退的用户计数字段名（postCount/productCount）
 * @param {boolean} [opts.opts.targetComment=false] 评论删除：回退目标帖子/商品的 commentCount（仅 normal 状态回退）
 */
async function removeContent({ collection, docId, actor, opts = {} }) {
  const { imageField = 'images', userCountField = null, targetComment = false } = opts
  const db = getDB()
  const _ = getCmd()

  const res = await db.collection(collection).doc(docId).get().catch(() => ({ data: null }))
  const doc = res && res.data
  if (!doc) throw new AppError('内容不存在', 'NOT_FOUND')

  // 权限：作者本人 或 管理员
  const isOwner = actor && doc.userId === actor._id
  const isAdmin = !!(actor && actor.role === 'admin')
  if (!isOwner && !isAdmin) throw new AppError('无权删除该内容', 'FORBIDDEN')

  // 已删除直接返回，幂等
  if (doc.status === 'deleted') return { alreadyDeleted: true }

  // 回收云存储图片，避免孤儿文件长期堆积（失败仅告警，不影响主删除）
  const images = Array.isArray(doc[imageField])
    ? doc[imageField].filter(f => typeof f === 'string' && f.startsWith('cloud://'))
    : []
  if (images.length) {
    cloud.deleteFile({ fileList: images }).catch(e => console.warn('[removeContent] 图片清理失败(已忽略):', e))
  }

  // 软删除
  await db.collection(collection).doc(docId).update({ data: { status: 'deleted', updatedAt: new Date() } })

  // 回退用户计数
  if (userCountField && doc.userId) {
    await db.collection('users').doc(doc.userId).update({ data: { [userCountField]: _.inc(-1) } }).catch(() => {})
  }
  // 评论删除：回退目标内容评论数（仅 normal 状态才曾计入）
  if (targetComment && doc.status === 'normal' && doc.targetType && doc.targetId) {
    const tcol = doc.targetType === 'post' ? 'posts' : 'products'
    await db.collection(tcol).doc(doc.targetId).update({ data: { commentCount: _.inc(-1) } }).catch(() => {})
  }

  return { alreadyDeleted: false }
}

module.exports = { removeContent }
