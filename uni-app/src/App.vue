<template>
  <view class="app-root">
    <!-- 应用级内容通过 pages 渲染；App.vue 只做全局初始化 -->
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useSchoolStore } from '@/stores/school'

onLaunch(() => {
  const userStore = useUserStore()
  const schoolStore = useSchoolStore()
  // 同步加载多校配置（envId/restToken）—— 必须早于 restore()，login 云函数依赖 envId。
  // 原实现写 `await schoolStore.load()`，但 load 当时是动态 import 且不返回 Promise，
  // await 一个 undefined 不会真等待，envId 仍为空串 → 首启 login 必失败。现 load 已改为同步。
  schoolStore.load()
  // 恢复登录态：内部 catch 全部异常并静默降级，不阻塞首屏渲染（无需 await）
  userStore.restore()
  console.log('[CampusHub] 墨荧 · Acid Campus launched', {
    envId: schoolStore.envId || '(未配置)',
    logged: userStore.isLoggedIn
  })
})

onShow(() => {})
onHide(() => {})
</script>

<style lang="scss">
/* 全局样式唯一入口：App.vue 的 style 是全局作用域，只在这里 @import 一次。
   页面组件不要再各自引入 —— 变量经 :root 继承即可全局使用。 */
@import '@/styles/tokens.scss';
@import '@/styles/global.scss';
</style>
