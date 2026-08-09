// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  
  // 查询用户是否存在
  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .get()
  
  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    await db.collection('users').doc(user._id).update({
      data: { updatedAt: new Date() }
    })
    return { success: true, user }
  }
  
  // 新用户创建
  const newUser = {
    openid: wxContext.OPENID,
    nickname: '韩师同学' + Math.random().toString(36).substr(2, 6),
    avatar: '',
    school: '韩山师范学院',
    schoolId: 'HSFNC',
    college: '',
    major: '',
    grade: '',
    gender: 0,
    bio: '',
    tags: [],
    verifyStatus: 'unverified',
    creditScore: 100,
    postCount: 0,
    productCount: 0,
    followerCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const addRes = await db.collection('users').add({ data: newUser })
  newUser._id = addRes._id
  
  return { success: true, user: newUser }
}
