// cloudfunctions/post-create/index.js
// 发帖：统一鉴权 + fail-closed 内容安全 + 频率限制 + 封禁拦截
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const { title, content, images = [], tags = [], category = 'daily', isAnonymous = false } = event

  // 参数校验
  if (!title || !title.trim()) throw new AppError('请输入标题', 'INVALID_PARAM')
  if (!content.trim() && (!Array.isArray(images) || images.length === 0)) {
    throw new AppError('请输入内容或上传图片', 'INVALID_PARAM')
  }
  if (title.length > 30) throw new AppError('标题不能超过30字', 'INVALID_PARAM')
  if (content.length > 2000) throw new AppError('内容不能超过2000字', 'INVALID_PARAM')
  if (!Array.isArray(images) || images.length > 9) throw new AppError('图片不能超过9张', 'INVALID_PARAM')
  const safeTags = Array.isArray(tags) ? tags.slice(0, 10).map(t => String(t).slice(0, 20)) : []

  // 内容安全：任何异常一律拒绝发布（fail-closed）
  await checkContents([title, content, safeTags.join(' ')], { openid: user.openid, scene: 2 })

  // 频率限制：30秒内最多发1条
  await rateLimit({ collection: 'posts', match: { userId: user._id }, windowMs: 30000, max: 1 })

  const post = {
    userId: user._id,
    userNickname: isAnonymous ? '匿名同学' : user.nickname,
    userAvatar: isAnonymous ? '' : user.avatar,
    schoolId: user.schoolId || 'HSFNC',
    type: images.length > 0 ? 'image' : 'text',
    title: title.trim(),
    content: content.trim(),
    images,
    tags: safeTags,
    category,
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
