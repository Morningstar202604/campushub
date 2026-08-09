// cloudfunctions/post-create/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { title, content, images = [], tags = [], category = 'daily', isAnonymous = false } = event
  
  // 参数校验
  if (!title || !title.trim()) {
    return { success: false, message: '请输入标题' }
  }
  if (!content.trim() && images.length === 0) {
    return { success: false, message: '请输入内容或上传图片' }
  }
  if (title.length > 30) {
    return { success: false, message: '标题不能超过30字' }
  }
  if (content.length > 2000) {
    return { success: false, message: '内容不能超过2000字' }
  }
  if (images.length > 9) {
    return { success: false, message: '图片不能超过9张' }
  }
  
  // 敏感词检查
  try {
    const msgCheck = await cloud.openapi.security.msgSecCheck({
      content: title + content + tags.join('')
    })
    if (msgCheck.errCode !== 0) {
      return { success: false, message: '内容包含敏感信息，请修改后重试' }
    }
  } catch (e) {
    console.warn('[安全检查] 跳过:', e.errMsg)
  }
  
  // 查用户信息
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在，请重新登录' }
  }
  
  const user = userRes.data[0]
  
  // 频率限制：30秒内只能发一条
  const recentPosts = await db.collection('posts')
    .where({
      userId: user._id,
      createdAt: _.gt(new Date(Date.now() - 30000))
    })
    .count()
  
  if (recentPosts.total > 0) {
    return { success: false, message: '发布太频繁，请30秒后再试' }
  }
  
  const post = {
    userId: user._id,
    userNickname: isAnonymous ? '匿名同学' : user.nickname,
    userAvatar: isAnonymous ? '' : user.avatar,
    schoolId: user.schoolId || 'HSFNC',
    type: images.length > 0 ? 'image' : 'text',
    title: title.trim(),
    content: content.trim(),
    images,
    tags,
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
  
  // 更新用户帖子数
  await db.collection('users').doc(user._id).update({
    data: { postCount: _.inc(1) }
  })
  
  return { success: true, postId: addRes._id }
}
