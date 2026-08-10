// cloudfunctions/admin/index.js
// 管理员操作：封禁/解封用户。让"封禁"机制真正生效（原实现无入口，形同死代码）。
// 管理员识别优先级：① 云函数环境变量 ADMIN_OPENIDS（逗号分隔）
//                    ② 数据库 config 集合 doc('global').adminOpenids 数组
// 部署后请至少在云函数环境变量中配置管理员 openid。
const { getDB, AppError, ok, wrap, getOpenid } = require('./common-bundle')

exports.main = wrap(async (event) => {
  const db = getDB()
  const operatorOpenid = await getOpenid()

  // 校验管理员身份
  let isAdmin = false
  const envAdmins = (process.env.ADMIN_OPENIDS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (envAdmins.includes(operatorOpenid)) isAdmin = true

  if (!isAdmin) {
    const cfgRes = await db.collection('config').doc('global').get().catch(() => ({ data: null }))
    if (cfgRes && cfgRes.data && Array.isArray(cfgRes.data.adminOpenids) && cfgRes.data.adminOpenids.includes(operatorOpenid)) {
      isAdmin = true
    }
  }
  if (!isAdmin) throw new AppError('无权限执行该操作', 'FORBIDDEN')

  const { action, targetOpenid } = event
  if (!targetOpenid) throw new AppError('缺少目标用户openid', 'INVALID_PARAM')
  if (!['ban', 'unban'].includes(action)) throw new AppError('未知操作', 'INVALID_PARAM')

  const status = action === 'ban' ? 'banned' : 'unverified'
  const res = await db.collection('users').where({ openid: targetOpenid }).update({ data: { verifyStatus: status, updatedAt: new Date() } })

  return ok({ action, targetOpenid, updated: res.stats ? res.stats.updated : undefined })
})
