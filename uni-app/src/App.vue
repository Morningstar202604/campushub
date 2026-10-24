<template>
  <view v-if="!appReady" class="app-boot">
    <text class="app-boot-title">CAMPUSHUB</text>
    <view class="app-boot-bar"><view class="app-boot-bar-fill"></view></view>
  </view>
  <view v-else class="app-root">
    <!-- 应用级内容通过 pages 渲染；App.vue 只做全局初始化 -->
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { onErrorCaptured, ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useSchoolStore } from '@/stores/school'
import { initCloudSdk } from '@/utils/api'
import { useTheme } from '@/composables/use-theme'
import { initNetworkWatcher } from '@/composables/use-network'
import { initUpdateCheck, initPrivacyGuard } from '@/composables/use-app-guard'

// 全局错误捕获 — 避免白屏
onErrorCaptured((err, instance, info) => {
  console.error('[App] 未捕获异常:', err, info)
  uni.showToast({ title: '页面异常，请重试', icon: 'none' })
  return false // 阻止错误继续向上传播
})

const appReady = ref(false)

onMounted(async () => {
  try {
    const userStore = useUserStore()
    await userStore.restore?.().catch(() => {})
  } catch (e) {
    console.warn('[App] 启动失败:', e)
  } finally {
    appReady.value = true
  }
})

onLaunch(() => {
  const userStore = useUserStore()
  const schoolStore = useSchoolStore()
  // 主题：必须在首屏渲染前应用，否则浅色用户会先看到一帧深色
  useTheme()
  // 网络状态：全局只提示一次，避免每个页面各弹一个「网络失败」
  initNetworkWatcher()
  // 小程序：版本更新提示 + 隐私授权弹窗（合规必需，缺了真机会被拒接口）
  initUpdateCheck()
  initPrivacyGuard()
  // 同步加载多校配置（envId/restToken）—— 必须早于 restore()，login 云函数依赖 envId。
  schoolStore.load()
  // 恢复登录态：内部 catch 全部异常并静默降级，不阻塞首屏渲染（无需 await）
  userStore.restore()
  // 预热 H5/App 端 CloudBase SDK（图片/存储能力，失败静默）
  initCloudSdk()
  console.log('[CampusHub] 墨荧 · Acid Campus launched', {
    envId: schoolStore.envId || '(未配置)',
    logged: userStore.isLoggedIn
  })
})

onShow(() => {
  // 每次回到前台：刷新未读通知数 → 同步 Tab 角标（小程序端）
  const userStore = useUserStore()
  if (userStore.isLoggedIn) {
    userStore.refreshUnreadCount()
  }
})

onHide(() => {})
</script>

<style lang="scss">
/* 全局样式唯一入口：App.vue 的 style 是全局作用域，只在这里 @import 一次。
   页面组件不要再各自引入 —— 变量经 :root 继承即可全局使用。 */
@import '@/styles/tokens.scss';
@import '@/styles/global.scss';

.app-boot {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  gap: var(--sp-4);
}
.app-boot-title {
  font-size: 48rpx;
  font-weight: var(--fw-title);
  letter-spacing: 8rpx;
  color: var(--accent);
}
.app-boot-bar {
  width: 200rpx;
  height: 4rpx;
  background: var(--bg-elevated);
  border-radius: 2rpx;
  overflow: hidden;
}
.app-boot-bar-fill {
  height: 100%;
  background: var(--accent);
  animation: boot-progress 1.5s var(--ease-snap) infinite;
}
@keyframes boot-progress {
  0% {
    width: 0%;
  }
  50% {
    width: 70%;
  }
  100% {
    width: 100%;
  }
}
</style>
