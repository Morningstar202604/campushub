// cloudfunctions/api-product/index.js
// ⚠️ 自动生成，请勿手改：唯一事实来源是仓库根目录 gateway-routes.json
//    改路由表后执行 npm run gen:gateways；手改会被 npm run gate 的 --check 拦下。
//
// 网关只做三件事：按 event.fn 分发、拒绝未登记的 fn、把请求原样交给 handler。
// 鉴权 / 限频 / 内容安全全部留在各 handler 内部 —— 收敛部署单元不等于收敛校验点。
// 客户端直连网关，getWXContext().OPENID 仍是真实用户身份（不经云函数转发，不存在身份丢失）。
const { fail } = require('./common-bundle')

const HANDLERS = {
  'product-create': require('./handlers/product-create'),
  'product-delete': require('./handlers/product-delete'),
  'product-detail': require('./handlers/product-detail'),
  'product-list': require('./handlers/product-list'),
  'product-update': require('./handlers/product-update')
}

exports.main = async (event, context) => {
  const fn = event && event.fn
  const handler = typeof fn === 'string' ? HANDLERS[fn] : undefined
  if (!handler) {
    // 明确错误码：前端可据此区分"调用方传错"与"服务异常"
    return fail('不支持的操作', 'UNKNOWN_FUNCTION')
  }
  return handler(event, context)
}
