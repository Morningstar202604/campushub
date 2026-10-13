// cloudfunctions/post-create/index.js
// 发帖：统一鉴权 + fail-closed 内容安全(文本+图片) + 频率限制 + 封禁拦截
// 分类：必须选择到叶子节点（多级目录，避免内容淹没）
// kind 类型：post 普通帖 / task 任务帖(带过期) / lost 失物 / found 招领 / confession 表白墙
// 表白墙强制匿名；失物/招领可带地点，支持"已找回"标记（复用 resolved）
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, checkImages, rateLimit, isDuplicateKeyError, resolveCategoryPath } = require('./common-bundle')

const TASK_EXPIRE_DAYS = [3, 7, 15, 30]
const VALID_KINDS = ['post', 'task', 'lost', 'found', 'confession']

// 轮询等待同 clientReqId 的首请求落地（处理并发/重试），最多 waitMs 后返回 null
async function waitIdempotency(db, clientReqId, waitMs) {
  const start = Date.now()
  while (Date.now() - start < waitMs) {
    const rec = await db.collection('idempotency').where({ clientReqId }).get().catch(() => null)
    if (rec && rec.data && rec.data.length) {
      const hit = rec.data[0]
      if (hit.resultId || hit.status === 'done') return hit
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return null
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  // ===== 幂等（防闪断重试产生双帖）=====
  // 先占位：唯一索引 idx_idempotency_reqid 保证同一 clientReqId 仅首个请求占位成功；
  // 重试/并发占位失败则轮询等待首请求落地并回查已有结果，避免双写。
  // 幂等表 idempotency 需建唯一索引（见 common-indexes.js），并设 expireAt + 控制台 TTL（30天）自动清理。
  const clientReqId = event.clientReqId
  let idemId = null
  if (clientReqId) {
    const TTL = 30 * 24 * 60 * 60 * 1000
    const build = () => ({
      clientReqId, type: 'post', resultId: null, status: 'pending',
      createdAt: new Date(), expireAt: new Date(Date.now() + TTL)
    })
    try {
      const r = await db.collection('idempotency').add({ data: build() })
      idemId = r._id
    } catch (e) {
      if (!isDuplicateKeyError(e)) throw e // 非唯一键冲突：正常抛出
      const done = await waitIdempotency(db, clientReqId, 8000)
      if (done && done.resultId) {
        return ok({ postId: done.resultId, idempotent: true })
      }
      // 首请求异常终止（pending 无结果）：清理后按新请求继续（极小概率；TTL 兜底）
      await db.collection('idempotency').where({ clientReqId }).remove().catch(() => {})
      const r2 = await db.collection('idempotency').add({ data: build() })
      idemId = r2._id
    }
  }

  const {
    title: rawTitle, content: rawContent, images = [], tags = [],
    categoryId, kind = 'post', expireDays = 7, isAnonymous = false,
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

  // 频率限制：30秒内最多发1条
  // 顺序要求：限频必须在内容安全之前。审核接口配额有限（文本 4000 次/分、图片 2000 次/分），
  // 先审后限等于让脚本用无效请求把配额烧光；而本项目的审核是 fail-closed，
  // 配额一旦耗尽，全站都会"发不出去"——限频前置就是给审核链路兜底。
  await rateLimit({ collection: 'posts', match: { userId: user._id }, windowMs: 30000, max: 1 })

  // 分类校验：必须存在、全链 active、且为叶子（无子分类）
  if (!categoryId) throw new AppError('请选择分类', 'INVALID_PARAM')
  const { chain: categoryPath, leaf: cat } = await resolveCategoryPath({ db, categoryId })
  const childCount = await db.collection('categories').where({ parentId: categoryId, status: 'active' }).count()
  if (childCount.total > 0) throw new AppError('请选择更具体的分类', 'INVALID_PARAM')

  // 文本安全：任何异常一律拒绝发布（fail-closed）
  await checkContents([title, content, safeTags.join(' ')], { openid: user.openid, scene: 2 })

  // 图片安全：同步 imgSecCheck + Buffer（fail-closed，并发受限）
  if (images.length) await checkImages(images)

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
    categoryPath, // 服务端由 categoryId 回溯推导，绝不采信客户端传值
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

  // 落库后回填幂等键结果，供并发/重试请求回查（失败静默，不影响主流程）
  if (idemId) {
    await db.collection('idempotency').doc(idemId).update({ data: { resultId: addRes._id, status: 'done' } }).catch(() => {})
  }

  return ok({ postId: addRes._id })
})
