<template>
  <view class="rs-page">
    <view class="rs-head">
      <view class="rs-heading">
        <text class="rs-kicker clip-tag">RECYCLE BIN</text>
        <text class="rs-title title-900">内容回收站</text>
        <text class="rs-sub">恢复被软删的帖子 / 商品 / 评论，恢复后重新可见并回补计数</text>
      </view>
    </view>

    <view class="rs-segs">
      <view
        v-for="t in types"
        :key="t.value"
        class="rs-seg clip-tag press"
        :class="{ active: activeType === t.value }"
        @click="switchType(t.value)"
      >
        <text>{{ t.label }}</text>
      </view>
    </view>

    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      safe-area-inset-bottom
      @query="queryList"
    >
      <view v-if="error" class="rs-state">
        <text class="rs-error">{{ error }}</text>
        <button class="btn-ghost rs-retry press" @click="reload">重试</button>
      </view>

      <view v-for="d in list" :key="d._id" class="rs-card sticker">
        <view class="rs-card-head">
          <text class="rs-title-text">{{ d.title || d.content || '(无标题)' }}</text>
          <text class="rs-time tabular-nums">{{ fmtTime(d.updatedAt || d.createdAt) }}</text>
        </view>
        <text v-if="d.content && d.title" class="rs-snippet">{{ snippet(d.content) }}</text>
        <text class="rs-meta">{{ ownerLabel(d) }}</text>
        <view class="rs-actions">
          <button class="rs-btn rs-btn-accent press" @click="restore(d)">恢复</button>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape empty-shape--hex"></view>
          <text class="empty-kicker">RECYCLE BIN</text>
          <text class="empty-title">回收站是空的</text>
          <text class="empty-sub">被删除的{{ typeLabel(activeType) }}会出现在这里</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'
import { fmtTime } from '@/adapters'
import { ensureAdmin } from '@/composables/use-admin-guard'

const pagingRef = ref<any>(null)
const list = ref<any[]>([])
const error = ref('')
const activeType = ref<RecycleType>('post')
type RecycleType = 'post' | 'product' | 'comment'
const types: { label: string; value: RecycleType }[] = [
  { label: '帖子', value: 'post' },
  { label: '商品', value: 'product' },
  { label: '评论', value: 'comment' }
]

onLoad(async () => {
  const isAdmin = await ensureAdmin()
  if (isAdmin) pagingRef.value?.reload?.()
})

function typeLabel(t: string) {
  return t === 'product' ? '商品' : t === 'comment' ? '评论' : '帖子'
}

function snippet(s: string) {
  const v = String(s || '')
  return v.length > 80 ? v.slice(0, 80) + '…' : v
}

function ownerLabel(d: any) {
  return [d.userNickname || d.userId || '未知作者', d.status].filter(Boolean).join(' · ')
}

async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  try {
    const res: any = await callFunction('content-restore', {
      action: 'list',
      type: activeType.value,
      page,
      pageSize: size
    })
    const rows = res?.list ?? []
    paging.completeByNoMore(rows, rows.length < size)
  } catch (e: any) {
    error.value = e?.message || String(e)
    if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
    else paging.complete?.(false)
  }
}

function reload() {
  error.value = ''
  pagingRef.value?.reload?.()
}

function switchType(v: RecycleType) {
  if (v === activeType.value) return
  activeType.value = v
  reload()
}

async function restore(d: any) {
  const ok: any = await new Promise((resolve) => {
    uni.showModal({
      title: '恢复内容',
      content: '恢复后该内容会重新出现在列表与详情页，确定继续？',
      confirmText: '恢复',
      success: resolve,
      fail: () => resolve(null)
    })
  })
  if (!ok?.confirm) return
  try {
    await callFunction('content-restore', {
      action: 'restore',
      targetType: activeType.value,
      targetId: d._id
    })
    list.value = list.value.filter((x) => x._id !== d._id)
    uni.showToast({ title: '已恢复', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '恢复失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.rs-page {
  display: flex;
  flex-direction: column;
  /* #ifdef H5 */
  height: calc(100vh - var(--window-top));
  /* #endif */
  /* #ifndef H5 */
  height: 100vh;
  /* #endif */
  background: var(--bg-page);
  color: var(--text-body);
}
.rs-page > z-paging {
  flex: 1 1 0;
  min-height: 0;
}
.rs-head {
  padding: 28rpx 32rpx 12rpx;
}
.rs-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.rs-kicker {
  align-self: flex-start;
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: var(--accent);
  background: var(--bg-card);
  font-weight: var(--fw-title);
}
.rs-title {
  font-size: 40rpx;
}
.rs-sub {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.rs-segs {
  display: flex;
  gap: 12rpx;
  padding: 12rpx 32rpx 16rpx;
}
.rs-seg {
  padding: 8rpx 26rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
}
.rs-seg.active {
  color: #0d110e;
  background: var(--accent);
  font-weight: var(--fw-title);
}
.rs-card {
  margin: 16rpx 32rpx;
  padding: 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.rs-card-head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}
.rs-title-text {
  flex: 1;
  font-size: 28rpx;
  font-weight: var(--fw-title);
  word-break: break-all;
}
.rs-time {
  font-size: 20rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.rs-snippet {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}
.rs-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.rs-actions {
  margin-top: 18rpx;
  display: flex;
  gap: 16rpx;
}
.rs-btn {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 32rpx;
  margin: 0;
  font-size: 24rpx;
  background: transparent;
  color: var(--text-primary);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.rs-btn::after {
  border: none;
}
.rs-btn-accent {
  background: var(--accent);
  color: #0d110e;
  font-weight: var(--fw-title);
  border-color: var(--accent);
}
.rs-state {
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  align-items: center;
}
.rs-error {
  font-size: 24rpx;
  color: var(--danger);
}
.rs-retry {
  padding: 10rpx 30rpx;
  font-size: 24rpx;
}
</style>
