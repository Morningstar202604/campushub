// uni-app/src/config/gateway-routes.ts
// ⚠️ 自动生成，请勿手改：唯一事实来源是仓库根目录 gateway-routes.json（npm run gen:gateways）
// 页面层继续用原函数名调用 callFunction；本表只决定"这个入口落在哪个云函数上"。
// useGateway=false 时全部走原名直连 —— 灰度与回滚开关，无需回滚代码。

export const USE_GATEWAY = true

/** 原函数名 → 实际部署的云函数名（等于原名时为直连） */
export const GATEWAY_ROUTES: Record<string, string> = {
  admin: 'api-admin',
  'admin-stats': 'api-admin',
  announcement: 'api-admin',
  'backup-db': 'backup-db',
  block: 'api-social',
  'category-list': 'api-admin',
  'category-manage': 'api-admin',
  checkin: 'api-social',
  collect: 'api-social',
  'comment-create': 'api-comment',
  'comment-delete': 'api-comment',
  'comment-list': 'api-comment',
  'content-restore': 'api-admin',
  'feedback-create': 'api-admin',
  follow: 'api-social',
  'guide-detail': 'api-content',
  'guide-list': 'api-content',
  'init-db': 'init-db',
  like: 'api-social',
  login: 'api-auth',
  message: 'api-social',
  'my-list': 'api-post',
  notification: 'api-social',
  points: 'api-social',
  'post-create': 'api-post',
  'post-delete': 'api-post',
  'post-detail': 'api-post',
  'post-list': 'api-post',
  'post-related': 'api-post',
  'post-update': 'api-post',
  'product-create': 'api-product',
  'product-delete': 'api-product',
  'product-detail': 'api-product',
  'product-list': 'api-product',
  'product-update': 'api-product',
  report: 'api-admin',
  resolve: 'api-post',
  'revision-list': 'api-post',
  search: 'api-content',
  'task-expire': 'task-expire',
  'user-profile': 'api-auth',
  'user-update': 'api-auth',
  verify: 'api-auth',
  'word-manage': 'api-admin'
}

export function resolveTarget(name: string): string {
  if (!USE_GATEWAY) return name
  return GATEWAY_ROUTES[name] || name
}

/** 命中网关时注入 fn，让网关知道要分发给哪个 handler；直连时保持原样 */
export function buildPayload(name: string, data: any): any {
  const target = resolveTarget(name)
  if (target === name) return data || {}
  return { ...(data || {}), fn: name }
}
