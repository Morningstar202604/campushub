// cloudfunctions/user-update/index.js
// 更新个人资料：仅允许本人修改 + 资料内容安全 + 头像图片安全审核
// 写操作统一经 requireActiveUser，封禁用户不可修改资料
const { getDB, AppError, ok, wrap, requireActiveUser, checkContents, checkImage } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()

  const { nickname, avatar, bio, college, major, grade, gender, tags } = event

  const updateData = {}
  if (nickname !== undefined) updateData.nickname = String(nickname).trim().slice(0, 20)
  if (avatar !== undefined) {
    // 头像必须是本云存储文件且过图片安全审核（fail-closed，拒绝外链/垃圾值）
    if (!avatar || typeof avatar !== 'string' || !avatar.startsWith('cloud://')) {
      throw new AppError('头像仅支持上传到云存储的图片', 'INVALID_PARAM')
    }
    await checkImage({ fileID: avatar, openid: user.openid })
    updateData.avatar = avatar
  }
  if (bio !== undefined) updateData.bio = String(bio).slice(0, 100)
  // college/major/grade 公开展示在主页，与昵称/简介同等送内容安全检测
  if (college !== undefined) updateData.college = String(college).trim().slice(0, 50)
  if (major !== undefined) updateData.major = String(major).trim().slice(0, 50)
  if (grade !== undefined) updateData.grade = String(grade).trim().slice(0, 20)
  // gender 白名单：0=保密 1=男 2=女
  if (gender !== undefined) {
    const g = Number(gender)
    if (![0, 1, 2].includes(g)) throw new AppError('非法的性别取值', 'INVALID_PARAM')
    updateData.gender = g
  }
  if (tags !== undefined) {
    // 强制转为数组，每项限长 20，最多 10 个
    const tagArr = Array.isArray(tags) ? tags : String(tags).split(/[,，]/).map(t => t.trim()).filter(Boolean)
    updateData.tags = tagArr.slice(0, 10).map(t => String(t).slice(0, 20))
  }

  // 资料内容安全（昵称/简介/院系/专业/年级/标签，全部公开展示）
  await checkContents(
    [updateData.nickname, updateData.bio, updateData.college, updateData.major, updateData.grade,
     Array.isArray(updateData.tags) ? updateData.tags.join(' ') : ''],
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
