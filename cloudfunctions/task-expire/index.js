// cloudfunctions/task-expire/index.js
// 定时任务：将超时未解决的任务/请求帖置为 expired
// （不推主页、进「过期」页；已解决的不进过期页）
// 配套 config.json 定时触发器，建议每小时执行一次。
const { getDB, getCmd, ok, wrap } = require('./common-bundle')

exports.main = wrap(async () => {
  const db = getDB()
  const _ = getCmd()
  const now = new Date()

  const res = await db.collection('posts')
    .where({
      kind: 'task',
      status: 'normal',
      expireAt: _.lt(now)
    })
    .limit(100)
    .get()

  const list = res.data || []
  for (const p of list) {
    await db.collection('posts').doc(p._id).update({
      data: { status: 'expired', expiredAt: now }
    })
  }
  return ok({ checked: list.length, expired: list.length })
})
