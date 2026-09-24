<template>
  <div class="page">
    <van-nav-bar title="签到打卡" fixed placeholder left-arrow @click-left="router.back()" />

    <div class="card checkin-card">
      <div class="streak-num">{{ auth.profile?.checkin_streak ?? 0 }}</div>
      <div class="streak-label">连续签到天数</div>
      <div class="streak-tip">每连续签到 7 天，额外奖励 5 积分</div>
      <van-button
        type="primary" round block :loading="submitting"
        :disabled="todayChecked"
        style="margin-top: 16px"
        @click="onCheckin"
      >{{ todayChecked ? '今天已签到' : '立即签到 +1 积分' }}</van-button>
      <div class="points-line">当前积分：<b>{{ auth.profile?.points ?? 0 }}</b></div>
    </div>

    <div class="card">
      <div class="his-title">最近签到</div>
      <div v-if="!history.length" class="his-empty">还没有签到记录</div>
      <div v-for="h in history" :key="h.id" class="his-item">
        <span>{{ h.date }}</span>
        <span>连续 {{ h.streak }} 天</span>
        <span class="his-points">+{{ h.points }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useAuthStore } from '@/stores/auth'
import { doCheckin, myCheckins } from '@/api/misc'

const router = useRouter()
const auth = useAuthStore()
const submitting = ref(false)
const history = ref<{ id: string; date: string; streak: number; points: number }[]>([])
const todayChecked = ref(false)

onMounted(async () => {
  try {
    history.value = await myCheckins()
    const today = new Date().toISOString().slice(0, 10)
    todayChecked.value = history.value.some(h => h.date === today)
  } catch { /* 忽略 */ }
})

async function onCheckin() {
  submitting.value = true
  try {
    const res = await doCheckin()
    todayChecked.value = true
    await auth.fetchProfile()
    showSuccessToast(`签到成功！连续 ${res.streak} 天，+${res.points} 积分`)
    history.value = await myCheckins()
  } catch (e: any) {
    if (/已经签到/.test(e?.message || '')) todayChecked.value = true
    showFailToast(e?.message || '签到失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.checkin-card { text-align: center; padding: 28px 16px; }
.streak-num { font-size: 56px; font-weight: 800; color: var(--app-primary); line-height: 1; }
.streak-label { font-size: 14px; color: #66707f; margin-top: 6px; }
.streak-tip { font-size: 12px; color: #9aa3b2; margin-top: 6px; }
.points-line { margin-top: 14px; font-size: 13px; color: #66707f; }
.his-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.his-empty { text-align: center; color: #9aa3b2; font-size: 13px; padding: 16px 0; }
.his-item { display: flex; justify-content: space-between; font-size: 13px; padding: 10px 0; border-top: 1px solid #f2f3f5; }
.his-points { color: #f6a02b; font-weight: 600; }
</style>
