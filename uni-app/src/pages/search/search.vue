<template>
  <view class="sr-page">
    <!-- 搜索框 -->
    <view class="sr-bar">
      <view class="sr-input-wrap">
        <text class="sr-input-icon">⌕</text>
        <input
          class="sr-input"
          v-model="keyword"
          :focus="focusSearch"
          confirm-type="search"
          placeholder="搜索帖子 / 闲置 / 指南"
          placeholder-class="sr-ph"
          @confirm="doSearch"
        />
        <text v-if="keyword" class="sr-clear" @click="keyword = ''">✕</text>
      </view>
      <button class="sr-go" @click="doSearch">搜索</button>
    </view>

    <!-- 热搜（未搜索时展示） -->
    <view v-if="!hasSearched" class="sr-hot">
      <view class="sr-hot-title">
        <text class="sr-hot-kicker">TRENDING</text>
        <text class="sr-hot-sub">近 7 天真实热搜</text>
      </view>
      <view class="sr-hot-list">
        <view
          v-for="(k, i) in hotList"
          :key="i"
          class="sr-hot-item"
          @click="onHot(k)"
        >
          <text class="sr-hot-rank" :class="{ 'sr-hot-rank-top': i < 3 }">{{ i + 1 }}</text>
          <text class="sr-hot-keyword">{{ k }}</text>
        </view>
        <view v-if="!hotList.length && !hotLoading" class="sr-hot-empty">暂无热搜</view>
      </view>
    </view>

    <!-- 搜索结果：帖子 / 闲置 / 指南 三个独立分节 -->
    <view v-else class="sr-results">
      <view v-if="searching" class="sr-state">
        <text class="sr-state-text">SEARCHING…</text>
      </view>

      <view v-else-if="searchError" class="sr-state">
        <text class="sr-state-err">{{ searchError }}</text>
        <button class="sr-retry" @click="doSearch">重试</button>
      </view>

      <view v-else-if="total === 0" class="sr-empty">
        <text class="sr-empty-text">「{{ lastKeyword }}」没有结果</text>
        <text class="sr-empty-sub">换个关键词试试</text>
      </view>

      <view v-else>
        <!-- 帖子 -->
        <view v-if="postHits.length" class="sr-section">
          <view class="sr-section-head">
            <text class="sr-section-label">帖子</text>
            <text class="sr-section-count">{{ postHits.length }}</text>
          </view>
          <view
            v-for="h in postHits"
            :key="'p' + h.id"
            class="sr-card"
            @click="openDetail('post', h.id)"
          >
            <view class="sr-card-body">
              <view class="sr-card-title">{{ h.title || h.content }}</view>
              <view class="sr-card-sub">{{ h.time }}</view>
            </view>
            <view class="sr-card-tag sr-tag-post">POST</view>
          </view>
        </view>

        <!-- 闲置 -->
        <view v-if="productHits.length" class="sr-section">
          <view class="sr-section-head">
            <text class="sr-section-label">闲置</text>
            <text class="sr-section-count">{{ productHits.length }}</text>
          </view>
          <view
            v-for="h in productHits"
            :key="'d' + h.id"
            class="sr-card"
            @click="openDetail('product', h.id)"
          >
            <view class="sr-card-body">
              <view class="sr-card-title">{{ h.title || h.content }}</view>
              <view class="sr-card-sub">{{ h.time }}</view>
            </view>
            <view class="sr-card-tag sr-tag-product">DEAL</view>
          </view>
        </view>

        <!-- 指南（字段只有 title/summary/coverImage/category/tags/viewCount/_id，无 createdAt） -->
        <view v-if="guideHits.length" class="sr-section">
          <view class="sr-section-head">
            <text class="sr-section-label">指南</text>
            <text class="sr-section-count">{{ guideHits.length }}</text>
          </view>
          <view
            v-for="h in guideHits"
            :key="'g' + h.id"
            class="sr-card"
            @click="openGuide(h.id)"
          >
            <view class="sr-card-body">
              <view class="sr-card-title">{{ h.title }}</view>
              <view class="sr-card-sub">{{ h.summary || ('浏览 ' + h.viewCount) }}</view>
            </view>
            <view class="sr-card-tag sr-tag-guide">GUIDE</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { callFunction } from '@/utils/api'
import { adaptSearchHit, type SearchHit } from '@/adapters'

interface GuideHit {
  id: string
  title: string
  summary: string
  viewCount: number
}

const keyword = ref('')
const focusSearch = ref(true)
const hasSearched = ref(false)
const lastKeyword = ref('')
const searching = ref(false)
const searchError = ref('')

// 热搜
const hotList = ref<string[]>([])
const hotLoading = ref(false)

// 结果：后端 search 契约是 { posts, products, guides } 三个键
const postHits = ref<SearchHit[]>([])
const productHits = ref<SearchHit[]>([])
const guideHits = ref<GuideHit[]>([])

const total = computed(
  () => postHits.value.length + productHits.value.length + guideHits.value.length
)

function adaptGuideHit(raw: any): GuideHit {
  return {
    id: raw?._id || raw?.id || '',
    title: raw?.title || '',
    summary: raw?.summary || '',
    viewCount: raw?.viewCount ?? 0
  }
}

async function loadHot() {
  hotLoading.value = true
  try {
    const res: any = await callFunction('search', { action: 'hot' })
    hotList.value = res?.hot ?? []
  } catch {
    // 热搜加载失败不阻塞
    hotList.value = []
  } finally {
    hotLoading.value = false
  }
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) return                       // 空关键词不发请求
  if (searching.value) return
  lastKeyword.value = kw
  hasSearched.value = true
  searching.value = true
  searchError.value = ''
  postHits.value = []
  productHits.value = []
  guideHits.value = []
  try {
    const res: any = await callFunction('search', { keyword: kw, page: 1, pageSize: 30 })
    postHits.value = (res?.posts ?? []).map((r: any) => adaptSearchHit(r, 'post'))
    productHits.value = (res?.products ?? []).map((r: any) => adaptSearchHit(r, 'product'))
    guideHits.value = (res?.guides ?? []).map(adaptGuideHit)
  } catch (e: any) {
    searchError.value = e?.message || String(e)
  } finally {
    searching.value = false
  }
}

// 输入防抖 ≥300ms（350ms），空串回到热搜视图；短于 2 字仅靠回车/按钮触发，避免高频搜打爆服务端限频
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(keyword, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const kw = (v || '').trim()
  if (!kw) {
    hasSearched.value = false
    searchError.value = ''
    return
  }
  if (kw.length < 2) return
  debounceTimer = setTimeout(() => doSearch(), 350)
})

function onHot(k: string) {
  keyword.value = k
  doSearch()
}

function openDetail(type: 'post' | 'product', id: string) {
  if (!id) return
  if (type === 'product') uni.navigateTo({ url: '/pages/product-detail/product-detail?id=' + id })
  else uni.navigateTo({ url: '/pages/post-detail/post-detail?id=' + id })
}

function openGuide(id: string) {
  if (!id) return
  uni.navigateTo({ url: '/pages/guide-detail/guide-detail?id=' + id })
}

onMounted(loadHot)
</script>

<style lang="scss" scoped>
.sr-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 40rpx;
}

/* 搜索栏 */
.sr-bar {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx;
  position: sticky;
  top: 0;
  background: var(--bg-page);
  z-index: 10;
}
.sr-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 0 20rpx;
  height: 80rpx;
}
.sr-input-icon {
  font-size: 32rpx;
  color: var(--text-secondary);
  margin-right: 12rpx;
}
.sr-input {
  flex: 1;
  font-size: 28rpx;
  color: var(--text-body);
  height: 80rpx;
  line-height: 80rpx;
}
.sr-ph {
  color: var(--text-tertiary);
  font-size: 26rpx;
}
.sr-clear {
  font-size: 28rpx;
  color: var(--text-tertiary);
  padding: 0 8rpx;
}
.sr-go {
  background: var(--bg-elevated);
  color: var(--text-body);
  font-weight: var(--fw-title);
  font-size: 26rpx;
  border: 3rpx solid var(--border);
  padding: 0 32rpx;
  height: 80rpx;
  line-height: 80rpx;
}

/* 热搜 */
.sr-hot {
  padding: 8rpx 32rpx;
}
.sr-hot-title {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.sr-hot-kicker {
  font-size: 24rpx;
  letter-spacing: 3rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
.sr-hot-sub {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.sr-hot-list {
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.sr-hot-item {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx;
  border-bottom: 2rpx solid var(--border);
}
.sr-hot-item:last-child {
  border-bottom: none;
}
.sr-hot-rank {
  width: 48rpx;
  font-size: 28rpx;
  font-weight: var(--fw-title);
  color: var(--text-tertiary);
}
.sr-hot-rank-top {
  color: var(--accent);
}
.sr-hot-keyword {
  font-size: 28rpx;
  color: var(--text-body);
}
.sr-hot-empty {
  padding: 40rpx;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* 结果 */
.sr-results {
  padding: 0 32rpx;
}
.sr-state {
  padding: 100rpx 0;
  text-align: center;
}
.sr-state-text {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
}
.sr-state-err {
  display: block;
  font-size: 24rpx;
  color: var(--danger);
  margin-bottom: 24rpx;
}
.sr-retry {
  background: var(--bg-elevated);
  color: var(--text-body);
  font-weight: var(--fw-title);
  font-size: 24rpx;
  border: 3rpx solid var(--border);
  padding: 0 40rpx;
  height: 72rpx;
  line-height: 72rpx;
}
.sr-empty {
  padding: 120rpx 0;
  text-align: center;
}
.sr-empty-text {
  display: block;
  font-size: 28rpx;
  color: var(--text-body);
  font-weight: 400;
}
.sr-empty-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--text-tertiary);
}

/* 分节 */
.sr-section {
  margin-top: 32rpx;
}
.sr-section-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.sr-section-label {
  font-size: 26rpx;
  font-weight: var(--fw-title);
  color: var(--text-body);
}
.sr-section-count {
  font-size: 22rpx;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
  padding: 2rpx 12rpx;
}

/* 卡片 */
.sr-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.sr-card-body {
  flex: 1;
  overflow: hidden;
}
.sr-card-title {
  font-size: 28rpx;
  color: var(--text-body);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sr-card-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sr-card-tag {
  font-size: 18rpx;
  font-weight: var(--fw-title);
  letter-spacing: 1rpx;
  padding: 4rpx 12rpx;
  border: 2rpx solid;
  margin-left: 16rpx;
  flex-shrink: 0;
}
.sr-tag-post {
  color: var(--text-secondary);
  border-color: var(--text-secondary);
}
.sr-tag-product {
  color: var(--secondary);
  border-color: var(--secondary);
}
.sr-tag-guide {
  color: var(--warning);
  border-color: var(--warning);
}
</style>
