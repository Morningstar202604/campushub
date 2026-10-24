<template>
  <view class="db-page">
    <view class="db-head">
      <text class="db-kicker clip-tag">DASHBOARD</text>
      <text class="db-title title-900">运营仪表盘</text>
      <view class="db-segs">
        <view
          v-for="d in ranges"
          :key="d"
          class="db-seg clip-tag press"
          :class="{ active: days === d }"
          @click="setDays(d)"
        >
          <text>近 {{ d }} 天</text>
        </view>
      </view>
    </view>

    <view v-if="error" class="db-state">
      <text class="db-error">{{ error }}</text>
      <button class="btn-ghost db-retry press" @click="load">重试</button>
    </view>

    <view v-else-if="loading" class="db-state">
      <text class="db-loading">LOADING…</text>
    </view>

    <template v-else>
      <!-- 待办队列：运营第一屏最关心「有多少事等我处理」 -->
      <view class="db-section">
        <text class="db-section-title">待处理</text>
        <view class="db-queue">
          <view class="db-q press" @click="go('/pages/admin/admin')">
            <text class="db-q-n accent-num">{{ stats.queue.reports ?? '-' }}</text>
            <text class="db-q-l">举报</text>
          </view>
          <view class="db-q press" @click="go('/pages/admin/admin')">
            <text class="db-q-n accent-num">{{ stats.queue.verifies ?? '-' }}</text>
            <text class="db-q-l">认证</text>
          </view>
          <view class="db-q press" @click="go('/pages/admin/admin')">
            <text class="db-q-n accent-num">{{ stats.queue.feedbacks ?? '-' }}</text>
            <text class="db-q-l">反馈</text>
          </view>
        </view>
      </view>

      <!-- 规模 -->
      <view class="db-section">
        <text class="db-section-title">社区规模</text>
        <view class="db-grid">
          <view class="db-card sticker">
            <text class="db-card-n tabular-nums">{{ stats.users.total ?? '-' }}</text>
            <text class="db-card-l">用户</text>
            <text class="db-card-sub">近 {{ days }} 天 +{{ stats.users.new ?? 0 }}</text>
          </view>
          <view class="db-card sticker">
            <text class="db-card-n tabular-nums">{{ stats.posts.normal ?? '-' }}</text>
            <text class="db-card-l">帖子</text>
            <text class="db-card-sub">近 {{ days }} 天 +{{ stats.posts.new ?? 0 }}</text>
          </view>
          <view class="db-card sticker">
            <text class="db-card-n tabular-nums">{{ stats.products.total ?? '-' }}</text>
            <text class="db-card-l">商品</text>
            <text class="db-card-sub">在售 {{ stats.products.onSale ?? 0 }}</text>
          </view>
          <view class="db-card sticker">
            <text class="db-card-n tabular-nums">{{ stats.comments.normal ?? '-' }}</text>
            <text class="db-card-l">评论</text>
            <text class="db-card-sub">近 {{ days }} 天 +{{ stats.comments.new ?? 0 }}</text>
          </view>
        </view>
      </view>

      <!-- 治理 -->
      <view class="db-section">
        <text class="db-section-title">治理</text>
        <view class="db-list">
          <view class="db-row">
            <text class="db-row-l">封禁用户</text>
            <text class="db-row-v tabular-nums">{{ stats.users.banned ?? '-' }}</text>
          </view>
          <view class="db-row">
            <text class="db-row-l">已删除帖子（回收站）</text>
            <text class="db-row-v tabular-nums">{{ stats.posts.deleted ?? '-' }}</text>
          </view>
          <view class="db-row">
            <text class="db-row-l">举报平均处理时长</text>
            <text class="db-row-v tabular-nums">{{
              stats.avgResolveHours == null ? '暂无数据' : stats.avgResolveHours + ' 小时'
            }}</text>
          </view>
        </view>
      </view>

      <!-- 快捷入口 -->
      <view class="db-section">
        <text class="db-section-title">快捷入口</text>
        <view class="db-links">
          <view class="db-link press" @click="go('/pages/admin/recycle')">
            <text>内容回收站</text>
          </view>
          <view class="db-link press" @click="go('/pages/admin/words')">
            <text>敏感词库</text>
          </view>
          <view class="db-link press" @click="go('/pages/admin/announcements')">
            <text>公告管理</text>
          </view>
          <view class="db-link press" @click="go('/pages/admin/categories')">
            <text>类目管理</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'
import { ensureAdmin } from '@/composables/use-admin-guard'

const days = ref(7)
const ranges = [7, 30, 90]
const loading = ref(true)
const error = ref('')
const stats = reactive<any>({
  users: {},
  posts: {},
  products: {},
  comments: {},
  queue: {},
  avgResolveHours: null
})

onLoad(async () => {
  const isAdmin = await ensureAdmin()
  if (isAdmin) await load()
  else loading.value = false
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res: any = await callFunction('admin-stats', { days: days.value })
    Object.assign(stats, {
      users: res?.users || {},
      posts: res?.posts || {},
      products: res?.products || {},
      comments: res?.comments || {},
      queue: res?.queue || {},
      avgResolveHours: res?.avgResolveHours ?? null
    })
  } catch (e: any) {
    error.value = e?.message || String(e)
    console.error('[admin-dashboard]', error.value)
  } finally {
    loading.value = false
  }
}

function setDays(d: number) {
  if (d === days.value) return
  days.value = d
  load()
}

function go(url: string) {
  uni.navigateTo({ url })
}
</script>

<style lang="scss" scoped>
.db-page {
  min-height: 100vh;
  /* #ifdef H5 */
  min-height: calc(100vh - var(--window-top));
  /* #endif */
  background: var(--bg-page);
  color: var(--text-body);
  padding: 8rpx 0 60rpx;
}
.db-head {
  padding: 28rpx 32rpx 12rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.db-kicker {
  align-self: flex-start;
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: var(--accent);
  background: var(--bg-card);
  font-weight: var(--fw-title);
}
.db-title {
  font-size: 40rpx;
}
.db-segs {
  display: flex;
  gap: 12rpx;
  margin-top: 6rpx;
}
.db-seg {
  padding: 6rpx 22rpx;
  font-size: 22rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
}
.db-seg.active {
  color: #0d110e;
  background: var(--accent);
  font-weight: var(--fw-title);
}
.db-section {
  margin: 24rpx 32rpx 0;
}
.db-section-title {
  display: block;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: var(--text-tertiary);
  font-weight: var(--fw-title);
  margin: 0 0 12rpx 4rpx;
  text-transform: uppercase;
}
.db-queue {
  display: flex;
  gap: 16rpx;
}
.db-q {
  flex: 1;
  padding: 24rpx 0;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.db-q-n {
  font-size: 44rpx;
}
.db-q-l {
  font-size: 22rpx;
  color: var(--text-secondary);
}
.db-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}
.db-card {
  padding: 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.db-card-n {
  font-size: 40rpx;
  font-weight: var(--fw-title);
}
.db-card-l {
  font-size: 24rpx;
  color: var(--text-primary);
}
.db-card-sub {
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.db-list {
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.db-row {
  display: flex;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-bottom: 1rpx solid var(--border);
}
.db-row:last-child {
  border-bottom: none;
}
.db-row-l {
  font-size: 26rpx;
  color: var(--text-primary);
}
.db-row-v {
  font-size: 26rpx;
  color: var(--accent);
}
.db-links {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.db-link {
  padding: 18rpx 30rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  font-size: 24rpx;
  color: var(--text-primary);
}
.db-state {
  padding: 60rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}
.db-error {
  font-size: 24rpx;
  color: var(--danger);
}
.db-loading {
  font-size: 24rpx;
  color: var(--text-secondary);
  letter-spacing: 3rpx;
}
.db-retry {
  padding: 10rpx 30rpx;
  font-size: 24rpx;
}
</style>
