<template>
  <view class="chat-page">
    <scroll-view
      class="chat-scroll"
      scroll-y
      :scroll-into-view="anchorId"
      scroll-with-animation
      :scroll-top="scrollTop"
    >
      <view v-if="loading && !list.length" class="chat-state">
        <text class="chat-state-text">LOADING</text>
      </view>
      <view v-else-if="!list.length" class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">Messages</text>
        <text class="empty-title">还没有消息</text>
        <text class="empty-sub">发一条打个招呼吧</text>
      </view>
      <view v-for="m in list" :key="m._id" :id="'msg-' + m._id" class="chat-row" :class="{ mine: m.isMine }">
        <view class="chat-bubble">
          <text class="chat-content">{{ m.content }}</text>
          <text class="chat-time tabular-nums">{{ fmtTime(m.createdAt) }}</text>
        </view>
      </view>
      <view id="msg-tail" class="chat-tail"></view>
    </scroll-view>

    <view class="chat-inputbar">
      <input
        v-model="draft"
        class="chat-input"
        type="text"
        placeholder="说点什么…"
        confirm-type="send"
        :adjust-position="true"
        @confirm="onSend"
      />
      <button class="chat-send press" :disabled="!draft.trim() || sending" @click="onSend">
        {{ sending ? '发送中' : '发送' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'
import { fmtTime } from '@/adapters'

interface ChatMessage {
  _id: string
  content: string
  createdAt: unknown
  isMine: boolean
}

const PAGE_SIZE = 50

const list = ref<ChatMessage[]>([])
const draft = ref('')
const loading = ref(true)
const sending = ref(false)
const withUserId = ref('')
const anchorId = ref('')
const scrollTop = ref(0)

onLoad(async (q) => {
  withUserId.value = String(q?.withUserId || '')
  if (!withUserId.value) {
    loading.value = false
    uni.showToast({ title: '缺少会话对象', icon: 'none' })
    return
  }
  // 从通知中心进来时只带 id：补一次资料查询只为把导航栏标题换成对方昵称
  const nick = String(q?.withNickname || '')
  if (nick) {
    uni.setNavigationBarTitle({ title: nick })
  } else {
    try {
      const res: any = await callFunction('user-profile', { userId: withUserId.value })
      uni.setNavigationBarTitle({ title: res?.profile?.nickname || '私信' })
    } catch {
      uni.setNavigationBarTitle({ title: '私信' })
    }
  }
  await loadThread()
})

async function loadThread() {
  loading.value = true
  try {
    const res: any = await callFunction('message', {
      action: 'thread',
      withUserId: withUserId.value,
      page: 1,
      pageSize: PAGE_SIZE
    })
    list.value = (res?.list ?? []).map((m: any) => ({ ...m, isMine: Boolean(m.isMine) }))
    scrollToBottom()
    // 进入会话即清未读（只清对方发给我的，属主过滤在服务端）
    await callFunction('message', { action: 'read', withUserId: withUserId.value }).catch(() => {})
  } catch (e: any) {
    uni.showToast({ title: e?.message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function scrollToBottom() {
  // 双保险：id 锚点（内容变长时）+ scroll-top（内容未变长时，同一值不会二次触发滚动）
  anchorId.value = 'msg-tail'
  scrollTop.value = scrollTop.value + 999999
}

async function onSend() {
  const content = draft.value.trim()
  if (!content || sending.value) return
  if (content.length > 500) {
    uni.showToast({ title: '私信不能超过500字', icon: 'none' })
    return
  }
  sending.value = true
  try {
    const res: any = await callFunction('message', {
      action: 'send',
      toUserId: withUserId.value,
      content
    })
    draft.value = ''
    list.value.push({
      _id: res?.messageId || `temp-${Date.now()}`,
      content,
      createdAt: res?.createdAt || new Date().toISOString(),
      isMine: true
    })
    scrollToBottom()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '发送失败', icon: 'none' })
  } finally {
    sending.value = false
  }
}
</script>

<style lang="scss" scoped>
/* 聊天页：固定头尾 + 中间滚动区。scroll-into-view 锚定尾部元素实现"永远看最新"，
   比 z-paging 的 query 模型更适合聊天流（无需分页交互，首屏拉近 50 条）。 */
.chat-page {
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
}
.chat-scroll {
  flex: 1 1 0;
  min-height: 0;
  padding: 24rpx;
}
.chat-tail {
  height: 1rpx;
}

.chat-row {
  display: flex;
  margin-bottom: 24rpx;
  &.mine {
    justify-content: flex-end;
  }
}
.chat-bubble {
  max-width: 70%;
  background: var(--bg-card);
  border: 3rpx solid var(--border);
  padding: 16rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.chat-row.mine .chat-bubble {
  background: var(--accent-dim);
  border-color: var(--accent);
}
.chat-content {
  font-size: 28rpx;
  color: var(--text-body);
  line-height: 1.5;
  word-break: break-all;
}
.chat-time {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.chat-inputbar {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  /* 底部安全区：与 market/wall 的 FAB 同一套 env() 写法（小程序 H5 均生效） */
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  border-top: 3rpx solid var(--border);
  background: var(--bg-deep);
}
.chat-input {
  flex: 1;
  height: 72rpx;
  background: var(--bg-elevated);
  border: 3rpx solid var(--border);
  padding: 0 20rpx;
  font-size: 26rpx;
  color: var(--text-body);
}
.chat-send {
  flex-shrink: 0;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
  font-weight: var(--fw-title);
  color: #0d110e;
  background: var(--accent);
  border: 3rpx solid var(--border);
  &[disabled] {
    opacity: 0.5;
  }
}

.chat-state {
  padding: 80rpx 32rpx;
  text-align: center;
}
.chat-state-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
}
</style>
