<template>
  <view class="ck-page">
    <!-- 顶部统计 -->
    <view class="ck-head">
      <text class="ck-kicker">DAILY CHECK-IN</text>
      <text class="ck-sub">每天一次，连续 7 天额外奖励 5 积分</text>
    </view>

    <!-- 主卡片 -->
    <view class="ck-card" :class="{ 'ck-card-done': done }">
      <view class="ck-card-top">
        <text class="ck-date">{{ today }}</text>
        <text class="ck-streak" v-if="streak">STREAK {{ streak }} 天</text>
      </view>

      <view class="ck-center" @click="doCheckin">
        <view v-if="done" class="ck-done-ring">
          <text class="ck-done-check">✓</text>
        </view>
        <view v-else class="ck-pulse">
          <text class="ck-pulse-text">{{ busy ? '...' : 'TAP' }}</text>
        </view>
        <text class="ck-cta" v-if="done">今日已签到</text>
        <text class="ck-cta" v-else-if="busy">签到中…</text>
        <text class="ck-cta" v-else>点击签到</text>
      </view>

      <view class="ck-points">
        <text class="ck-points-label">POINTS</text>
        <text class="ck-points-num">{{ creditScore }}</text>
      </view>

      <!-- 7 格周历：本周 周一~周日，今天高亮 + 已签到态由后端 date/streak 推算 -->
      <view class="ck-week">
        <view
          v-for="(d, i) in week"
          :key="d.ds"
          class="ck-day"
          :class="{ 'ck-day-on': d.signed, 'ck-day-today': d.today, 'ck-day-bonus': d.bonus }"
        >
          <text class="ck-day-num">{{ d.label }}</text>
          <text v-if="d.bonus" class="ck-day-bonus-tag">+5</text>
        </view>
      </view>
      <view class="ck-legend">
        <text class="ck-legend-text">本周</text>
        <text class="ck-legend-text">今天高亮 · 实心为已签到</text>
      </view>
    </view>

    <!-- 错误提示 -->
    <view v-if="errMsg" class="ck-err">
      <text class="ck-err-text">{{ errMsg }}</text>
    </view>

    <!-- 底部：去赚积分 -->
    <button class="ck-earn" @click="gotoPoints">
      <text>去积分商城兑换</text>
      <text class="ck-earn-arrow">→</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { callFunction } from '@/utils/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const busy = ref(false)
const done = ref(false)
const streak = ref(0)
const errMsg = ref('')
const creditScore = computed(() => userStore.userInfo?.creditScore ?? 0)

// ---- 北京时间工具（云函数也按 UTC+8 计算自然日，前端必须一致，否则跨日判定错位）----
function beijingNow(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000)
}
function ymd(d: Date): string {
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0')
  )
}
const todayStr = ymd(beijingNow())

const today = computed(() => {
  const d = beijingNow()
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`
})

interface WeekCell {
  ds: string
  label: string
  signed: boolean
  today: boolean
  bonus: boolean
}
// 本周（周一起）7 格；已签到集合由后端 lastCheckinDate + streak 倒推连续区间
const week = computed<WeekCell[]>(() => {
  const b = beijingNow()
  const mondayOffset = (b.getUTCDay() + 6) % 7 // 周一=0
  const mondayMs = b.getTime() - mondayOffset * 86400000

  const signed = new Set<string>()
  const last = String(userStore.userInfo?.lastCheckinDate || '')
  const s = Number(userStore.userInfo?.checkinStreak ?? streak.value ?? 0)
  if (/^\d{4}-\d{2}-\d{2}$/.test(last) && s > 0) {
    const base = Date.parse(last + 'T00:00:00Z')
    for (let i = 0; i < s && i < 60; i++) signed.add(ymd(new Date(base - i * 86400000)))
  }

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayMs + i * 86400000)
    const ds = ymd(d)
    return { ds, label: String(d.getUTCDate()), signed: signed.has(ds), today: ds === todayStr, bonus: i === 6 }
  })
})

async function doCheckin() {
  if (done.value || busy.value) return
  busy.value = true
  errMsg.value = ''
  try {
    // 后端 checkin 无 action 参数，调用即签到；返回 ok({date, streak, points, totalPoints, message})
    const res: any = await callFunction('checkin', {})
    done.value = true
    streak.value = Number(res?.streak ?? 0)
    // 用后端返回的 totalPoints 更新本地积分（不要本地 += 猜）
    const total = Number(res?.totalPoints ?? creditScore.value)
    if (userStore.userInfo) {
      userStore.setUserInfo({
        ...userStore.userInfo,
        creditScore: total,
        checkinStreak: streak.value,
        lastCheckinDate: res?.date || todayStr
      } as any)
    } else {
      await userStore.refresh()
    }
    uni.showToast({ title: res?.message || '签到成功', icon: 'none' })
  } catch (e: any) {
    if (e?.code === 'ALREADY' || /已经签到/.test(e?.message || '')) {
      done.value = true
      uni.showToast({ title: '今天已经签到过了', icon: 'none' })
    } else {
      errMsg.value = e?.message || '签到失败，请稍后重试'
      uni.showToast({ title: errMsg.value, icon: 'none' })
    }
  } finally {
    busy.value = false
  }
}

function gotoPoints() {
  uni.navigateTo({ url: '/pages/points/points' })
}

onMounted(() => {
  // 预填：从用户文档拿连续天数 / 今日是否已签（login 返回的 user 含 checkinStreak / lastCheckinDate）
  const u: any = userStore.userInfo || {}
  streak.value = Number(u.checkinStreak ?? 0)
  done.value = String(u.lastCheckinDate || '') === todayStr
})
</script>

<style lang="scss" scoped>
.ck-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 60rpx;
}

.ck-head {
  padding: 32rpx 32rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.ck-kicker {
  font-size: 22rpx;
  letter-spacing: 4rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.ck-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.ck-card {
  margin: 16rpx 32rpx;
  border: 3rpx solid var(--border);
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
  background: var(--bg-deep);
  padding: 32rpx;
}
.ck-card-done {
  border-color: var(--border);
}
.ck-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32rpx;
}
.ck-date {
  font-size: 26rpx;
  color: var(--text-body);
  font-weight: 400;
}
.ck-streak {
  font-size: 22rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
  background: var(--bg-elevated);
  padding: 4rpx 14rpx;
}

.ck-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0 32rpx;
}
.ck-done-ring {
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}
.ck-done-check {
  font-size: 64rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
.ck-pulse {
  width: 120rpx;
  height: 120rpx;
  border: 4rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  animation: ck-pulse 1.2s ease-in-out infinite;
}
.ck-pulse-text {
  font-size: 28rpx;
  color: var(--text-primary);
  font-weight: var(--fw-title);
  letter-spacing: 4rpx;
}
@keyframes ck-pulse {
  0%, 100% { border-color: var(--accent-dim); }
  50% { border-color: var(--border); }
}
.ck-cta {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.ck-points {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  justify-content: center;
  margin: 8rpx 0 28rpx;
}
.ck-points-label {
  font-size: 22rpx;
  letter-spacing: 2rpx;
  color: var(--text-tertiary);
  font-weight: var(--fw-title);
}
.ck-points-num {
  font-size: 56rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}

.ck-week {
  display: flex;
  gap: 12rpx;
  justify-content: space-between;
}
.ck-day {
  flex: 1;
  height: 80rpx;
  border: 3rpx solid var(--border);
  background: var(--bg-page);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}
.ck-day-on {
  background: var(--accent);
  border-color: var(--accent);
}
.ck-day-on .ck-day-num {
  color: #0D110E;
}
.ck-day-today {
  border-color: var(--accent);
}
.ck-day-bonus {
  border-color: var(--warning);
}
.ck-day-num {
  font-size: 26rpx;
  color: var(--text-body);
  font-weight: var(--fw-title);
}
.ck-day-bonus-tag {
  position: absolute;
  top: -14rpx;
  right: -8rpx;
  font-size: 18rpx;
  color: var(--warning);
  background: var(--bg-deep);
  padding: 2rpx 8rpx;
  font-weight: var(--fw-title);
}
.ck-legend {
  display: flex;
  justify-content: space-between;
  margin-top: 16rpx;
}
.ck-legend-text {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.ck-err {
  margin: 8rpx 32rpx;
  text-align: center;
}
.ck-err-text {
  font-size: 24rpx;
  color: var(--danger);
}

.ck-earn {
  margin: 40rpx 32rpx 0;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 28rpx;
  font-weight: var(--fw-title);
  border: 3rpx solid var(--border);
  height: 88rpx;
  line-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.ck-earn-arrow {
  font-size: 32rpx;
}
</style>
