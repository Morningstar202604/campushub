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
      <!-- 演示模式提示：避免把种子数据误当真实社区内容 -->
      <view v-if="isDemo" class="demo-banner press" @click="goPage('/pages/feedback/feedback')">
        <text class="demo-banner-tag clip-tag">DEMO</text>
        <text class="demo-banner-text">当前为本地演示数据，未连接云环境</text>
      </view>

      <!-- 页头 -->
      <view class="page-header">
        <text class="title-900 page-title">{{ schoolName }}</text>
        <view class="header-right">
          <view class="clip-tag sticker"><text class="page-badge">墨荧</text></view>
          <!-- 设置入口：「设置」是应用的必备基础设施（主题/隐私协议/退出登录/清缓存） -->
          <view class="header-gear press" @click="goPage('/pages/settings/settings')">
            <text class="header-gear-text">设置</text>
          </view>
        </view>
      </view>

      <!-- 功能入口排：搜索 / 通知(未读角标) / 签到 / 积分 / 我的内容 -->
      <view class="quick-row">
        <view class="quick-item press" @click="goPage('/pages/search/search')">
          <text class="quick-label">搜索</text>
        </view>
        <view class="quick-item press" @click="goPage('/pages/notification/notification')">
          <text class="quick-label">通知</text>
          <view v-if="userStore.unreadCount" class="quick-badge">
            <text>{{ userStore.unreadCount > 99 ? '99+' : userStore.unreadCount }}</text>
          </view>
        </view>
        <view class="quick-item press" @click="goPage('/pages/checkin/checkin')">
          <text class="quick-label">签到</text>
        </view>
        <view class="quick-item press" @click="goPage('/pages/points/points')">
          <text class="quick-label">积分</text>
        </view>
        <view class="quick-item press" @click="goPage('/pages/my-list/my-list')">
          <text class="quick-label">我的</text>
        </view>
      </view>

      <!-- 公告条（非分页内容，置顶固定） -->
      <view v-if="announcements.length" class="ann-bar sticker">
        <view v-for="a in announcements" :key="a.id" class="ann-item" @click="onAnnouncement(a)">
          <view v-if="a.pinned" class="ann-pin clip-tag"><text>置顶</text></view>
          <text class="ann-title">{{ a.title }}</text>
          <text class="ann-time tabular-nums">{{ a.time }}</text>
        </view>
      </view>

      <!-- 全校园信息流：推荐 / 最新 / 热榜 切换 -->
      <view class="feed-tabs">
        <view
          v-for="t in tabs"
          :key="t.value"
          class="feed-tab clip-tag press"
          :class="{ active: t.value === activeTab }"
          @click="onTab(t.value)"
        >
          <text>{{ t.label }}</text>
        </view>
      </view>
    </template>

    <view v-if="error" class="error-banner sticker">
      <text class="error-text">{{ error }}</text>
      <text class="error-retry press" @click="reload">重试</text>
    </view>

    <view
      v-for="item in list"
      :key="item.id"
      class="feed-card sticker press"
      @click="openDetail(item)"
    >
      <view class="feed-kind clip-tag"
        ><text>{{ kindLabel(item.kind) }}</text></view
      >
      <text class="feed-content">{{ item.content }}</text>
      <view class="feed-foot">
        <view class="feed-author-wrap">
          <text class="feed-author">{{ item.author }}</text>
          <text v-if="item.authorVerified" class="feed-verified clip-tag">已认证</text>
        </view>
        <text class="feed-time tabular-nums">{{ item.time }}</text>
      </view>
    </view>

    <!-- 为悬浮按钮留出底部空间：必须放在列表外层，
         早先误放在 #empty 插槽里，只有空列表时才有这段留白，
         有内容时最后一张卡片会被 FAB 压住（实测截图中正文被「发布」遮住）。 -->
    <view class="feed-list-tail"></view>

    <template #empty="{ isLoadFailed }">
      <view v-if="!isLoadFailed" class="empty-state">
        <text class="empty-kicker">CAMPUS</text>
        <view class="empty-shape"></view>
        <text class="empty-title">这里还黑着灯</text>
        <text class="empty-sub">校园内容还没点亮</text>
        <view class="empty-cta press" @click="openCreate('post')">
          <text>发布第一条内容</text>
        </view>
      </view>
    </template>
  </z-paging>

  <!-- 悬浮发布入口（帖子 + 好物 两个） -->
  <view class="fab-stack">
    <view class="fab sticker press" @click="openCreate('product')">
      <text class="fab-label">好物</text>
    </view>
    <view class="fab fab--primary sticker press" @click="openCreate('post')">
      <text class="fab-label">发布</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShareAppMessage } from '@dcloudio/uni-app'
import { ref, computed, onMounted } from 'vue'
import { usePagedList } from '@/composables/use-paged-list'
import { adaptWall, loadAnnouncements } from '@/adapters'
import { useSchoolStore } from '@/stores/school'
import { useUserStore } from '@/stores/user'
import { shouldUseDemo } from '@/utils/api'

const schoolStore = useSchoolStore()
const userStore = useUserStore()
const schoolName = computed(() => schoolStore.schoolName || 'CampusHub')
const isDemo = computed(() => shouldUseDemo())

const tabs = [
  { label: '推荐', value: 'recommend' },
  { label: '最新', value: 'latest' },
  { label: '热榜', value: 'hot' }
]
const activeTab = ref('recommend')

const announcements = ref<any[]>([])

// 信息流走 hook（响应式 tab），列表由 z-paging 经 v-model 写回
const liveQuery = computed(() => ({ tab: activeTab.value }))
const { pagingRef, list, queryList, error, reload } = usePagedList({
  fnName: 'post-list',
  query: liveQuery,
  adapt: adaptWall
})

function onTab(v: string) {
  if (v === activeTab.value) return
  activeTab.value = v
  reload()
}

function openDetail(item: any) {
  // @ts-ignore
  uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${item.id}` })
}

function openCreate(type: 'post' | 'product') {
  // @ts-ignore
  uni.navigateTo({
    url:
      type === 'product' ? '/pages/product-create/product-create' : '/pages/post-create/post-create'
  })
}

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    post: '信息',
    task: '任务',
    lost: '失物',
    found: '招领',
    confession: '表白'
  }
  return map[kind] || kind || '校园'
}

function onAnnouncement(a: any) {
  // 展示公告正文（公告无独立详情页）
  // @ts-ignore
  uni.showModal({
    title: a.title || '公告',
    content: a.content || '',
    showCancel: false,
    confirmText: '知道了'
  })
}

// 首次进入只拉公告（信息流由 z-paging @query 首屏自动加载，避免重复请求 post-list）
onMounted(async () => {
  // 未读通知数：登录态下刷新一次，供「通知」入口角标显示（App onShow 也会刷）
  if (userStore.isLoggedIn) userStore.refreshUnreadCount()
  try {
    announcements.value = await loadAnnouncements()
  } catch {
    announcements.value = []
  }
})

function goPage(url: string) {
  // @ts-ignore
  uni.navigateTo({ url })
}

// 分享给好友（小程序端生效；H5/App 无害）
onShareAppMessage(() => ({ title: 'CampusHub · {school}', path: '/pages/index/index' }))
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 32rpx;
}

/* 右上角「墨荧」徽章 + 设置入口：竖向排列时徽章在上、设置在下，
   基线对齐让两行文字贴住底边（水平居中的旧写法会把「设置」顶到标题行中间）。 */
.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}
.header-gear {
  padding: 4rpx 4rpx;
}
.header-gear-text {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.demo-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 0 32rpx 4rpx;
  padding: 10rpx 16rpx;
  background: var(--bg-elevated);
  border: 1rpx solid var(--accent-dim);
}
.demo-banner-tag {
  padding: 2rpx 12rpx;
  font-size: 18rpx;
  font-weight: var(--fw-title);
  color: var(--bg-page);
  background: var(--accent);
  letter-spacing: 2rpx;
}
.demo-banner-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}
.page-title {
  font-size: 40rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.page-badge {
  padding: 6rpx 20rpx;
  font-size: 22rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  background: var(--bg-card);
}

/* 功能入口排（搜索/通知/签到/积分/我的） */
.quick-row {
  display: flex;
  gap: 16rpx;
  padding: 0 32rpx 8rpx;
}
.quick-item {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  .quick-label {
    font-size: 24rpx;
    color: var(--text-secondary);
  }
  .quick-badge {
    position: absolute;
    top: -10rpx;
    right: -8rpx;
    min-width: 32rpx;
    height: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 8rpx;
    background: var(--accent);
    text {
      font-size: 18rpx;
      font-weight: var(--fw-title);
      color: #0d110e;
    }
  }
}

.ann-bar {
  margin: 0 32rpx;
  padding: 8rpx 0;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.ann-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 20rpx;
}
.ann-pin {
  padding: 2rpx 12rpx;
  font-size: 18rpx;
  color: var(--accent);
  background: var(--bg-elevated);
  font-weight: var(--fw-title);
}
.ann-title {
  font-size: 24rpx;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ann-time {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

.feed-tabs {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx 8rpx;
}
.feed-tab {
  padding: 8rpx 32rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  &.active {
    color: #0d110e;
    background: var(--accent);
    font-weight: var(--fw-title);
  }
}

.feed-card {
  margin: 20rpx 32rpx;
  padding: 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}

/* 列表底部为悬浮按钮留白：FAB 是 fixed 定位，不占文档流，
   最后一张卡片会被它压住正文与时间（实测命中 .feed-content）。
   高度 = 两个 FAB(96rpx) + gap(16rpx) + 底部偏移(160rpx) + 余量。 */
.feed-list-tail {
  height: 320rpx;
}
.feed-kind {
  display: inline-block;
  padding: 2rpx 16rpx;
  font-size: 20rpx;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  font-weight: var(--fw-title);
  margin-bottom: 12rpx;
}
.feed-content {
  display: block;
  font-size: 28rpx;
  color: var(--text-primary);
  line-height: 1.7;
}
.feed-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 16rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.feed-author-wrap {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}
.feed-verified {
  padding: 2rpx 10rpx;
  font-size: 18rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  background: var(--bg-elevated);
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
    display: inline-block;
    padding: 4rpx 12rpx;
  }
}

/* 悬浮发布入口（右下角，两枚硬投影方块，非圆球——反 AI 味） */
.fab-stack {
  position: fixed;
  right: 32rpx;
  bottom: 160rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  z-index: 999;
}
.fab {
  width: 96rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 8rpx 100%, 0 calc(100% - 8rpx));

  .fab-label {
    font-size: 24rpx;
    font-weight: var(--fw-title);
    color: var(--accent);
  }

  &--primary {
    background: var(--accent);
    .fab-label {
      color: #0d110e;
    }
  }
}
</style>
