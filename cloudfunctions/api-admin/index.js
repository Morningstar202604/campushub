// cloudfunctions/api-admin/index.js
// ⚠️ 自动生成，请勿手改：唯一事实来源是仓库根目录 gateway-routes.json
//    改路由表后执行 npm run gen:gateways；手改会被 npm run gate 的 --check 拦下。
//
// 网关只做三件事：按 event.fn 分发、拒绝未登记的 fn、把请求原样交给 handler。
// 鉴权 / 限频 / 内容安全全部留在各 handler 内部 —— 收敛部署单元不等于收敛校验点。
// 客户端直连网关，getWXContext().OPENID 仍是真实用户身份（不经云函数转发，不存在身份丢失）。
// 跨端身份：H5/App 走 REST 时没有 OPENID，由 common-identity 用 HMAC 设备令牌解析；
// 网关负责在调用 handler 前把当前 event 绑定到身份上下文。
const { fail, bindEvent } = require('./common-bundle')

const HANDLERS = {
  admin: require('./handlers/admin'),
  announcement: require('./handlers/announcement'),
  'category-list': require('./handlers/category-list'),
  'category-manage': require('./handlers/category-manage'),
  'feedback-create': require('./handlers/feedback-create'),
  report: require('./handlers/report')
}

exports.main = async (event, context) => {
  const fn = event && event.fn
  const handler = typeof fn === 'string' ? HANDLERS[fn] : undefined
  if (!handler) {
    // 明确错误码：前端可据此区分"调用方传错"与"服务异常"
    return fail('不支持的操作', 'UNKNOWN_FUNCTION')
  }
  // 绑定当前请求：common-context 据此解析小程序 OPENID 或 H5/App 设备令牌
  bindEvent(event)
  return handler(event, context)
}
