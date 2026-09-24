/**
 * 业务路由已全部静态注册于 src/router/modules/business.ts，
 * 此处不再从后端拉取动态路由（原 mock 接口），登录后直接可用。
 */
export const getAsyncRoutes = () => {
  return Promise.resolve({ success: true, data: [] });
};
