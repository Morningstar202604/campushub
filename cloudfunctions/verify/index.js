// cloudfunctions/verify/index.js
// 校园身份认证：用户提交 学校 + 学号 + 校园卡照片 → 管理员人工审核。
// 为什么走人工审核：个人/校园部署通常没有 SMTP 与企业邮箱通道，
// edu 邮件自动验证需要额外付费服务；人工审核零成本且更可控（见 docs/OPERATIONS.md）。
//
// 用户字段约定（users 集合新增）：
//   campusVerified   true/false —— 认证通过（内容发布时冗余为 authorVerified）
//   campusVerifyStatus 'none' | 'pending' | 'approved' | 'rejected'
// 审核请求存 verify_requests 集合（init-db 自动创建）：
//   { userId, school, studentId, imageFileID, status: pending|approved|rejected,
//     rejectReason, reviewedBy, reviewedAt, createdAt }
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, checkContents, checkImage, rateLimit } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()
  const { action = 'status' } = event

  // ---- 查询自己的认证状态 ----
  if (action === 'status') {
    const latest = await db.collection('verify_requests')
      .where({ userId: user._id })
      .orderBy('createdAt', 'desc').limit(1).get()
    return ok({
      campusVerified: user.campusVerified === true,
      status: user.campusVerifyStatus || (user.campusVerified ? 'approved' : 'none'),
      request: latest.data && latest.data[0]
        ? { ...latest.data[0], openid: undefined }
        : null
    })
  }

  // ---- 提交认证 ----
  if (action === 'submit') {
    // 已认证不可重复提交
    if (user.campusVerified) throw new AppError('你已通过校园认证，无需重复提交', 'ALREADY')

    const { school, studentId, imageFileID } = event
    const safeSchool = String(school || '').trim().slice(0, 50)
    const safeStudentId = String(studentId || '').trim()
    if (!safeSchool) throw new AppError('请填写学校名称', 'INVALID_PARAM')
    if (!/^[A-Za-z0-9]{4,20}$/.test(safeStudentId)) throw new AppError('学号需为 4~20 位字母或数字', 'INVALID_PARAM')
    if (!imageFileID || typeof imageFileID !== 'string' || !imageFileID.startsWith('cloud://')) {
      throw new AppError('请上传校园卡/学生证照片', 'INVALID_PARAM')
    }

    // 有待审核的申请时禁止重复提交
    const pending = await db.collection('verify_requests')
      .where({ userId: user._id, status: 'pending' }).count()
    if (pending.total > 0) throw new AppError('已有待审核的申请，请耐心等待', 'ALREADY')

    // 文本安全：学校名（fail-closed）
    await checkContents([safeSchool], { openid: user.openid, scene: 1 })
    // 证件照必须过图片安全审核（fail-closed）
    await checkImage({ fileID: imageFileID, openid: user.openid })

    // 频率限制：24 小时内最多提交 3 次（含被拒后的重提）
    await rateLimit({ collection: 'verify_requests', match: { userId: user._id }, windowMs: 86400000, max: 3 })

    const addRes = await db.collection('verify_requests').add({
      data: {
        userId: user._id,
        nickname: user.nickname,
        school: safeSchool,
        studentId: safeStudentId,
        imageFileID,
        status: 'pending',
        rejectReason: '',
        reviewedBy: '',
        reviewedAt: null,
        createdAt: new Date()
      }
    })
    await db.collection('users').doc(user._id)
      .update({ data: { campusVerifyStatus: 'pending' } }).catch(() => {})

    return ok({ requestId: addRes._id, message: '已提交，管理员审核通过后即完成认证' })
  }

  throw new AppError('未知操作', 'INVALID_PARAM')
})
