<template>
  <view class="sr-page">
    <!-- 搜索框 -->
    <view class="sr-bar">
      <view class="sr-input-wrap hard-border">
        <view class="sr-input-icon"></view>
        <input
          ref="inputEl"
          class="sr-input"
          v-model="keyword"
          :focus="focusSearch"
          confirm-type="search"
          placeholder="搜索帖子 / 闲置 / 指南"
          placeholder-class="sr-ph"
          @confirm="doSearch"
        />
        <view v-if="keyword" class="sr-clear" @click="clearSearch"></view>
      </view>
      <button class="sr-go press hard-border" @click="doSearch">搜索</button>
    </view>

    <!-- 最近搜索（本地历史，未搜索时展示） -->
    <view v-if="!hasSearched && history.length" class="sr-hot">
      <view class="sr-hot-title">
        <text class="sr-hot-kicker">RECENT</text>
        <text class="sr-hot-sub">最近搜索</text>
        <text class="sr-hist-clear press" @click="clearHistory">清空</text>
      </view>
      <view class="sr-hist-list">
        <view
          v-for="(k, i) in history"
          :key="k + '-' + i"
          class="sr-hist-item press"
          @click="onHistory(k)"
        >
          <text>{{ k }}</text>
        </view>
      </view>
    </view>

    <!-- 热搜（未搜索时展示） -->
    <view v-if="!hasSearched" class="sr-hot">
      <view class="sr-hot-title">
        <text class="sr-hot-kicker">TRENDING</text>
        <text class="sr-hot-sub">近 7 天真实热搜</text>
      </view>
      <view class="sr-hot-list sticker">
        <view v-for="(k, i) in hotList" :key="i" class="sr-hot-item press" @click="onHot(k)">
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
        <button class="sr-retry press hard-border" @click="doSearch">重试</button>
      </view>

      <view v-else-if="total === 0" class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">SEARCH</text>
        <text class="empty-title">「{{ lastKeyword }}」没有结果</text>
        <text class="empty-sub">换个关键词试试</text>
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
            class="sr-card sticker press"
            @click="openDetail('post', h.id)"
          >
            <view class="sr-card-body">
              <view class="sr-card-title"
                ><rich-text :nodes="highlight(h.title || h.content)"
              /></view>
              <view class="sr-card-sub">{{ h.time }}</view>
            </view>
            <view class="sr-card-tag clip-tag">帖子</view>
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
            class="sr-card sticker press"
            @click="openDetail('product', h.id)"
          >
            <view class="sr-card-body">
              <view class="sr-card-title"
                ><rich-text :nodes="highlight(h.title || h.content)"
              /></view>
              <view class="sr-card-sub">{{ h.time }}</view>
            </view>
            <view class="sr-card-tag clip-tag">好物</view>
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
            class="sr-card sticker press"
            @click="openGuide(h.id)"
          >
            <view class="sr-card-body">
              <view class="sr-card-title"><rich-text :nodes="highlight(h.title)" /></view>
              <view class="sr-card-sub">{{ h.summary || '浏览 ' + h.viewCount }}</view>
            </view>
            <view class="sr-card-tag clip-tag">指南</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { callFunction } from '@/utils/api'
import { adaptSearchHit, type SearchHit } from '@/adapters'

interface GuideHit {
  id: string
  title: string
  summary: string
  viewCount: number
}

// 并发请求竞态防护：递增计数器，每次发请求前 +1
let requestSeq = 0

const keyword = ref('')
const focusSearch = ref(true)
const hasSearched = ref(false)
const lastKeyword = ref('')
const searching = ref(false)
const searchError = ref('')

// 搜索输入框 ref（用于清除后重聚焦）
const inputEl = ref<HTMLInputElement | null>(null)

// 热搜
const hotList = ref<string[]>([])
const hotLoading = ref(false)

// 搜索历史：本地存储，最多 10 条，去重、点词即搜、可清空
const HISTORY_KEY = 'campushub.searchHistory'
const HISTORY_MAX = 10
const history = ref<string[]>([])

function loadHistory() {
  try {
    const saved = uni.getStorageSync(HISTORY_KEY)
    history.value = Array.isArray(saved) ? saved.filter((k) => typeof k === 'string') : []
  } catch {
    history.value = []
  }
}

function saveHistory(kw: string) {
  const next = [kw, ...history.value.filter((k) => k !== kw)].slice(0, HISTORY_MAX)
  history.value = next
  try {
    uni.setStorageSync(HISTORY_KEY, next)
  } catch {
    // 存储失败不影响搜索主流程
  }
}

function clearHistory() {
  history.value = []
  try {
    uni.removeStorageSync(HISTORY_KEY)
  } catch {
    // 忽略
  }
}

function onHistory(k: string) {
  keyword.value = k
  doSearch()
}

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

/**
 * 搜索结果关键词高亮。
 * 用 rich-text 而不是 v-html：uni-app 三端只有 rich-text 支持富文本，
 * v-html 在小程序端会被直接忽略（等于没高亮）。
 * 先转义再插入标记，避免标题里的 < > 被当成标签。
 */
function highlight(text: string): string {
  const raw = String(text || '')
  const kw = keyword.value.trim()
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!kw) return escaped
  const safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return escaped.replace(
    new RegExp(safeKw, 'gi'),
    (m) => `<span style="color:var(--accent);font-weight:600">${m}</span>`
  )
}

async function loadHot() {
  hotLoading.value = true
  try {
    const res: any = await callFunction('search', { action: 'hot' })
    hotList.value = res?.hot || []
  } catch {
    // 热搜加载失败不阻塞，使用 fallback 热词
    console.warn('[search] loadHot failed, using fallback hot words')
    hotList.value = ['二手教材', '失物招领', '食堂测评', '社团招新']
  } finally {
    hotLoading.value = false
  }
}

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) return
  if (kw.length < 1) {
    uni.showToast({ title: '请输入搜索关键词', icon: 'none', duration: 2000 })
    return
  }
  if (searching.value) return

  // 记录本次请求序号
  const seq = ++requestSeq

  lastKeyword.value = kw
  hasSearched.value = true
  searching.value = true
  searchError.value = ''
  postHits.value = []
  productHits.value = []
  guideHits.value = []
  saveHistory(kw)
  try {
    const res: any = await callFunction('search', { keyword: kw, page: 1, pageSize: 30 })
    // 已有更新的请求，丢弃本次结果
    if (seq !== requestSeq) return
    postHits.value = (res?.posts ?? []).map((r: any) => adaptSearchHit(r, 'post'))
    productHits.value = (res?.products ?? []).map((r: any) => adaptSearchHit(r, 'product'))
    guideHits.value = (res?.guides ?? []).map(adaptGuideHit)
  } catch (e: any) {
    // 已有更新的请求，不处理本次错误
    if (seq !== requestSeq) return
    searchError.value = e?.message || String(e)
  } finally {
    if (seq === requestSeq) searching.value = false
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

function clearSearch() {
  keyword.value = ''
  nextTick(() => inputEl.value?.focus?.())
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

onMounted(() => {
  loadHistory()
  loadHot()
})
</script>

<style lang="scss" scoped>
.sr-page {
  /* H5：100vh 含导航栏会多出 44px 整页滚动条 */
  /* #ifdef H5 */
  min-height: calc(100vh - var(--window-top));
  /* #endif */
  /* #ifndef H5 */
  min-height: 100vh;
  /* #endif */
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
  background: var(--bg-deep);
  padding: 0 20rpx;
  height: 80rpx;
}
.sr-input-icon {
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  clip-path: var(--clip-diamond);
  background: var(--accent);
  opacity: 0.6;
  flex-shrink: 0;
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
  width: 28rpx;
  height: 28rpx;
  padding: 0 8rpx;
  position: relative;
  flex-shrink: 0;
}
.sr-clear::before,
.sr-clear::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20rpx;
  height: 3rpx;
  background: var(--text-tertiary);
  border-radius: 2rpx;
}
.sr-clear::before {
  transform: translate(-50%, -50%) rotate(45deg);
}
.sr-clear::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}
.sr-go {
  background: var(--accent);
  color: var(--bg-page);
  font-weight: var(--fw-title);
  font-size: 26rpx;
  padding: 0 32rpx;
  height: 80rpx;
  line-height: 80rpx;
}

/* 热搜 */
.sr-hot {
  padding: 8rpx 32rpx;
}
.sr-hist-clear {
  margin-left: auto;
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.sr-hist-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding-bottom: 8rpx;
}
.sr-hist-item {
  padding: 12rpx 28rpx;
  font-size: 24rpx;
  color: var(--text-body);
  background: var(--bg-deep);
  border: 1rpx solid var(--border);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background: var(--bg-deep);
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
  padding: 0 40rpx;
  height: 72rpx;
  line-height: 72rpx;
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
  background: var(--bg-deep);
  padding: 24rpx;
  margin-bottom: 16rpx;
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
  margin-left: 16rpx;
  flex-shrink: 0;
  color: var(--bg-page);
  background: var(--accent);
}
</style>
