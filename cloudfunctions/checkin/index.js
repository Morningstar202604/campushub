// cloudfunctions/checkin/index.js
// 每日签到：连续签到 + 积分奖励
// 每天只能签到一次，连续签到天数递增（断签重置为 1）。
// 时区：云函数默认 UTC，这里统一按北京时间（UTC+8）计算自然日，
// 否则北京时间 0~8 点的签到会被记到"昨天"，同一天可领两次积分。
// 幂等：依赖 idx_checkins_user_date 唯一索引 + insertIdempotent，并发双签只有一次生效。
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser, insertIdempotent } = require('./common-bundle')

// 返回北京时间的 YYYY-MM-DD；offsetDays 可为负（取昨天等）
function getBeijingDateStr(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000)
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0')
}

exports.main = wrap(async (event) => {
  const user = await requireActiveUser()
  const db = getDB()
  const _ = getCmd()

  const today = getBeijingDateStr(0)
  const yesterday = getBeijingDateStr(-1)

  // 快速路径检查今天是否已签到
  const todayCheckin = await db.collection('checkins')
    .where({ userId: user._id, date: today })
    .count()
  if (todayCheckin.total > 0) throw new AppError('今天已经签到过了', 'ALREADY')

  // 计算连续天数：昨天签过 → +1；否则（含异常的"今天已更新过用户文档"）保持或重置为 1
  const lastStreak = user.checkinStreak || 0
  const lastDate = user.lastCheckinDate || ''
  let newStreak = 1
  if (lastDate === yesterday) {
    newStreak = lastStreak + 1
  } else if (lastDate === today) {
    newStreak = Math.max(1, lastStreak)
  }

  // 积分奖励：基础 1 分 + 连续签到加成（每 7 天多 5 分）
  const bonus = Math.floor(newStreak / 7) * 5
  const points = 1 + bonus

  // 幂等写入签到记录：唯一索引冲突 = 并发重复签到，按已签到处理（不重复发积分）
  const inserted = await insertIdempotent('checkins', {
    userId: user._id,
    date: today,
    streak: newStreak,
    points,
    createdAt: new Date()
  })
  if (!inserted) throw new AppError('今天已经签到过了', 'ALREADY')

  // 更新用户签到状态 + 积分（仅在记录首次落库后执行）
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
