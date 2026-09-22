// uni-app 应用入口
//
// 修复记录（全量优化）：
//   1. 原实现是纯 Vue SPA 写法（createApp + app.mount('#app')），uni-app 不认这个入口，
//     必须导出 createApp() 工厂并返回 { app, Pinia }，否则 onLaunch 不触发、页面拿不到 pinia。
//   2. 原实现完全缺少 wx.cloud.init —— 小程序端任何 wx.cloud.callFunction 都会直接抛
//      「Cloud API isn't enabled」，即 20 个页面对应的全部云函数在小程序端集体失效。
//
// 条件编译说明：init 只在 MP-WEIXIN 下执行；H5/App 端走 utils/api.ts 的 REST 通道，
// 不需要也不应该调用 wx.cloud。

import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import schoolConfig from '@/config/school.config.js'

// #ifdef MP-WEIXIN
// env 为空时退化为「使用当前默认环境」，避免未配置 school.config.js 时直接抛错中断启动
// @ts-ignore wx 由 @dcloudio/uni-mp-weixin 在小程序运行时注入全局
if (typeof wx !== 'undefined' && wx.cloud) {
  // @ts-ignore
  wx.cloud.init({
    ...(schoolConfig && schoolConfig.envId ? { env: schoolConfig.envId } : {}),
    traceUser: true
  })
}
// #endif

export function createApp() {
  const app = createSSRApp(App)
  const pinia = Pinia.createPinia()
  pinia.use(piniaPluginPersistedstate)
  app.use(pinia)
  // uni-app 要求把 Pinia 实例一并返回（分包/SSR 场景需复用同一实例）
  return { app, Pinia }
}
