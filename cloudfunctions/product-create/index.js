// cloudfunctions/product-create/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const {
    title, description, images = [], price, originalPrice,
    category = 'other', condition = 'good', tradeType = 'face',
    location = '', contactInfo = ''
  } = event
  
  // 参数校验
  if (!title || !title.trim()) {
    return { success: false, message: '请输入商品标题' }
  }
  if (price === undefined || price === null || price < 0) {
    return { success: false, message: '请输入有效价格' }
  }
  if (images.length === 0) {
    return { success: false, message: '请至少上传一张图片' }
  }
  if (images.length > 9) {
    return { success: false, message: '图片不能超过9张' }
  }
  if (title.length > 30) {
    return { success: false, message: '标题不能超过30字' }
  }
  
  // 敏感词检查
  try {
    const msgCheck = await cloud.openapi.security.msgSecCheck({
      content: title + description + contactInfo
    })
    if (msgCheck.errCode !== 0) {
      return { success: false, message: '内容包含敏感信息' }
    }
  } catch (e) {
    console.warn('[安全检查] 跳过:', e.errMsg)
  }
  
  // 查用户
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const user = userRes.data[0]
  
  // 匿名用户不能发布商品
  if (user.verifyStatus === 'banned') {
    return { success: false, message: '账号已被限制' }
  }
  
  // 频率限制
  const recentProducts = await db.collection('products')
    .where({
      userId: user._id,
      createdAt: _.gt(new Date(Date.now() - 30000))
    })
    .count()
  
  if (recentProducts.total > 0) {
    return { success: false, message: '发布太频繁，请30秒后再试' }
  }
  
  const product = {
    userId: user._id,
    userNickname: user.nickname,
    userAvatar: user.avatar,
    schoolId: user.schoolId || 'HSFNC',
    title: title.trim(),
    description: (description || '').trim(),
    images,
    price: Number(price),
    originalPrice: originalPrice ? Number(originalPrice) : null,
    category,
    condition,
    tradeType,
    location,
    contactInfo,
    status: 'on_sale',
    viewCount: 0,
    wantCount: 0,
    collectCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const addRes = await db.collection('products').add({ data: product })
  
  // 更新用户商品数
  await db.collection('users').doc(user._id).update({
    data: { productCount: _.inc(1) }
  })
  
  return { success: true, productId: addRes._id }
}
