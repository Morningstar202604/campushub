// cloudfunctions/user-update/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  const { nickname, avatar, bio, college, major, grade, gender, tags } = event
  
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' }
  }
  
  const userId = userRes.data[0]._id
  const updateData = {}
  
  if (nickname !== undefined) updateData.nickname = nickname.slice(0, 20)
  if (avatar !== undefined) updateData.avatar = avatar
  if (bio !== undefined) updateData.bio = bio.slice(0, 100)
  if (college !== undefined) updateData.college = college
  if (major !== undefined) updateData.major = major
  if (grade !== undefined) updateData.grade = grade
  if (gender !== undefined) updateData.gender = gender
  if (tags !== undefined) updateData.tags = tags.slice(0, 10)
  
  updateData.updatedAt = new Date()
  
  await db.collection('users').doc(userId).update({ data: updateData })
  
  const updated = await db.collection('users').doc(userId).get()
  
  return { success: true, user: updated.data }
}
