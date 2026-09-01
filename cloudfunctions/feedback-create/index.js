// cloudfunctions/feedback-create/index.js
// 用户反馈：统一经云函数（带内容安全 + 频率限制），不再直写数据库
// 写操作统一经 requireActiveUser，封禁用户不可提交反馈
const { getDB, AppError, ok, wrap, requireActiveUser, checkContents, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { content: rawContent, contact = '', type = 'suggest' } = event
  // 统一 String 化：客户端可传非字符串，避免 .trim()/.length 抛 TypeError
  const content = String(rawContent == null ? '' : rawContent).trim()
  if (!content) throw new AppError('请输入反馈内容', 'INVALID_PARAM')
  if (content.length > 500) throw new AppError('反馈内容不能超过500字', 'INVALID_PARAM')
  // type 白名单 + contact 限长，防任意大对象/垃圾枚举入库
  const VALID_TYPES = ['suggest', 'bug', 'other']
  const safeType = VALID_TYPES.includes(type) ? type : 'suggest'
  const safeContact = String(contact || '').trim().slice(0, 50)

  await checkContents([content, safeContact], { openid: user.openid, scene: 2 })
  await rateLimit({ collection: 'feedbacks', match: { userId: user._id }, windowMs: 60000, max: 3 })

  await db.collection('feedbacks').add({
    data: {
      userId: user._id,
      nickname: user.nickname,
      content,
      contact: safeContact,
      type: safeType,
      status: 'pending',
      createdAt: new Date()
    }
  })

  return ok({ message: '感谢反馈，我们已经收到' })
})
