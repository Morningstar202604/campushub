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
        <text class="title-900 page-title">二手市集</text>
        <view class="clip-tag sticker"><text class="page-badge">交易</text></view>
      </view>

      <!-- 分类筛选（z-paging 顶部固定，不随列表滚动） -->
      <scroll-view class="cat-scroll" scroll-x>
        <view
          v-for="c in categories"
          :key="c.value"
          class="cat-chip clip-tag sticker press"
          :class="{ active: c.value === activeCategory }"
          @click="onCategory(c.value)"
        >
          <text>{{ c.label }}</text>
        </view>
      </scroll-view>
    </template>

    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry press" @click="reload">重试</text>
    </view>

    <!-- 商品卡：封面 + 价格 + 硬边框（价格保持白色让详情页做荧光焦点） -->
    <view
      v-for="item in list"
      :key="item.id"
      class="market-card sticker press"
      @click="openDetail(item)"
    >
      <image
        v-if="item.image && !brokenImages[item.id]"
        class="market-cover"
        :src="item.image"
        mode="aspectFill"
        lazy-load
        @error="brokenImages[item.id] = true"
      />
      <view v-else class="market-cover market-cover--ph">
        <text class="market-cover--ph-text">No Image</text>
      </view>
      <view class="market-body">
        <text class="market-title">{{ item.title }}</text>
        <view class="market-row">
          <text class="market-price">¥{{ item.price }}</text>
          <text v-if="item.originalPrice" class="market-orig">¥{{ item.originalPrice }}</text>
        </view>
        <view class="market-foot">
          <text class="market-cat">{{ categoryLabel(item.category) }}</text>
          <text class="market-time tabular-nums">{{ item.time }}</text>
        </view>
      </view>
    </view>

    <template #empty="{ isLoadFailed }">
      <view v-if="!isLoadFailed" class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">Market</text>
        <text class="empty-title">{{ activeCategory === 'all' ? '市集还没开张' : '这个分类还没有好物' }}</text>
        <text class="empty-sub">
          {{ activeCategory === 'all' ? '第一件好物等你上架' : '换个分类看看，或成为第一个上架的人' }}
        </text>
        <view class="empty-cta press" @click="goCreate">
          <text>上架好物</text>
        </view>
      </view>
    </template>
  </z-paging>
  <!-- 常驻发布入口：有数据时也要能发（旧版只有空态 CTA，列表一有内容就再无入口） -->
  <view class="page-fab sticker press" @click="goCreate()">
    <text class="page-fab-label">上架</text>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage } from '@dcloudio/uni-app'
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

// 商品卡展示用中文分类名：后端存的是 category 枚举值（digital/books/...），
// 直接渲染会把 'digital' 原样显示在卡片上。
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.value, c.label])
)
function categoryLabel(v: string): string {
  if (!v) return '未分类'
  return CATEGORY_LABEL[v] || v
}
/** 加载失败的商品封面索引（按 item.id），失败后显示占位图 */
const brokenImages = ref<Record<string, boolean>>({})

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

// 空态引导 → 发布页
function goCreate() {
  // @ts-ignore
  uni.navigateTo({ url: '/pages/product-create/product-create' })
}

// 分享给好友（小程序端生效；H5/App 无害）
onShareAppMessage(() => ({ title: 'CampusHub 二手市集 · 校内好物', path: '/pages/market/market' }))
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
    color: #0d110e;
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
    &--ph {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-elevated);
      border: 2rpx solid var(--border);
      clip-path: var(--clip-diamond);
      opacity: 0.5;
    }
    &--ph-text {
      font-size: 20rpx;
      color: var(--text-tertiary);
      letter-spacing: 2rpx;
    }
  }

  .market-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .market-title {
    font-size: 28rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .market-row {
    display: flex;
    align-items: baseline;
    gap: 12rpx;
    margin-top: 8rpx;
  }
  .market-price {
    font-size: 32rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
  }
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
