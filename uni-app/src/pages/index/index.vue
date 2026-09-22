<template>
  <z-paging ref="pagingRef" v-model="list" :auto="true" @query="queryList" safe-area-inset-bottom>
    <template #top>
      <!-- 页头 -->
      <view class="page-header">
        <text class="title-900 page-title">{{ schoolName }}</text>
        <view class="clip-tag sticker"><text class="page-badge">墨荧</text></view>
      </view>

      <!-- 公告条（非分页内容，置顶固定） -->
      <view v-if="announcements.length" class="ann-bar sticker">
        <view
          v-for="a in announcements"
          :key="a.id"
          class="ann-item"
          @click="onAnnouncement(a)"
        >
          <view v-if="a.pinned" class="ann-pin clip-tag"><text>置顶</text></view>
          <text class="ann-title">{{ a.title }}</text>
          <text class="ann-time tabular-nums">{{ a.time }}</text>
        </view>
      </view>

      <!-- 全校园信息流：推荐 / 最新 / 热榜 切换 -->
      <view class="feed-tabs">
        <view
          v-for="t in tabs"
          :key="t.value"
          class="feed-tab clip-tag"
          :class="{ active: t.value === activeTab }"
          @click="onTab(t.value)"
        >
          <text>{{ t.label }}</text>
        </view>
      </view>
    </template>

    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry" @click="reload">重试</text>
    </view>

    <view v-for="item in list" :key="item.id" class="feed-card sticker" @click="openDetail(item)">
      <view class="feed-kind clip-tag"><text>{{ kindLabel(item.kind) }}</text></view>
      <text class="feed-content">{{ item.content }}</text>
      <view class="feed-foot">
        <text class="feed-author">{{ item.author }}</text>
        <text class="feed-time tabular-nums">{{ item.time }}</text>
      </view>
    </view>

    <template #empty>
      <view class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-title">这里还黑着灯</text>
        <text class="empty-sub">校园内容还没点亮</text>
      </view>
    </template>
  </z-paging>

  <!-- 悬浮发布入口（帖子 + 好物 两个） -->
  <view class="fab-stack">
    <view class="fab sticker" @click="openCreate('product')">
      <text class="fab-label">好物</text>
    </view>
    <view class="fab fab--primary sticker" @click="openCreate('post')">
      <text class="fab-label">发布</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePagedList } from '@/composables/use-paged-list'
import { adaptWall, loadAnnouncements } from '@/adapters'
import { useSchoolStore } from '@/stores/school'

const schoolStore = useSchoolStore()
const schoolName = computed(() => schoolStore.schoolName || 'CampusHub')

const tabs = [
  { label: '推荐', value: 'recommend' },
  { label: '最新', value: 'latest' },
  { label: '热榜', value: 'hot' }
]
const activeTab = ref('recommend')

const announcements = ref<any[]>([])

// 信息流走 hook（响应式 tab），列表由 z-paging 经 v-model 写回
const liveQuery = computed(() => ({ tab: activeTab.value }))
const { pagingRef, list, queryList, error, reload } = usePagedList({
  fnName: 'post-list',
  query: liveQuery,
  adapt: adaptWall
})

function onTab(v: string) {
  if (v === activeTab.value) return
  activeTab.value = v
  reload()
}

function openDetail(item: any) {
  // @ts-ignore
  uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${item.id}` })
}

function openCreate(type: 'post' | 'product') {
  // @ts-ignore
  uni.navigateTo({
    url:
      type === 'product'
        ? '/pages/product-create/product-create'
        : '/pages/post-create/post-create'
  })
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    post: '信息', task: '任务', lost: '失物', found: '招领', confession: '表白'
  }
  return map[kind] || kind || '校园'
}

function onAnnouncement(a: any) {
  // 展示公告正文（公告无独立详情页）
  // @ts-ignore
  uni.showModal({
    title: a.title || '公告',
    content: a.content || '',
    showCancel: false,
    confirmText: '知道了'
  })
}

// 首次进入只拉公告（信息流由 z-paging @query 首屏自动加载，避免重复请求 post-list）
onMounted(async () => {
  try {
    announcements.value = await loadAnnouncements()
  } catch {
    announcements.value = []
  }
})
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; }
.page-title { font-size: 40rpx; font-weight: var(--fw-title); color: var(--text-primary); }
.page-badge { padding: 6rpx 20rpx; font-size: 22rpx; font-weight: var(--fw-title); color: var(--accent); background: var(--bg-card); }

.ann-bar { margin: 0 32rpx; padding: 8rpx 0; background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp); }
.ann-item { display: flex; align-items: center; gap: 12rpx; padding: 14rpx 20rpx; }
.ann-pin { padding: 2rpx 12rpx; font-size: 18rpx; color: var(--accent); background: var(--bg-elevated); font-weight: var(--fw-title); }
.ann-title { font-size: 24rpx; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ann-time { font-size: 20rpx; color: var(--text-tertiary); }

.feed-tabs { display: flex; gap: 16rpx; padding: 24rpx 32rpx 8rpx; }
.feed-tab {
  padding: 8rpx 32rpx; font-size: 26rpx; color: var(--text-secondary);
  background: var(--bg-card); border: 1rpx solid var(--border);
  &.active { color: #0D110E; background: var(--accent); font-weight: var(--fw-title); }
}

.feed-card { margin: 20rpx 32rpx; padding: 24rpx; background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp); }
.feed-kind { display: inline-block; padding: 2rpx 16rpx; font-size: 20rpx; color: var(--text-secondary); background: var(--bg-elevated); font-weight: var(--fw-title); margin-bottom: 12rpx; }
.feed-content { display: block; font-size: 28rpx; color: var(--text-primary); line-height: 1.7; }
.feed-foot { display: flex; justify-content: space-between; margin-top: 16rpx; font-size: 22rpx; color: var(--text-tertiary); }

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 80rpx 0;
  .empty-shape { width: 48rpx; height: 48rpx; background: var(--accent); clip-path: polygon(0 0, 100% 0, 100% 100%, 8rpx 100%, 0 calc(100% - 8rpx)); margin-bottom: 24rpx; }
  .empty-title { font-size: 32rpx; font-weight: var(--fw-title); color: var(--text-primary); }
  .empty-sub { margin-top: 8rpx; font-size: 22rpx; color: var(--text-tertiary); }
}

.error-banner {
  display: flex; justify-content: space-between; align-items: center;
  margin: 16rpx 32rpx 0; padding: 16rpx 24rpx;
  background: var(--bg-card); border: 1rpx solid var(--danger); border-radius: var(--radius-sharp);
  .error-text { font-size: 24rpx; color: var(--danger); }
  .error-retry { font-size: 24rpx; font-weight: var(--fw-title); color: var(--accent); }
}

/* 悬浮发布入口（右下角，两枚硬投影方块，非圆球——反 AI 味） */
.fab-stack {
  position: fixed;
  right: 32rpx;
  bottom: 160rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  z-index: 999;
}
.fab {
  width: 96rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 8rpx 100%, 0 calc(100% - 8rpx));

  .fab-label { font-size: 24rpx; font-weight: var(--fw-title); color: var(--accent); }

  &--primary {
    background: var(--accent);
    .fab-label { color: #0D110E; }
  }
}
</style>
