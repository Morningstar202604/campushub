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
      <!-- 页头：标题 + 斜切角品牌标签 -->
      <view class="wall-header">
        <text class="wall-title title-900">表白墙</text>
        <view class="clip-tag sticker">
          <text class="wall-badge">校园夜场</text>
        </view>
      </view>
    </template>

    <!-- 网络/业务错误横幅（可重试） -->
    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry press" @click="reload">重试</text>
    </view>

    <!-- 帖子卡片：深底 + 硬边框 + 匿名帖斜切角 -->
    <view
      v-for="item in list"
      :key="item.id"
      class="wall-card sticker press"
      :class="{ anonymous: item.isAnonymous }"
      @click="openDetail(item)"
    >
      <view class="wall-meta">
        <text class="wall-author">{{ item.isAnonymous ? '匿名' : item.author }}</text>
        <text class="wall-time tabular-nums">{{ item.time }}</text>
      </view>
      <text class="wall-content">{{ item.content }}</text>
      <view class="wall-foot">
        <text class="wall-like">点灯 {{ item.likes }}</text>
        <text class="wall-comment">回应 {{ item.comments }}</text>
      </view>
    </view>

    <template #empty="{ isLoadFailed }">
      <view v-if="!isLoadFailed" class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">LOVE LETTERS</text>
        <text class="empty-title">这里还黑着灯</text>
        <text class="empty-sub">第一盏灯由你点亮</text>
        <view class="empty-cta press" @click="goCreate">
          <text>去表白</text>
        </view>
      </view>
    </template>
  </z-paging>
  <!-- 常驻发布入口：有数据时也要能发（旧版只有空态 CTA，列表一有内容就再无入口） -->
  <view class="page-fab sticker press" @click="goCreate()">
    <text class="page-fab-label">去表白</text>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage } from '@dcloudio/uni-app'
import { usePagedList } from '@/composables/use-paged-list'
import { adaptWall } from '@/adapters'

// 表白墙 = post-list 按 kind=confession 过滤（后端 VALID_KINDS 含 confession）
// 列表经 v-model 由 z-paging 维护，不再读取组件内部列表
const { pagingRef, list, queryList, error, reload } = usePagedList({
  fnName: 'post-list',
  query: { tab: 'latest', kind: 'confession' },
  adapt: adaptWall
})

// 点卡片 → 帖子详情（kind=confession 也走 post-detail）
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
onShareAppMessage(() => ({ title: 'CampusHub 表白墙 · 校园夜场', path: '/pages/wall/wall' }))
</script>

<style lang="scss" scoped>
.wall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx 32rpx 16rpx;

  .wall-title {
    font-size: 40rpx;
    color: var(--text-primary);
  }
}

.wall-badge {
  padding: 6rpx 20rpx;
  font-size: 22rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  background: var(--bg-card);
}

.wall-card {
  margin: 20rpx 32rpx;
  padding: 28rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);

  &.anonymous {
    clip-path: polygon(0 0, 100% 0, 100% 100%, 8rpx 100%, 0 calc(100% - 8rpx));
    border-top-right-radius: 0;
  }

  .wall-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    .wall-author {
      font-weight: var(--fw-title);
      color: var(--text-primary);
    }
    .wall-time {
      font-size: 22rpx;
      color: var(--text-tertiary);
    }
  }

  .wall-content {
    color: var(--text-primary);
    font-size: 28rpx;
    line-height: 1.7;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wall-foot {
    margin-top: 20rpx;
    display: flex;
    gap: 32rpx;
    font-size: 22rpx;
    color: var(--text-secondary);

    .wall-like {
      color: var(--accent);
    }
  }
}

.empty-state {
  .empty-cta {
    margin-top: 28rpx;
    padding: 14rpx 40rpx;
    background: var(--accent);
    text {
      font-size: 26rpx;
      font-weight: var(--fw-title);
      color: #0d110e;
    }
  }
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16rpx 32rpx 0;
  padding: 16rpx 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--danger);
  border-radius: var(--radius-sharp);

  .error-text {
    font-size: 24rpx;
    color: var(--danger);
  }
  .error-retry {
    font-size: 24rpx;
    font-weight: var(--fw-title);
    color: var(--accent);
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
