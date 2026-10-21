<template>
  <view class="nf-page">
    <view class="nf-top">
      <view class="nf-title">
        <text class="nf-kicker clip-tag">NOTIFICATIONS</text>
        <text class="nf-count accent-num" v-if="unreadCount">{{ unreadCount }} 未读</text>
      </view>
      <button v-if="unreadCount" class="nf-markall btn-ghost" @click="markAllRead">全部已读</button>
    </view>

    <!-- z-paging：列表经 v-model 由 z-paging 维护（v2 真实 API：completeByNoMore / completeByError） -->
    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      :back-to-top="true"
      safe-area-inset-bottom
      @query="queryList"
    >
      <!-- 错误 -->
      <view v-if="error" class="nf-state">
        <view class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">ERROR</text>
          <text class="empty-title">{{ error }}</text>
        </view>
        <button class="nf-retry" @click="reload">重试</button>
      </view>

      <view class="nf-list">
        <view
          v-for="n in list"
          :key="n.id"
          class="nf-item press"
          :class="{ 'nf-item-unread': !n.isRead }"
          @click="onOpen(n)"
        >
          <view class="nf-dot" v-if="!n.isRead"></view>
          <view class="nf-type" :class="'nf-type-' + n.type">{{ typeLabel(n.type) }}</view>
          <view class="nf-content">{{ n.content }}</view>
          <view class="nf-time">{{ n.time }}</view>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">NOTIFICATIONS</text>
          <text class="empty-title">暂无通知</text>
          <text class="empty-sub">有新消息会第一时间告诉你</text>
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
    // 只回传当前页；z-paging 内部自行拼接。
    // 第二参数是 noMore（没有更多）—— 必须取反，否则后端还有下一页时会被判成已到底。
    paging.completeByNoMore(pageData, !Boolean(res?.hasMore))
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
    // 不碰 tabBar：tabBar[3] 是「失物」而非通知，角标由首页「通知」入口读 unreadCount 展示。
  } catch (e: any) {
    uni.showToast({ title: '操作失败', icon: 'none' })
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
/* 页头固定 + 列表区滚动：z-paging 的 .z-paging-content 是 height:100%，
   父级必须是「确定高度」的 flex 容器，只写 min-height 会让它算成 0 并裁掉全部内容。
   --window-top 在 H5 上是导航栏高度，小程序端未定义 → 回退 0px（此时 100vh 已是可视区）。 */
.nf-page {
  display: flex;
  flex-direction: column;
  /* H5：--window-top 是导航栏高度，必须扣掉，否则 100vh 会多出一截并产生滚动条。
     小程序/App：没有该变量，100vh 已是可视区（导航栏由原生层占位）。 */
  /* #ifdef H5 */
  height: calc(100vh - var(--window-top));
  /* #endif */
  /* #ifndef H5 */
  height: 100vh;
  /* #endif */
  background: var(--bg-page);
  color: var(--text-body);
}
.nf-page > z-paging,
.nf-page > .z-paging-content {
  flex: 1 1 0;
  min-height: 0;
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
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.nf-count {
  font-size: 24rpx;
  font-weight: var(--fw-title);
}
.nf-markall {
  font-size: 22rpx;
  font-weight: var(--fw-body);
  padding: 0 24rpx;
  height: 56rpx;
  line-height: 56rpx;
}

/* 列表 */
.nf-list {
  padding: 0 24rpx 40rpx;
}
.nf-item {
  position: relative;
  border: 2rpx solid var(--border);
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
  background: var(--text-tertiary);
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
  color: var(--text-secondary);
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

/* 状态 */
.nf-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.nf-retry {
  background: var(--bg-elevated);
  color: var(--text-body);
  font-size: 24rpx;
  font-weight: var(--fw-title);
  border: 2rpx solid var(--border);
  padding: 0 40rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: var(--radius-sharp);
}
</style>
