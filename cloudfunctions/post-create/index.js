// cloudfunctions/post-create/index.js
// 发帖：统一鉴权 + fail-closed 内容安全(文本+图片) + 频率限制 + 封禁拦截
// 分类：必须选择到叶子节点（多级目录，避免内容淹没）
// 任务类(kind='task')：带 expireAt，超时未解决由 task-expire 定时置为 expired
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, checkImages, rateLimit } = require('./common-bundle')

const TASK_EXPIRE_DAYS = [3, 7, 15, 30]

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const {
    title, content, images = [], tags = [],
    categoryId, categoryPath = [], kind = 'post', expireDays = 7, isAnonymous = false
  } = event

  // 参数校验
  if (!title || !title.trim()) throw new AppError('请输入标题', 'INVALID_PARAM')
  if (!content.trim() && (!Array.isArray(images) || images.length === 0)) {
    throw new AppError('请输入内容或上传图片', 'INVALID_PARAM')
  }
  if (title.length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
  if (content.length > 2000) throw new AppError('内容不能超过2000字', 'INVALID_PARAM')
  if (!Array.isArray(images) || images.length > 9) throw new AppError('图片不能超过9张', 'INVALID_PARAM')
  const safeTags = Array.isArray(tags) ? tags.slice(0, 10).map(t => String(t).slice(0, 20)) : []

  // 分类校验：必须存在且为叶子（无子分类）
  if (!categoryId) throw new AppError('请选择分类', 'INVALID_PARAM')
  const catRes = await db.collection('categories').doc(categoryId).get().catch(() => ({ data: null }))
  if (!catRes || !catRes.data) throw new AppError('分类不存在', 'INVALID_PARAM')
  const cat = catRes.data
  if (cat.status !== 'active') throw new AppError('分类不可用', 'INVALID_PARAM')
  const childCount = await db.collection('categories').where({ parentId: categoryId, status: 'active' }).count()
  if (childCount.total > 0) throw new AppError('请选择更具体的分类', 'INVALID_PARAM')

  // 文本安全：任何异常一律拒绝发布（fail-closed）
  await checkContents([title, content, safeTags.join(' ')], { openid: user.openid, scene: 2 })

  // 图片安全：对每张云存储图片做 imgSecCheck（fail-closed）
  if (images.length) await checkImages(images, { openid: user.openid })

  // 频率限制：30秒内最多发1条
  await rateLimit({ collection: 'posts', match: { userId: user._id }, windowMs: 30000, max: 1 })

  // 任务类：计算过期时间
  const isTask = kind === 'task'
  let expireAt = null
  if (isTask) {
    const days = TASK_EXPIRE_DAYS.includes(Number(expireDays)) ? Number(expireDays) : 7
    expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  // schoolId：优先取所选分类挂载的校区，否则取用户校区
  const schoolId = cat.schoolId || user.schoolId || null

  const post = {
    userId: user._id,
    userNickname: isAnonymous ? '匿名同学' : user.nickname,
    userAvatar: isAnonymous ? '' : user.avatar,
    schoolId,
    categoryId,
    categoryPath: Array.isArray(categoryPath) ? categoryPath : [],
    category: cat.name,
    kind: isTask ? 'task' : 'post',
    expireAt,
    resolved: false,
    resolvedAt: null,
    type: images.length > 0 ? 'image' : 'text',
    title: title.trim(),
    content: content.trim(),
    images,
    tags: safeTags,
    isAnonymous,
    likeCount: 0,
    commentCount: 0,
    collectCount: 0,
    viewCount: 0,
    status: 'normal',
    isPinned: false,
    isEssence: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  const addRes = await db.collection('posts').add({ data: post })
  await db.collection('users').doc(user._id).update({ data: { postCount: _.inc(1) } })

  return ok({ postId: addRes._id })
})
