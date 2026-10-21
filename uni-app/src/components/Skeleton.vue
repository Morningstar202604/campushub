<template>
  <view class="sk-wrap" :class="{ 'sk-wrap--card': card }">
    <view v-for="i in rows" :key="i" class="sk-row">
      <view v-if="avatar" class="sk-avatar sk-shimmer"></view>
      <view class="sk-lines">
        <view class="sk-line sk-shimmer" :style="{ width: lineWidth(i, 0) }"></view>
        <view class="sk-line sk-shimmer" :style="{ width: lineWidth(i, 1) }"></view>
        <view
          v-if="i % 2 === 0"
          class="sk-line sk-shimmer"
          :style="{ width: lineWidth(i, 2) }"
        ></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 骨架屏。
 *
 * 为什么需要：全站此前零骨架，弱网首屏要么白屏、要么只有一行 "LOADING" 文字，
 * 用户无法判断是在加载还是坏了。骨架屏给出结构预期，感知等待更短。
 *
 * 用法：<Skeleton :rows="3" avatar />（列表） / <Skeleton :rows="2" card />（详情）
 */
withDefaults(
  defineProps<{
    rows?: number
    avatar?: boolean
    card?: boolean
  }>(),
  { rows: 3, avatar: false, card: false }
)

/** 每行宽度做点随机，避免整齐方块看起来像表格 */
function lineWidth(row: number, line: number): string {
  const table = [
    ['72%', '94%', '58%'],
    ['64%', '88%', '46%'],
    ['80%', '91%', '52%']
  ]
  return table[row % table.length][line % 3]
}
</script>

<style lang="scss" scoped>
.sk-wrap {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}
.sk-wrap--card {
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  margin: 20rpx 32rpx;
}

.sk-row {
  display: flex;
  gap: 20rpx;
  align-items: flex-start;
}
.sk-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--radius-sharp);
  flex-shrink: 0;
  background: var(--bg-elevated);
}
.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.sk-line {
  height: 24rpx;
  border-radius: 4rpx;
  background: var(--bg-elevated);
}

/* 微光扫过：只在支持动画时启用，尊重 reduce-motion */
.sk-shimmer {
  position: relative;
  overflow: hidden;
}
.sk-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(200, 241, 53, 0.06), transparent);
  transform: translateX(-100%);
  animation: sk-slide 1.4s infinite;
}
@keyframes sk-slide {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk-shimmer::after {
    animation: none;
  }
}
</style>
