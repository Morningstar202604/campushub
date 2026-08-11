// cloudfunctions/checkin/index.js
// 每日签到：连续签到 + 积分奖励
// 每天只能签到一次，连续签到天数递增（断签重置为 1）
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser } = require('./common-bundle')

function getTodayStr() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const today = getTodayStr()
  const yesterday = getYesterdayStr()

  // 检查今天是否已签到
  const todayCheckin = await db.collection('checkins')
    .where({ userId: user._id, date: today })
    .count()
  if (todayCheckin.total > 0) throw new AppError('今天已经签到过了', 'ALREADY')

  // 计算连续天数
  const lastStreak = user.checkinStreak || 0
  const lastDate = user.lastCheckinDate || ''
  let newStreak = 1
  if (lastDate === yesterday) {
    newStreak = lastStreak + 1
  }

  // 积分奖励：基础 1 分 + 连续签到加成（每 7 天多 5 分）
  const bonus = Math.floor(newStreak / 7) * 5
  const points = 1 + bonus

  // 写入签到记录
  await db.collection('checkins').add({
    data: {
      userId: user._id,
      date: today,
      streak: newStreak,
      points,
      createdAt: new Date()
    }
  })

  // 更新用户签到状态 + 积分
  await db.collection('users').doc(user._id).update({
    data: {
      checkinStreak: newStreak,
      lastCheckinDate: today,
      creditScore: _.inc(points)
    }
  })

  return ok({
    date: today,
    streak: newStreak,
    points,
    totalPoints: (user.creditScore || 100) + points,
    message: newStreak >= 7 ? `连续签到${newStreak}天，奖励${points}积分！` : `签到成功，获得${points}积分`
  })
})
