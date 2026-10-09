<template>
  <view class="pt-page">
    <view class="pt-head">
      <text class="empty-kicker">POINTS SHOP</text>
      <text class="pt-sub">签到攒积分 · 兑换权益</text>
    </view>

    <!-- 余额卡 -->
    <view class="pt-balance">
      <view class="pt-balance-label">当前积分</view>
      <view class="pt-balance-num accent-num">{{ creditScore }}</view>
      <view v-if="renameTokens" class="pt-balance-sub">持有改名卡 × {{ renameTokens }}</view>
    </view>

    <!-- 道具列表 -->
    <view class="pt-list">
      <view v-for="p in products" :key="p.id" class="pt-item sticker">
        <view class="pt-item-icon"></view>
        <view class="pt-item-body">
          <view class="pt-item-name">{{ p.name }}</view>
          <view class="pt-item-desc">{{ p.desc }}</view>
        </view>
        <view class="pt-item-right">
          <view class="pt-item-price">
            <text class="pt-item-price-num">{{ p.price }}</text>
            <text class="pt-item-price-unit"> 分</text>
          </view>
          <button
            class="pt-item-btn press hard-border"
            :class="{ 'pt-item-btn-off': creditScore < p.price }"
            :disabled="creditScore < p.price || redeeming"
            @click="redeem(p)"
          >
            兑换
          </button>
        </view>
      </view>

      <view v-if="!products.length && !loading" class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">POINTS SHOP</text>
        <text class="empty-title">暂无可兑换道具</text>
        <text class="empty-sub">签到攒积分，兑换权益</text>
      </view>
    </view>

    <!-- 签到提示 -->
    <view class="pt-tip">
      <text class="pt-tip-text">积分不足？</text>
      <text class="pt-tip-link press" @click="gotoCheckin">去签到 →</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { callFunction } from '@/utils/api'
import { useUserStore } from '@/stores/user'

interface PointProduct {
  id: string
  name: string
  price: number
  desc: string
}

const userStore = useUserStore()
const products = ref<PointProduct[]>([])
const creditScore = ref(0)
const renameTokens = ref(0)
const loading = ref(true)
const redeeming = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await callFunction('points', { action: 'products' })
    products.value = (res?.products ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      desc: p.desc
    }))
    creditScore.value = res?.creditScore ?? 0
    renameTokens.value = res?.renameTokens ?? 0
    syncStore({ creditScore: creditScore.value })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 把最新积分 / 改名卡同步回登录态（其他页面头部会立即反映）
function syncStore(patch: Record<string, unknown>) {
  if (userStore.userInfo) userStore.setUserInfo({ ...userStore.userInfo, ...patch } as any)
}

async function redeem(p: PointProduct) {
  if (redeeming.value) return
  if (creditScore.value < p.price) {
    uni.showToast({ title: '积分不足，去签到赚积分吧', icon: 'none' })
    return
  }
  redeeming.value = true
  try {
    // 后端 redeem → ok({redeemed:true, productId, creditScore})，creditScore 为扣减后的真实余额
    const res: any = await callFunction('points', { action: 'redeem', productId: p.id })
    creditScore.value = res?.creditScore ?? creditScore.value
    renameTokens.value += 1
    syncStore({ creditScore: creditScore.value })
    uni.showToast({ title: '兑换成功', icon: 'success' })
    load()
  } catch (e: any) {
    // 按后端 error code 分支给不同文案
    const msg =
      e?.code === 'INSUFFICIENT_POINTS'
        ? '积分不足，继续签到赚积分吧'
        : e?.message || '兑换失败，请稍后重试'
    uni.showToast({ title: msg, icon: 'none' })
    if (e?.code === 'INSUFFICIENT_POINTS') load()
  } finally {
    redeeming.value = false
  }
}

function gotoCheckin() {
  uni.navigateTo({ url: '/pages/checkin/checkin' })
}

onMounted(load)
</script>

<style lang="scss" scoped>
.pt-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 60rpx;
}

.pt-head {
  padding: 32rpx 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.pt-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.pt-balance {
  margin: 16rpx 32rpx;
  border: 3rpx solid var(--border);
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
  background: var(--bg-deep);
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.pt-balance-label {
  font-size: 22rpx;
  color: var(--text-tertiary);
  font-weight: 400;
}
.pt-balance-num {
  font-size: 72rpx;
  line-height: 1;
}
.pt-balance-sub {
  font-size: 22rpx;
  color: var(--warning);
}

.pt-list {
  padding: 8rpx 32rpx;
}
.pt-item {
  display: flex;
  align-items: center;
  background: var(--bg-deep);
  padding: 28rpx;
  margin-bottom: 20rpx;
}
.pt-item-icon {
  width: 56rpx;
  height: 56rpx;
  clip-path: var(--clip-diamond);
  background: var(--bg-elevated);
  border: 2rpx solid var(--border);
  flex-shrink: 0;
}
.pt-item-body {
  flex: 1;
  margin-left: 24rpx;
  overflow: hidden;
}
.pt-item-name {
  font-size: 30rpx;
  font-weight: var(--fw-title);
  color: var(--text-body);
}
.pt-item-desc {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.5;
}
.pt-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}
.pt-item-price-num {
  font-size: 32rpx;
  color: var(--text-primary);
  font-weight: var(--fw-title);
  font-variant-numeric: tabular-nums;
}
.pt-item-price-unit {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.pt-item-btn {
  background: var(--bg-elevated);
  color: var(--text-body);
  font-size: 24rpx;
  font-weight: var(--fw-title);
  padding: 0 28rpx;
  height: 56rpx;
  line-height: 56rpx;
}
.pt-item-btn-off {
  color: var(--text-tertiary);
}
.pt-item-btn[disabled] {
  opacity: 0.6;
}

.pt-tip {
  margin: 40rpx 32rpx;
  text-align: center;
}
.pt-tip-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}
.pt-tip-link {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
  margin-left: 12rpx;
}
</style>
