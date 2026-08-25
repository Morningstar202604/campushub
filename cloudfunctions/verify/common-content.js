// common-content.js — 内容删除的单一事实来源
// 根本性消除 post-delete / product-delete / comment-delete / admin 删除四处近乎相同的"软删除+回收图片+计数回退"逻辑。
// 所有删除都经它，保证行为（云存储孤儿回收、计数回退、管理员越权）完全一致。
const { getDB, getCmd, cloud } = require('./common-db')
const { AppError } = require('./common-error')
const { checkAdmin } = require('./common-security')

/**
 * 软删除一条内容并回收其云存储图片。
 * @param {object} opts
 * @param {string} opts.collection  集合名 posts/products/comments
 * @param {string} opts.docId       文档 _id
 * @param {object} opts.actor       操作者（getCurrentUser() 结果，含 openid/_id）
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

  // 权限：作者本人 或 管理员。
  // 管理员判定走 checkAdmin（openid 维度）——getCurrentUser 的投影不含 role，
  // 此前依赖 actor.role === 'admin' 的分支是不可达死代码。
  const isOwner = actor && doc.userId === actor._id
  let isAdmin = false
  if (!isOwner && actor && actor.openid) {
    isAdmin = await checkAdmin(db, actor.openid)
  }
  if (!isOwner && !isAdmin) throw new AppError('无权删除该内容', 'FORBIDDEN')

  // 原子占位软删：条件更新保证并发双击/重复请求只有一次真正生效，
  // 计数回退只随首次删除执行一次，杜绝双重扣减。
  const claim = await db.collection(collection)
    .where({ _id: docId, status: _.neq('deleted') })
    .update({ data: { status: 'deleted', updatedAt: new Date() } })
  if (!claim || !claim.stats || !claim.stats.updated) {
    return { alreadyDeleted: true }
  }

  // 回收云存储图片，避免孤儿文件长期堆积（失败仅告警，不影响主删除）
  const images = Array.isArray(doc[imageField])
    ? doc[imageField].filter(f => typeof f === 'string' && f.startsWith('cloud://'))
    : []
  if (images.length) {
    cloud.deleteFile({ fileList: images }).catch(e => console.warn('[removeContent] 图片清理失败(已忽略):', e))
  }

  // 回退用户计数（best-effort：主删除已成功，计数失败仅记录不回滚）
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

/**
 * 浏览量去重自增：同一 openid 对同一文档每天只计 1 次。
 * 用"确定性 _id 插入冲突"做天然去重，无额外读开销；任何失败静默降级为不计数。
 * 需要 init-db 预创建 view_logs 集合（_id 主键天然唯一，无需额外索引）。
 */
async function countViewOnce(collection, docId) {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext && wxContext.OPENID
    if (!openid) return false
    const db = getDB()
    const d = new Date(Date.now() + 8 * 3600 * 1000)
    const bucket = d.getUTCFullYear() +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0')
    const _id = `v_${openid}_${collection}_${docId}_${bucket}`
    try {
      await db.collection('view_logs').add({
        data: { _id, targetType: collection, targetId: String(docId), openid, createdAt: new Date() }
      })
    } catch (e) {
      const msg = String(e && (e.errMsg || e.message || ''))
      if (!/duplicate|E11000|-502001/i.test(msg)) {
        console.warn('[countViewOnce] 去重记录失败(忽略):', msg)
      }
      return false
    }
    const r = await db.collection(collection).doc(docId).update({ data: { viewCount: getCmd().inc(1) } })
    return !!(r && r.stats && r.stats.updated)
  } catch (e) {
    console.warn('[countViewOnce] 失败(按未浏览处理):', e && e.message)
    return false
  }
}

module.exports = { removeContent, countViewOnce }
