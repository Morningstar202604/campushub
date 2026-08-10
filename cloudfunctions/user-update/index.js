// cloudfunctions/user-update/index.js
// 更新个人资料：仅允许本人修改 + 资料内容安全
// 写操作统一经 requireActiveUser，封禁用户不可修改资料
const { getDB, AppError, ok, wrap, requireActiveUser, checkContents } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { nickname, avatar, bio, college, major, grade, gender, tags } = event

  const updateData = {}
  if (nickname !== undefined) updateData.nickname = String(nickname).slice(0, 20)
  if (avatar !== undefined) updateData.avatar = avatar
  if (bio !== undefined) updateData.bio = String(bio).slice(0, 100)
  if (college !== undefined) updateData.college = college
  if (major !== undefined) updateData.major = major
  if (grade !== undefined) updateData.grade = grade
  if (gender !== undefined) updateData.gender = gender
  if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags.slice(0, 10) : tags

  // 资料内容安全（昵称/简介/标签可能含违规词）
  await checkContents(
    [updateData.nickname, updateData.bio, Array.isArray(updateData.tags) ? updateData.tags.join(' ') : ''],
    { openid: user.openid, scene: 1 }
  )

  if (Object.keys(updateData).length === 0) {
    throw new AppError('没有需要更新的字段', 'INVALID_PARAM')
  }
  updateData.updatedAt = new Date()

  // 仅本人可改：where 条件锁定 openid，杜绝越权改他人
  await db.collection('users').where({ openid: user.openid }).update({ data: updateData })

  const updated = await db.collection('users').doc(user._id).get()
  return ok({ user: updated.data })
})
