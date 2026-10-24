// cloudfunctions/post-update/index.js
// 编辑帖子：仅作者本人可编辑 + fail-closed 内容安全 + 分类校验 + 编辑历史快照
// 可编辑字段：title, content, images, tags, categoryId, categoryPath
// 不可编辑：kind（普通/任务）, isAnonymous, status, 计数字段
const {
  getDB,
  AppError,
  ok,
  wrap,
  requireActiveUser,
  checkContents,
  checkImages,
  rateLimit,
  resolveCategoryPath,
  screenTexts
} = require('./common-bundle')

const MAX_REVISIONS = 10

module.exports = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { postId, title, content, images, tags, categoryId } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  // 频率限制：60 秒内最多 6 次编辑。必须排在所有权查询与内容审核之前 ——
  // 编辑一次就是一次 msgSecCheck / imgSecCheck 调用，无限编辑可耗尽审核配额，
  // 而审核是 fail-closed 的，配额耗尽即等于全站无法发布。
  await rateLimit({
    collection: 'post-update',
    match: { userId: user._id },
    windowMs: 60000,
    max: 6
  })

  // 获取帖子并验证所有权
  const postRes = await db
    .collection('posts')
    .doc(postId)
    .get()
    .catch(() => ({ data: null }))
  if (!postRes || !postRes.data) throw new AppError('帖子不存在', 'NOT_FOUND')
  const post = postRes.data
  if (post.status === 'deleted') throw new AppError('该帖子已被删除', 'INVALID_PARAM')
  if (post.userId !== user._id) throw new AppError('无权编辑他人帖子', 'FORBIDDEN')

  // 1) 先把客户端字段收敛成 patch（长度/类型校验），再过两道路由级审核：
  //    本地分级词表（replace 生效 / block 拒绝）→ 微信 msgSecCheck（fail-closed）。
  const rawPatch = {}
  const rawTexts = []
  if (title !== undefined) {
    if (!String(title).trim()) throw new AppError('标题不能为空', 'INVALID_PARAM')
    if (String(title).length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
    rawPatch.title = String(title).trim()
    rawTexts.push(rawPatch.title)
  }
  if (content !== undefined) {
    const maxContent = post.kind === 'confession' ? 500 : 2000
    if (String(content).length > maxContent)
      throw new AppError('内容不能超过' + maxContent + '字', 'INVALID_PARAM')
    rawPatch.content = String(content).trim()
    rawTexts.push(rawPatch.content)
  }
  if (tags !== undefined) {
    rawPatch.tags = Array.isArray(tags) ? tags.slice(0, 10).map((t) => String(t).slice(0, 20)) : []
    rawTexts.push(rawPatch.tags.join(' '))
  }

  const screened = rawTexts.length
    ? await screenTexts(db, rawTexts)
    : { texts: [], blocked: [], flags: [] }
  if (screened.blocked.length) {
    throw new AppError('内容包含禁止发布的词，请修改后重试', 'CONTENT_RISKY')
  }
  let cursor = 0
  const patch = {}
  if (rawPatch.title !== undefined) patch.title = screened.texts[cursor++]
  if (rawPatch.content !== undefined) patch.content = screened.texts[cursor++]
  if (rawPatch.tags !== undefined) {
    patch.tags = String(screened.texts[cursor++] || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 10)
  }

  if (images !== undefined) {
    if (!Array.isArray(images) || images.length > 9)
      throw new AppError('图片不能超过9张', 'INVALID_PARAM')
    patch.images = images
    patch.type = images.length > 0 ? 'image' : 'text'
    const newImages = images.filter((img) => img && !post.images?.includes(img))
    if (newImages.length) await checkImages(newImages, { openid: user.openid })
  }

  if (categoryId !== undefined) {
    // 祖先链一律服务端推导（含全链 active 校验），不接受客户端 categoryPath
    const { chain: categoryPath, leaf: cat } = await resolveCategoryPath({ db, categoryId })
    const childCount = await db
      .collection('categories')
      .where({ parentId: categoryId, status: 'active' })
      .count()
    if (childCount.total > 0) throw new AppError('请选择更具体的分类', 'INVALID_PARAM')
    patch.categoryId = categoryId
    patch.categoryPath = categoryPath
    patch.category = cat.name
    patch.schoolId = cat.schoolId || post.schoolId || null
  }

  // 2) 微信内容安全（fail-closed）：送检的是替换后的最终文本
  const finalTexts = [patch.title, patch.content, (patch.tags || []).join(' ')].filter(
    (t) => t !== undefined && String(t).length
  )
  if (finalTexts.length) {
    await checkContents(finalTexts, { openid: user.openid, scene: 2 })
  }

  if (Object.keys(patch).length === 0) throw new AppError('没有需要更新的字段', 'INVALID_PARAM')
  patch.updatedAt = new Date()

  // 3) 编辑历史：写入前把旧值快照进 post_revisions（保留最近 MAX_REVISIONS 版）
  await snapshotRevision(db, post, user._id)

  await db.collection('posts').doc(postId).update({ data: patch })
  return ok({ updated: true })
})

/**
 * 快照旧版本并裁剪历史。
 * 失败仅告警：历史是审计增强，不应阻断编辑本身（主流程已通过审核）。
 */
async function snapshotRevision(db, post, editorId) {
  try {
    await db.collection('post_revisions').add({
      data: {
        postId: post._id,
        title: post.title || '',
        content: post.content || '',
        images: Array.isArray(post.images) ? post.images : [],
        tags: Array.isArray(post.tags) ? post.tags : [],
        categoryId: post.categoryId || '',
        editedBy: editorId,
        createdAt: new Date()
      }
    })
    const old = await db
      .collection('post_revisions')
      .where({ postId: post._id })
      .orderBy('createdAt', 'desc')
      .skip(MAX_REVISIONS)
      .limit(20)
      .get()
    await Promise.all(
      (old.data || []).map((r) =>
        db
          .collection('post_revisions')
          .doc(r._id)
          .remove()
          .catch(() => {})
      )
    )
  } catch (e) {
    console.warn('[post-update] 编辑历史写入失败(已忽略):', e && (e.errMsg || e.message))
  }
}
