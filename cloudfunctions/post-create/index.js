// cloudfunctions/post-create/index.js
// 发帖：统一鉴权 + fail-closed 内容安全(文本+图片) + 频率限制 + 封禁拦截
// 分类：必须选择到叶子节点（多级目录，避免内容淹没）
// kind 类型：post 普通帖 / task 任务帖(带过期) / lost 失物 / found 招领 / confession 表白墙
// 表白墙强制匿名；失物/招领可带地点，支持"已找回"标记（复用 resolved）
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, checkImages, rateLimit } = require('./common-bundle')

const TASK_EXPIRE_DAYS = [3, 7, 15, 30]
const VALID_KINDS = ['post', 'task', 'lost', 'found', 'confession']

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const {
    title: rawTitle, content: rawContent, images = [], tags = [],
    categoryId, categoryPath = [], kind = 'post', expireDays = 7, isAnonymous = false,
    location = ''
  } = event
  // 统一 String 化：客户端可传非字符串，避免 .trim()/.length 抛 TypeError
  const title = String(rawTitle == null ? '' : rawTitle).trim()
  const content = String(rawContent == null ? '' : rawContent).trim()

  // 参数校验
  if (!title) throw new AppError('请输入标题', 'INVALID_PARAM')
  if (!content) {
    if (!Array.isArray(images) || images.length === 0) throw new AppError('请输入内容或上传图片', 'INVALID_PARAM')
  }
  if (title.length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
  const maxContent = kind === 'confession' ? 500 : 2000
  if (content.length > maxContent) throw new AppError('内容不能超过' + maxContent + '字', 'INVALID_PARAM')
  if (!Array.isArray(images) || images.length > 9) throw new AppError('图片不能超过9张', 'INVALID_PARAM')
  const safeKind = VALID_KINDS.includes(kind) ? kind : 'post'
  const safeTags = Array.isArray(tags) ? tags.slice(0, 10).map(t => String(t).slice(0, 20)) : []
  // 失物/招领地点（可选）
  // 表白墙强制匿名（客户端传什么都不算数）
  const isAnon = safeKind === 'confession' ? true : !!isAnonymous
  const safeLocation = ['lost', 'found'].includes(safeKind) ? String(location || '').trim().slice(0, 50) : ''

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
  const isTask = safeKind === 'task'
  let expireAt = null
  if (isTask) {
    const days = TASK_EXPIRE_DAYS.includes(Number(expireDays)) ? Number(expireDays) : 7
    expireAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  // schoolId：优先取所选分类挂载的校区，否则取用户校区
  const schoolId = cat.schoolId || user.schoolId || null

  const post = {
    userId: user._id,
    userNickname: isAnon ? '匿名同学' : user.nickname,
    userAvatar: isAnon ? '' : user.avatar,
    schoolId,
    categoryId,
    categoryPath: Array.isArray(categoryPath) ? categoryPath : [],
    category: cat.name,
    kind: safeKind,
    location: safeLocation,
    expireAt,
    resolved: false,
    resolvedAt: null,
    type: images.length > 0 ? 'image' : 'text',
    title,
    content,
    images,
    tags: safeTags,
    isAnonymous: isAnon,
    authorVerified: user.campusVerified === true,
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
