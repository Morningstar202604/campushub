// cloudfunctions/comment-create/index.js
// 评论：统一鉴权 + fail-closed 内容安全 + 频率限制 + 目标存在性与状态校验 + 类型白名单
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, rateLimit } = require('./common-bundle')
const { sendSubscribe, getOpenidByUserId } = require('./common-subscribe')

const VALID_TARGET_TYPES = ['post', 'product']
// 目标类型 → 集合名 + 删除态状态值
const TARGET_MAP = {
  post: { col: 'posts', deletedStatus: 'deleted' },
  product: { col: 'products', deletedStatus: 'deleted' }
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const { targetId, targetType = 'post', content: rawContent, replyToUserId, replyToNickname, parentId } = event
  // 统一 String 化：客户端可传非字符串（null/数字/对象），避免 .trim()/.length 抛 TypeError
  const content = String(rawContent == null ? '' : rawContent).trim()

  if (!targetId) throw new AppError('缺少目标ID', 'INVALID_PARAM')
  if (!VALID_TARGET_TYPES.includes(targetType)) throw new AppError('非法的目标类型', 'INVALID_PARAM')
  if (!content) throw new AppError('请输入评论内容', 'INVALID_PARAM')
  if (content.length > 500) throw new AppError('评论不能超过500字', 'INVALID_PARAM')

  // 目标集合校验 + 状态校验（不允许评论已删除的内容）
  const cfg = TARGET_MAP[targetType]
  const targetRes = await db.collection(cfg.col).doc(targetId).get().catch(() => ({ data: null }))
  if (!targetRes || !targetRes.data) throw new AppError('评论的对象不存在', 'NOT_FOUND')
  if (targetRes.data.status === cfg.deletedStatus) throw new AppError('该内容已被删除，无法评论', 'INVALID_PARAM')

  // 如果有 parentId，校验父评论存在且属于同一目标（楼中楼）
  let validParentId = null
  if (parentId) {
    const parentRes = await db.collection('comments').doc(parentId).get().catch(() => ({ data: null }))
    if (!parentRes || !parentRes.data) throw new AppError('父评论不存在', 'NOT_FOUND')
    if (parentRes.data.targetId !== targetId) throw new AppError('父评论不属于同一目标', 'INVALID_PARAM')
    validParentId = parentId
  }

  // 内容安全：fail-closed
  await checkContents([content], { openid: user.openid, scene: 2 })
  // 频率限制：10秒内最多3条
  await rateLimit({ collection: 'comments', match: { userId: user._id }, windowMs: 10000, max: 3 })

  const comment = {
    targetId,
    targetType,
    userId: user._id,
    userNickname: user.nickname,
    userAvatar: user.avatar,
    content,
    replyToUserId: replyToUserId || '',
    replyToNickname: replyToNickname || '',
    parentId: validParentId,
    likeCount: 0,
    replyCount: 0,
    status: 'normal',
    createdAt: new Date()
  }

  const addRes = await db.collection('comments').add({ data: comment })

  // 评论数 +1（软删除内容不计）
  await db.collection(cfg.col).doc(targetId).update({ data: { commentCount: _.inc(1) } })

  // 如果是楼中楼回复，父评论 replyCount +1
  if (validParentId) {
    await db.collection('comments').doc(validParentId).update({ data: { replyCount: _.inc(1) } })
  }

  // 站内通知：通知作者被评论（不通知自己）
  try {
    if (targetRes.data.userId !== user._id) {
      await db.collection('notifications').add({
        data: { userId: targetRes.data.userId, type: 'comment', targetType, content: `${user.nickname} 评论了你的内容`, targetId, isRead: false, createdAt: new Date() }
      })
    }
  } catch (e) {}

  // 订阅消息推送（best-effort：未配置模板/用户未订阅均静默）
  try {
    const targetOpenid = await getOpenidByUserId(db, targetRes.data.userId)
    await sendSubscribe(targetOpenid, 'comment', 'pages/post-detail/post-detail?id=' + targetId, {
      thing1: { value: (user.nickname + ' 评论了你的内容').slice(0, 20) },
      time2: { value: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) }
    })
  } catch (e) {}

  return ok({ commentId: addRes._id, comment })
})
