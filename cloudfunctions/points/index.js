// cloudfunctions/points/index.js
// 积分商城（P1 积分消费闭环）
// 现状：签到积分（creditScore）只进不出，本函数提供消费出口。
//  - products：返回可兑换道具列表
//  - redeem  ：兑换道具（扣积分 + 发放权益 + 记录订单）
const { getDB, getCmd, AppError, ok, wrap, requireActiveUser } = require('./common-bundle')

// 道具目录（唯一事实来源）
const PRODUCTS = [
  { id: 'rename-token', name: '改名卡', price: 100, desc: '兑换后可在「编辑资料」再次修改昵称' }
]

exports.main = wrap(async (event) => {
  const db = getDB()
  const _ = getCmd()
  const { action = 'products' } = event
  const user = await requireActiveUser()

  if (action === 'products') {
    // 附带当前积分与已有改名卡，便于前端直接渲染
    return ok({ products: PRODUCTS, creditScore: user.creditScore || 0, renameTokens: user.renameTokens || 0 })
  }

  if (action === 'redeem') {
    const { productId } = event
    const product = PRODUCTS.find(p => p.id === productId)
    if (!product) throw new AppError('道具不存在', 'INVALID_PARAM')

    const credit = user.creditScore || 0
    if (credit < product.price) {
      throw new AppError('积分不足，继续签到赚积分吧', 'INSUFFICIENT_POINTS')
    }

    // 扣积分 + 发权益（原子更新）
    const updateRes = await db.collection('users').where({ _id: user._id, creditScore: _.gte(product.price) })
      .update({
        data: {
          creditScore: _.inc(-product.price),
          renameTokens: _.inc(1),
          updatedAt: new Date()
        }
      })
    if (!updateRes.stats || !updateRes.stats.updated) {
      throw new AppError('积分不足', 'INSUFFICIENT_POINTS')
    }

    // 记录订单（供热点审计；失败不阻断发放）
    try {
      await db.collection('points_orders').add({
        data: {
          userId: user._id,
          productId: product.id,
          productName: product.name,
          price: product.price,
          createdAt: new Date()
        }
      })
    } catch (e) { /* 静默 */ }

    return ok({ redeemed: true, productId: product.id, creditScore: credit - product.price })
  }

  throw new AppError('未知操作', 'INVALID_ACTION')
})
