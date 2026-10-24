<template>
  <z-paging
    ref="pagingRef"
    v-model="list"
    :auto="true"
    :back-to-top="true"
    @query="queryList"
    safe-area-inset-bottom
  >
    <template #top>
      <view class="page-header">
        <text class="title-900 page-title">失物招领</text>
        <view class="clip-tag sticker"><text class="page-badge">互助</text></view>
      </view>

      <scroll-view class="kf-scroll" scroll-x>
        <view
          v-for="k in kinds"
          :key="k.value"
          class="kf-chip clip-tag sticker"
          :class="{ active: k.value === activeKind }"
          @click="onKind(k.value)"
        >
          <text>{{ k.label }}</text>
        </view>
      </scroll-view>
    </template>

    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry press" @click="reload">重试</text>
    </view>

    <view
      v-for="item in list"
      :key="item.id"
      class="lost-card sticker press"
      :class="{ resolved: item.resolved }"
      @click="openDetail(item)"
    >
      <image v-if="item.image" class="lost-cover" :src="item.image" mode="aspectFill" lazy-load />
      <view class="lost-body">
        <view class="lost-title-row">
          <view class="lost-kind clip-tag" :class="item.kind">
            <text>{{ item.kind === 'found' ? '招领' : '失物' }}</text>
          </view>
          <text class="lost-title">{{ item.title }}</text>
          <text v-if="item.resolved" class="lost-resolved">已解决</text>
        </view>
        <text class="lost-content">{{ item.content }}</text>
        <text class="lost-time tabular-nums">{{ item.time }}</text>
      </view>
    </view>

    <template #empty="{ isLoadFailed }">
      <view v-if="!isLoadFailed" class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">LOST & FOUND</text>
        <text class="empty-title">暂无失物信息</text>
        <text class="empty-sub">拾金不昧，互帮互助</text>
        <view class="empty-cta press" @click="goCreate">
          <text>发布失物/招领</text>
        </view>
      </view>
    </template>
  </z-paging>
  <!-- 常驻发布入口：有数据时也要能发（旧版只有空态 CTA，列表一有内容就再无入口） -->
  <view class="page-fab sticker press" @click="goCreate()">
    <text class="page-fab-label">发布</text>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { usePagedList } from '@/composables/use-paged-list'
import { adaptLostFound } from '@/adapters'

const kinds = [
  { label: '全部', value: 'all' },
  { label: '失物', value: 'lost' },
  { label: '招领', value: 'found' }
]
const activeKind = ref('all')

// 响应式 query：'all' → 只取失物+招领两类。
// 不能省略 kind 条件（旧实现传空 = 不过滤），否则普通帖子/表白会一起出现在失物页。
const liveQuery = computed(() => {
  const q: Record<string, any> = { tab: 'latest' }
  if (activeKind.value === 'all') q.kinds = ['lost', 'found']
  else q.kind = activeKind.value
  return q
})

const { pagingRef, list, queryList, error, reload } = usePagedList({
  fnName: 'post-list',
  query: liveQuery,
  adapt: adaptLostFound
})

function onKind(v: string) {
  if (v === activeKind.value) return
  activeKind.value = v
  reload()
}

// 点卡片 → 帖子详情（失物/招领同为 post）
function openDetail(item: any) {
  // @ts-ignore
  uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${item.id}` })
}

// 空态引导 → 发布页
function goCreate() {
  // @ts-ignore
  uni.navigateTo({ url: '/pages/post-create/post-create' })
}

// 分享给好友（小程序端生效；H5/App 无害）
onShareAppMessage(() => ({
  title: 'CampusHub 失物招领 · 互帮互助',
  path: '/pages/lost-found/lost-found'
}))
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
}
.page-title {
  font-size: 40rpx;
  color: var(--text-primary);
}
.page-badge {
  padding: 6rpx 20rpx;
  font-size: 22rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  background: var(--bg-card);
}

.kf-scroll {
  white-space: nowrap;
  padding: 0 32rpx 20rpx;
  display: flex;
  gap: 16rpx;
}
.kf-chip {
  display: inline-block;
  padding: 8rpx 28rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  &.active {
    color: var(--bg-page);
    background: var(--accent);
    font-weight: var(--fw-title);
  }
}

.lost-card {
  display: flex;
  gap: 20rpx;
  margin: 20rpx 32rpx;
  padding: 20rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
  &.resolved {
    opacity: 0.55;
  }

  .lost-cover {
    width: 140rpx;
    height: 140rpx;
    border-radius: var(--radius-sharp);
    flex-shrink: 0;
  }
  .lost-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .lost-title-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }
  .lost-kind {
    padding: 4rpx 16rpx;
    font-size: 20rpx;
    font-weight: var(--fw-title);
    &.lost {
      color: var(--danger);
      background: var(--bg-elevated);
    }
    &.found {
      color: var(--text-secondary);
      background: var(--bg-elevated);
    }
  }
  .lost-title {
    font-size: 28rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
  }
  .lost-resolved {
    font-size: 20rpx;
    color: var(--text-tertiary);
    margin-left: auto;
  }
  .lost-content {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .lost-time {
    margin-top: auto;
    font-size: 20rpx;
    color: var(--text-tertiary);
    padding-top: 12rpx;
  }
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16rpx 32rpx 0;
  padding: 16rpx 24rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--danger);
  border-radius: var(--radius-sharp);
  .error-text {
    font-size: 24rpx;
    color: var(--danger);
  }
  .error-retry {
    font-size: 24rpx;
    font-weight: var(--fw-title);
    color: var(--secondary);
  }
}

.page-fab {
  position: fixed;
  right: 32rpx;
  bottom: calc(120rpx + constant(safe-area-inset-bottom));
  bottom: calc(120rpx + env(safe-area-inset-bottom));
  z-index: 90;
  padding: 20rpx 36rpx;
  background: var(--accent);
  border-radius: var(--radius-sharp);
  box-shadow: 0 6rpx 0 rgba(0, 0, 0, 0.55);
}
.page-fab-label {
  font-size: 28rpx;
  font-weight: var(--fw-title);
  color: #0d110e;
}
</style>
