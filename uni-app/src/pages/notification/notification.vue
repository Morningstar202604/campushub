<template>
  <view class="nf-page">
    <view class="nf-top">
      <view class="nf-title">
        <text class="nf-kicker">NOTIFICATIONS</text>
        <text class="nf-count" v-if="unreadCount">{{ unreadCount }} 未读</text>
      </view>
      <button v-if="unreadCount" class="nf-markall" @click="markAllRead">全部已读</button>
    </view>

    <!-- z-paging：列表经 v-model 由 z-paging 维护（v2 真实 API：completeByNoMore / completeByError） -->
    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      safe-area-inset-bottom
      @query="queryList"
    >
      <!-- 错误 -->
      <view v-if="error" class="nf-state">
        <text class="nf-state-err">{{ error }}</text>
        <button class="nf-retry" @click="reload">重试</button>
      </view>

      <view class="nf-list">
        <view
          v-for="n in list"
          :key="n.id"
          class="nf-item"
          :class="{ 'nf-item-unread': !n.isRead }"
          @click="onOpen(n)"
        >
          <view class="nf-dot" v-if="!n.isRead"></view>
          <view class="nf-type" :class="'nf-type-' + n.type">{{ typeLabel(n.type) }}</view>
          <view class="nf-content">{{ n.content }}</view>
          <view class="nf-time">{{ n.time }}</view>
        </view>
      </view>

      <template #empty>
        <view class="nf-empty">
          <text class="nf-empty-text">暂无通知</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { callFunction } from '@/utils/api'
import { adaptNotice, type NoticeCard } from '@/adapters'

const pagingRef = ref<any>(null)
// 绑给 <z-paging v-model="list">，由 z-paging 负责累积写入
const list = ref<NoticeCard[]>([])
const unreadCount = ref(0)
const error = ref('')

function typeLabel(type: string): string {
  const m: Record<string, string> = {
    comment: '评论',
    like: '点赞',
    follow: '关注',
    system: '系统',
    reply: '回复',
    mention: '提醒'
  }
  return m[type] || '通知'
}

async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  try {
    const res: any = await callFunction('notification', { action: 'list', page, pageSize: size })
    const pageData = (res?.list ?? []).map(adaptNotice)
    unreadCount.value = res?.unreadCount ?? 0
    // 只回传当前页；z-paging 内部自行拼接。hasMore 由后端 hasMore 决定
    paging.completeByNoMore(pageData, Boolean(res?.hasMore))
  } catch (e: any) {
    error.value = e?.message || String(e)
    console.error('[notification] list 失败', error.value)
    if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
    else paging.complete?.(false)
  }
}

function reload() {
  error.value = ''
  pagingRef.value?.reload?.()
}

async function markAllRead() {
  if (!unreadCount.value) return
  try {
    await callFunction('notification', { action: 'markAllRead' })
    unreadCount.value = 0
    list.value = list.value.map((n) => ({ ...n, isRead: true }))
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function onOpen(n: NoticeCard) {
  // 1) 未读则标记已读（后端参数名是 notificationId）
  if (!n.isRead) {
    try {
      const res: any = await callFunction('notification', { action: 'markRead', notificationId: n.id })
      if (res?.marked) {
        n.isRead = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch (e: any) {
      // 标记失败不阻塞跳转
      console.warn('[notification] markRead 失败', e?.message || e)
    }
  }
  // 2) 按 targetType 跳转（post → 帖子详情；product → 商品详情；user → 他人主页；其余忽略）
  if (!n.targetId) return
  if (n.targetType === 'post') {
    uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${n.targetId}` })
  } else if (n.targetType === 'product') {
    uni.navigateTo({ url: `/pages/product-detail/product-detail?id=${n.targetId}` })
  } else if (n.targetType === 'user') {
    uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${n.targetId}` })
  }
}
</script>

<style lang="scss" scoped>
.nf-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
}

/* 顶部 */
.nf-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
}
.nf-title {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.nf-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
.nf-count {
  font-size: 24rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
.nf-markall {
  background: transparent;
  color: var(--accent);
  font-size: 22rpx;
  font-weight: 400;
  border: 2rpx solid var(--accent);
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
  border-radius: var(--radius-pill);
}

/* 列表 */
.nf-list {
  padding: 0 24rpx 40rpx;
}
.nf-item {
  position: relative;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx 28rpx 24rpx 40rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
  overflow: hidden;
}
.nf-item-unread {
  border-color: var(--border);
  background: var(--bg-elevated);
}
.nf-dot {
  position: absolute;
  left: 16rpx;
  top: 28rpx;
  width: 12rpx;
  height: 12rpx;
  background: var(--accent);
}
.nf-type {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  font-weight: var(--fw-title);
  margin-bottom: 10rpx;
  display: inline-block;
  padding: 2rpx 10rpx;
}
.nf-type-comment {
  color: var(--accent);
  background: var(--bg-elevated);
}
.nf-type-like {
  color: var(--text-secondary);
  background: var(--bg-elevated);
}
.nf-type-follow {
  color: var(--secondary);
  background: var(--bg-elevated);
}
.nf-type-system {
  color: var(--text-body);
  background: var(--bg-deep);
}
.nf-type-reply {
  color: var(--text-secondary);
  background: var(--bg-elevated);
}
.nf-type-mention {
  color: var(--warning);
  background: var(--bg-deep);
}
.nf-content {
  font-size: 27rpx;
  color: var(--text-body);
  line-height: 1.6;
}
.nf-time {
  margin-top: 12rpx;
  font-size: 20rpx;
  color: var(--text-tertiary);
}

/* 空态 / 状态 */
.nf-empty {
  padding: 120rpx 32rpx;
  text-align: center;
}
.nf-empty-text {
  font-size: 24rpx;
  color: var(--text-tertiary);
  letter-spacing: 2rpx;
}
.nf-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.nf-state-err {
  display: block;
  font-size: 24rpx;
  color: var(--danger);
  margin-bottom: 20rpx;
}
.nf-retry {
  background: var(--bg-elevated);
  color: var(--text-body);
  font-size: 24rpx;
  font-weight: var(--fw-title);
  border: 3rpx solid var(--border);
  padding: 0 40rpx;
  height: 64rpx;
  line-height: 64rpx;
}
</style>
