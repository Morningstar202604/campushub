<template>
  <router-view v-slot="{ Component }">
    <transition name="page-fade" mode="out-in">
      <component :is="Component" :key="$route.fullPath" />
    </transition>
  </router-view>
  <!-- 仅一级 tab 页面显示底部导航 -->
  <van-tabbar v-if="$route.meta.tab" route safe-area-inset-bottom>
    <van-tabbar-item replace to="/" icon="home-o">首页</van-tabbar-item>
    <van-tabbar-item replace to="/market" icon="shopping-cart-o">市集</van-tabbar-item>
    <van-tabbar-item replace to="/publish" class="tab-publish">
      <template #icon>
        <div class="publish-btn"><van-icon name="plus" size="22" color="#fff" /></div>
      </template>
      发布
    </van-tabbar-item>
    <van-tabbar-item replace to="/messages" icon="chat-o">消息</van-tabbar-item>
    <van-tabbar-item replace to="/profile" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

onMounted(() => {
  const app = useAppStore()
  app.loadCategories()
  app.loadAnnouncements()
})
</script>

<style>
.tab-publish .van-tabbar-item__icon { margin-bottom: 0 !important; }
.publish-btn {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--app-primary);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(43, 124, 246, 0.35);
  margin-top: -14px;
}

/* 页面切换过渡（轻量淡入 + 轻微位移，避免廉价缩放） */
.page-fade-enter-active, .page-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.page-fade-enter-from { opacity: 0; transform: translateY(6px); }
.page-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
