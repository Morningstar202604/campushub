<template>
  <router-view />
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
import { isConfigured } from '@/lib/supabase'

onMounted(() => {
  if (!isConfigured) {
    console.warn('[CampusHub] Supabase 未配置，请复制 .env.example 为 .env 并填写 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }
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
</style>
