<template>
  <div class="page">
    <van-nav-bar title="消息" fixed placeholder>
      <template #right>
        <span v-if="hasUnread" class="read-all" @click="onReadAll">全部已读</span>
      </template>
    </van-nav-bar>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="!list.length && !loading" style="padding-top: 40px">
        <van-empty description="暂无消息" />
      </div>
      <div v-for="n in list" :key="n.id" class="noti-card" @click="onTap(n)">
        <div class="noti-icon" :style="{ background: iconBg(n.type) }">
          <van-icon :name="iconName(n.type)" color="#fff" size="18" />
        </div>
        <div class="noti-body">
          <div class="noti-content">{{ n.content }}</div>
          <div class="noti-time">{{ fmtTime(n.created_at) }}</div>
        </div>
        <span v-if="!n.is_read" class="noti-dot"></span>
      </div>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { myNotifications, markAllRead } from '@/api/misc'
import type { Notification } from '@/types'
import { fmtTime } from '@/utils/format'

const router = useRouter()
const list = ref<Notification[]>([])
const loading = ref(false)
const refreshing = ref(false)
const hasUnread = computed(() => list.value.some(n => !n.is_read))

onMounted(load)

async function load() {
  loading.value = true
  try {
    list.value = await myNotifications()
  } catch (e: any) {
    console.warn('[messages]', e?.message)
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  await load()
  refreshing.value = false
}

function iconName(type: string) {
  return { like: 'good-job-o', comment: 'chat-o', follow: 'friends-o', system: 'volume-o', report_result: 'shield-o' }[type] || 'bell-o'
}
function iconBg(type: string) {
  return { like: '#f64f7c', comment: '#2b7cf6', follow: '#8f6bf6', system: '#f6a02b', report_result: '#2e9e5b' }[type] || '#9aa3b2'
}

function onTap(n: Notification) {
  if (n.target_type === 'post' && n.target_id) router.push(`/post/${n.target_id}`)
  else if (n.target_type === 'product' && n.target_id) router.push(`/product/${n.target_id}`)
}

async function onReadAll() {
  try {
    await markAllRead()
    list.value.forEach(x => (x.is_read = true))
  } catch { /* 忽略 */ }
}
</script>

<style scoped>
.noti-card { display: flex; align-items: flex-start; gap: 12px; background: #fff; margin: 0 12px 10px; border-radius: 12px; padding: 14px; position: relative; cursor: pointer; box-shadow: 0 1px 2px rgba(28,35,48,.04); }
.read-all { font-size: 13px; color: var(--app-primary); cursor: pointer; padding: 4px 0; }
.noti-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.noti-body { flex: 1; min-width: 0; }
.noti-content { font-size: 14px; color: #1c2330; line-height: 1.5; }
.noti-time { font-size: 12px; color: #9aa3b2; margin-top: 4px; }
.noti-dot { position: absolute; top: 14px; right: 14px; width: 8px; height: 8px; border-radius: 50%; background: #f64f2b; }
</style>
