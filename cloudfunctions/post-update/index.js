// cloudfunctions/post-update/index.js
// 编辑帖子：仅作者本人可编辑 + fail-closed 内容安全 + 分类校验
// 可编辑字段：title, content, images, tags, categoryId, categoryPath
// 不可编辑：kind（普通/任务）, isAnonymous, status, 计数字段
const { getDB, AppError, ok, wrap, requireActiveUser, checkContents, checkImages } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { postId, title, content, images, tags, categoryId, categoryPath } = event
  if (!postId) throw new AppError('缺少帖子ID', 'INVALID_PARAM')

  // 获取帖子并验证所有权
  const postRes = await db.collection('posts').doc(postId).get().catch(() => ({ data: null }))
  if (!postRes || !postRes.data) throw new AppError('帖子不存在', 'NOT_FOUND')
  const post = postRes.data
  if (post.status === 'deleted') throw new AppError('该帖子已被删除', 'INVALID_PARAM')
  if (post.userId !== user._id) throw new AppError('无权编辑他人帖子', 'FORBIDDEN')

  const patch = {}
  const textsToCheck = []

  // 标题
  if (title !== undefined) {
    if (!String(title).trim()) throw new AppError('标题不能为空', 'INVALID_PARAM')
    if (String(title).length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
    patch.title = String(title).trim()
    textsToCheck.push(patch.title)
  }

  // 内容
  if (content !== undefined) {
    if (String(content).length > 2000) throw new AppError('内容不能超过2000字', 'INVALID_PARAM')
    patch.content = String(content).trim()
    textsToCheck.push(patch.content)
  }

  // 图片
  if (images !== undefined) {
    if (!Array.isArray(images) || images.length > 9) throw new AppError('图片不能超过9张', 'INVALID_PARAM')
    patch.images = images
    patch.type = images.length > 0 ? 'image' : 'text'
    // 对新图片做安全检查
    const newImages = images.filter(img => img && !post.images?.includes(img))
    if (newImages.length) await checkImages(newImages, { openid: user.openid })
  }

  // 标签
  if (tags !== undefined) {
    const safeTags = Array.isArray(tags) ? tags.slice(0, 10).map(t => String(t).slice(0, 20)) : []
    patch.tags = safeTags
    textsToCheck.push(safeTags.join(' '))
  }

  // 分类
  if (categoryId !== undefined) {
    const catRes = await db.collection('categories').doc(categoryId).get().catch(() => ({ data: null }))
    if (!catRes || !catRes.data) throw new AppError('分类不存在', 'INVALID_PARAM')
    const cat = catRes.data
    if (cat.status !== 'active') throw new AppError('分类不可用', 'INVALID_PARAM')
    const childCount = await db.collection('categories').where({ parentId: categoryId, status: 'active' }).count()
    if (childCount.total > 0) throw new AppError('请选择更具体的分类', 'INVALID_PARAM')
    patch.categoryId = categoryId
    patch.categoryPath = Array.isArray(categoryPath) ? categoryPath : []
    patch.category = cat.name
    patch.schoolId = cat.schoolId || post.schoolId || null
  }

  // 文本安全审核（fail-closed）
  if (textsToCheck.length) {
    await checkContents(textsToCheck, { openid: user.openid, scene: 2 })
  }

  if (Object.keys(patch).length === 0) throw new AppError('没有需要更新的字段', 'INVALID_PARAM')
  patch.updatedAt = new Date()

  await db.collection('posts').doc(postId).update({ data: patch })
  return ok({ updated: true })
})
