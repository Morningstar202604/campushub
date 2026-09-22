<template>
  <z-paging ref="pagingRef" v-model="list" :auto="true" @query="queryGuides" safe-area-inset-bottom>
    <template #top>
      <view class="guide-head">
        <text class="head-title">校园指南</text>
        <view class="clip-tag sticker"><text class="head-badge">攻略</text></view>
      </view>

      <!-- 分类筛选（来自 guide-list 的 categories 字段） -->
      <scroll-view v-if="categories.length" class="cat-scroll" scroll-x>
        <view
          v-for="c in categories"
          :key="c.categoryId"
          class="cat-chip clip-tag sticker"
          :class="{ active: c.categoryId === activeCat }"
          @click="onCat(c)"
        >
          <text>{{ c.name }}</text>
        </view>
      </scroll-view>
    </template>

    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry" @click="reload">重试</text>
    </view>

    <view
      v-for="g in list"
      :key="g.id"
      class="guide-card sticker"
      @click="openDetail(g)"
    >
      <image v-if="g.coverImage" class="guide-cover" :src="g.coverImage" mode="aspectFill" lazy-load />
      <view class="guide-body">
        <text class="guide-title">{{ g.title }}</text>
        <text class="guide-summary">{{ g.summary }}</text>
        <view class="guide-foot">
          <text class="guide-cat">{{ g.category }}</text>
          <text class="guide-views tabular-nums">{{ g.viewCount }} 浏览</text>
        </view>
      </view>
    </view>

    <template #empty>
      <view class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-title">暂无指南</text>
        <text class="empty-sub">攻略还在路上</text>
      </view>
    </template>
  </z-paging>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { callFunction } from '@/utils/api'
import { adaptGuide } from '@/adapters'
import type { GuideCard } from '@/adapters'

// guide-list 契约：ok({ categories, guides, hasMore })
// 列表键名是 guides（不是 list），usePagedList 内部固定读 res.list 不适用，
// 故本页直接管理 list + 自定义 queryGuides，使用 z-paging v2 真实方法 completeByNoMore。
const list = ref<GuideCard[]>([])
const categories = ref<any[]>([])
const activeCat = ref('')
const error = ref('')
const pagingRef = ref<any>(null)

async function queryGuides(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  try {
    const res: any = await callFunction('guide-list', {
      categoryId: activeCat.value || 'all',
      page,
      pageSize: size
    })
    // 首屏缓存分类（后端 categories 字段：categoryId / name / sort / icon）
    if (page === 1) categories.value = res?.categories ?? []
    const pageData: GuideCard[] = (res?.guides ?? []).map((raw: any) => adaptGuide(raw))
    const hasMore = Boolean(res?.hasMore)
    paging.completeByNoMore(pageData, hasMore)
  } catch (e: any) {
    error.value = e?.message || String(e)
    if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
    else paging.complete?.()
  }
}

function reload() {
  error.value = ''
  pagingRef.value?.reload?.()
}

// 分类切换：用后端稳定的 categoryId 作为筛选主键（与 guide.categoryId 对齐）
function onCat(c: any) {
  const id = c.categoryId || c._id
  activeCat.value = activeCat.value === id ? '' : id
  reload()
}

function openDetail(g: GuideCard) {
  // @ts-ignore
  uni.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${g.id}` })
}
</script>

<style lang="scss" scoped>
.guide-head { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; }
.head-title { font-size: 40rpx; font-weight: var(--fw-title); color: var(--text-primary); }
.head-badge { padding: 6rpx 20rpx; font-size: 22rpx; font-weight: var(--fw-title); color: var(--accent); background: var(--bg-card); }

.cat-scroll { white-space: nowrap; padding: 0 32rpx 20rpx; display: flex; gap: 16rpx; }
.cat-chip {
  display: inline-block; padding: 8rpx 28rpx; font-size: 24rpx;
  color: var(--text-secondary); background: var(--bg-card); border: 1rpx solid var(--border);
  &.active { color: #0D110E; background: var(--accent); font-weight: var(--fw-title); }
}

.guide-card {
  display: flex; gap: 20rpx; margin: 20rpx 32rpx; padding: 20rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
  .guide-cover { width: 160rpx; height: 160rpx; border-radius: var(--radius-sharp); flex-shrink: 0; background: var(--bg-elevated); }
  .guide-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .guide-title { font-size: 28rpx; font-weight: var(--fw-title); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .guide-summary { font-size: 24rpx; color: var(--text-secondary); margin-top: 8rpx; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .guide-foot { margin-top: auto; display: flex; justify-content: space-between; padding-top: 12rpx; font-size: 22rpx; color: var(--text-tertiary); }
  .guide-cat { color: var(--accent); }
}

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
</style>
