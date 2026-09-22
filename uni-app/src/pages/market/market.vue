<template>
  <z-paging ref="pagingRef" v-model="list" :auto="true" @query="queryList" safe-area-inset-bottom>
    <template #top>
      <view class="page-header">
        <text class="title-900 page-title">二手市集</text>
        <view class="clip-tag sticker"><text class="page-badge">交易</text></view>
      </view>

      <!-- 分类筛选（z-paging 顶部固定，不随列表滚动） -->
      <scroll-view class="cat-scroll" scroll-x>
        <view
          v-for="c in categories"
          :key="c.value"
          class="cat-chip clip-tag sticker"
          :class="{ active: c.value === activeCategory }"
          @click="onCategory(c.value)"
        >
          <text>{{ c.label }}</text>
        </view>
      </scroll-view>
    </template>

    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry" @click="reload">重试</text>
    </view>

    <!-- 商品卡：封面 + 价格 + 硬边框 -->
    <view v-for="item in list" :key="item.id" class="market-card sticker" @click="openDetail(item)">
      <image
        v-if="item.image"
        class="market-cover"
        :src="item.image"
        mode="aspectFill"
        lazy-load
      />
      <view v-else class="market-cover market-cover--ph"></view>
      <view class="market-body">
        <text class="market-title">{{ item.title }}</text>
        <view class="market-row">
          <text class="market-price">¥{{ item.price }}</text>
          <text v-if="item.originalPrice" class="market-orig">¥{{ item.originalPrice }}</text>
        </view>
        <view class="market-foot">
          <text class="market-cat">{{ item.category || '未分类' }}</text>
          <text class="market-time tabular-nums">{{ item.time }}</text>
        </view>
      </view>
    </view>

    <template #empty>
      <view class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-title">市集还没开张</text>
        <text class="empty-sub">第一件好物等你上架</text>
      </view>
    </template>
  </z-paging>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePagedList } from '@/composables/use-paged-list'
import { adaptMarket } from '@/adapters'

// 分类枚举必须与 product-create.vue 保持一致（后端 product-create 落库的 category 值集合）
// product-create：digital / books / living / sports / other（默认 other）
const categories = [
  { label: '全部', value: 'all' },
  { label: '数码', value: 'digital' },
  { label: '教材', value: 'books' },
  { label: '生活', value: 'living' },
  { label: '运动', value: 'sports' },
  { label: '其他', value: 'other' }
]

// 响应式 query：activeCategory 变化时自动带进下一次 callFunction
const activeCategory = ref('all')

// 响应式 query：把 activeCategory 包成 computed，usePagedList 每次取 .value 即最新
const liveQuery = computed(() => ({ category: activeCategory.value }))
const { pagingRef, list, queryList, error, reload } = usePagedList({
  fnName: 'product-list',
  query: liveQuery,
  adapt: adaptMarket
})

// 切换分类 → 重新拉首屏（query 是响应式，reload 时自动取最新 category）
function onCategory(value: string) {
  if (value === activeCategory.value) return
  activeCategory.value = value
  reload()
}

// 点商品卡 → 商品详情
function openDetail(item: any) {
  // @ts-ignore
  uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${item.id}` })
}
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; }
.page-title { font-size: 40rpx; font-weight: var(--fw-title); color: var(--text-primary); }
.page-badge { padding: 6rpx 20rpx; font-size: 22rpx; font-weight: var(--fw-title); color: var(--accent); background: var(--bg-card); }

.cat-scroll {
  white-space: nowrap;
  padding: 0 32rpx 20rpx;
  display: flex;
  gap: 16rpx;
}
.cat-chip {
  display: inline-block;
  padding: 8rpx 28rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);

  &.active {
    color: #0D110E;
    background: var(--accent);
    font-weight: var(--fw-title);
  }
}

.market-card {
  display: flex;
  margin: 20rpx 32rpx;
  padding: 20rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  gap: 20rpx;

  .market-cover {
    width: 160rpx;
    height: 160rpx;
    border-radius: var(--radius-sharp);
    flex-shrink: 0;
    &--ph { background: var(--bg-elevated); }
  }

  .market-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }

  .market-title {
    font-size: 28rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .market-row { display: flex; align-items: baseline; gap: 12rpx; margin-top: 8rpx; }
  .market-price { font-size: 32rpx; font-weight: var(--fw-title); color: var(--text-primary); }
  .market-orig {
    font-size: 22rpx;
    color: var(--text-tertiary);
    text-decoration: line-through;
  }

  .market-foot {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    font-size: 22rpx;
    color: var(--text-secondary);
    padding-top: 12rpx;
  }
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
