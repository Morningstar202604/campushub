<template>
  <view class="ml-page">
    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      safe-area-inset-bottom
      @query="queryList"
    >
      <view v-if="error" class="ml-state">
        <text class="ml-state-err">{{ error }}</text>
        <button class="ml-retry press" @click="retry">重试</button>
      </view>

      <view class="ml-list">
        <view v-for="c in list" :key="c.conversationId" class="ml-item press" @click="openChat(c)">
          <view class="ml-avatar">
            <image v-if="c.user.avatar" :src="c.user.avatar" class="ml-avatar-img" mode="aspectFill" />
            <text v-else class="ml-avatar-ph">{{ (c.user.nickname || '?').slice(0, 1) }}</text>
            <view v-if="c.unread" class="ml-badge">{{ c.unread > 99 ? '99+' : c.unread }}</view>
          </view>
          <view class="ml-info">
            <view class="ml-name">{{ c.user.nickname }}</view>
            <text class="ml-preview">{{ c.lastMessage.isMine ? '我：' : '' }}{{ c.lastMessage.content }}</text>
          </view>
          <text class="ml-time tabular-nums">{{ fmtTime(c.lastMessage.createdAt) }}</text>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">Messages</text>
          <text class="empty-title">还没有私信</text>
          <text class="empty-sub">在对方主页点「私信」即可开始聊天</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { callFunction } from '@/utils/api'
import { fmtTime } from '@/adapters'

interface Conversation {
  conversationId: string
  user: { _id: string; nickname: string; avatar: string; school: string }
  lastMessage: { content: string; isMine: boolean; createdAt: unknown }
  unread: number
}

const list = ref<Conversation[]>([])
const error = ref('')
const pagingRef = ref<any>(null)

async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  try {
    const res: any = await callFunction('message', { action: 'conversations', page, pageSize: size })
    const rawList: any[] = res?.list ?? []
    const items: Conversation[] = rawList.map((r) => ({
      conversationId: r.conversationId,
      user: {
        _id: r.user?._id || '',
        nickname: r.user?.nickname || '同学',
        avatar: r.user?.avatar || '',
        school: r.user?.school || ''
      },
      lastMessage: {
        content: r.lastMessage?.content || '',
        isMine: Boolean(r.lastMessage?.isMine),
        createdAt: r.lastMessage?.createdAt
      },
      unread: Number(r.unread) || 0
    }))
    const hasMore = rawList.length >= size
    paging.completeByNoMore(items, !hasMore)
  } catch (e: any) {
    error.value = e?.message || String(e)
    if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
    else paging.complete?.(false)
  }
}

function retry() {
  error.value = ''
  pagingRef.value?.reload?.()
}

function openChat(c: Conversation) {
  if (!c.user._id) return
  // @ts-ignore
  uni.navigateTo({
    url: `/pages/chat/chat?withUserId=${c.user._id}&withNickname=${encodeURIComponent(c.user.nickname)}`
  })
}
</script>

<style lang="scss" scoped>
/* 页头固定 + 列表区滚动：z-paging 根节点是 height:100%，父级必须是有确定高度的 flex 容器，
   只用 min-height 会让它的百分比高度解析为 auto，整块内容被 overflow:hidden 裁成 0。 */
.ml-page {
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
.ml-page > z-paging,
.ml-page > .z-paging-content {
  flex: 1 1 0;
  min-height: 0;
}

.ml-list {
  padding: 24rpx 32rpx 40rpx;
}
.ml-item {
  display: flex;
  align-items: center;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.ml-avatar {
  width: 96rpx;
  height: 96rpx;
  border: 3rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-elevated);
  position: relative;
}
.ml-avatar-img {
  width: 100%;
  height: 100%;
}
.ml-avatar-ph {
  font-size: 36rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.ml-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: var(--danger);
  color: #fff;
  font-size: 20rpx;
  line-height: 36rpx;
  text-align: center;
}
.ml-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}
.ml-name {
  font-size: 30rpx;
  font-weight: var(--fw-title);
  color: var(--text-body);
}
.ml-preview {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ml-time {
  flex-shrink: 0;
  margin-left: 16rpx;
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.ml-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.ml-state-err {
  display: block;
  font-size: 24rpx;
  color: var(--danger);
  margin-bottom: 20rpx;
}
.ml-retry {
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
