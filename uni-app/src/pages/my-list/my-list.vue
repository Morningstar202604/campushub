<template>
  <view class="my-root">
    <!-- 个人资料条：此前「我的」没有任何直达自己主页/编辑资料的入口，
         普通用户只能从通知或关注页间接进入 user-profile，改昵称头像在真实流程里不可达 -->
    <view class="me-bar sticker press" @click="goMyProfile">
      <view class="me-avatar">
        <image v-if="me.avatar" class="me-avatar-img" :src="me.avatar" mode="aspectFill" />
        <text v-else class="me-avatar-ph">{{ (me.nickname || '?').slice(0, 1) }}</text>
      </view>
      <view class="me-info">
        <text class="me-name title-900">{{ me.nickname || '未登录' }}</text>
        <text class="me-sub">{{ me.school || '点击查看个人主页' }}</text>
      </view>
      <text class="me-arrow">→</text>
    </view>

    <!-- 顶部统计 -->
    <view class="stat-row sticker">
      <view class="stat-item">
        <text class="stat-num accent-num">{{ stats.posts }}</text>
        <text class="stat-label">帖子</text>
      </view>
      <view class="stat-item">
        <text class="stat-num accent-num">{{ stats.products }}</text>
        <text class="stat-label">好物</text>
      </view>
      <view class="stat-item">
        <text class="stat-num accent-num">{{ stats.collects }}</text>
        <text class="stat-label">收藏</text>
      </view>
    </view>

    <!-- 校园认证入口：全量用户可见（后端 verify 云函数据此判定能否提交/是否已认证） -->
    <view class="admin-entry sticker press" @click="goVerify">
      <text class="admin-entry-badge clip-tag">VERIFY</text>
      <view class="admin-entry-main">
        <text class="admin-entry-title title-900">校园认证</text>
        <text class="admin-entry-sub">上传学生证，认证后内容展示「已认证」标识</text>
      </view>
      <text class="admin-entry-arrow">→</text>
    </view>

    <!-- 管理台入口：仅管理员可见（role 为服务端权威字段，restore() 时经 login 刷新） -->
    <view v-if="isAdmin" class="admin-entry sticker press" @click="goAdmin">
      <text class="admin-entry-badge clip-tag">ADMIN</text>
      <view class="admin-entry-main">
        <text class="admin-entry-title title-900">管理台</text>
        <text class="admin-entry-sub">举报 · 用户 · 认证 · 反馈 · 公告 · 类目</text>
      </view>
      <text class="admin-entry-arrow">→</text>
    </view>

    <!-- 内容发现入口：指南与关注列表此前注册但零链接，用户点不到 -->
    <view class="entry-row">
      <view class="entry-chip sticker press" @click="goPage('/pages/guide-list/guide-list')">
        <text class="entry-chip-label">校园指南</text>
      </view>
      <view class="entry-chip sticker press" @click="goPage('/pages/follow/follow')">
        <text class="entry-chip-label">关注 / 粉丝</text>
      </view>
      <view class="entry-chip sticker press" @click="goPage('/pages/feedback/feedback')">
        <text class="entry-chip-label">意见反馈</text>
      </view>
    </view>

    <!-- Tab：帖子 / 好物 / 收藏 -->
    <view class="tab-row">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="my-tab clip-tag press"
        :class="{ active: t.value === tab }"
        @click="onTab(t.value)"
      >
        <text>{{ t.label }}</text>
      </view>
    </view>

    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      :back-to-top="true"
      @query="queryList"
      safe-area-inset-bottom
    >
      <!-- 请求失败：出错时必须占用列表位，否则 #empty 空态会顶着「还没有内容」显示，与失败原因矛盾 -->
      <view v-if="error" class="my-state">
        <view class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">ERROR</text>
          <text class="empty-title">{{ error }}</text>
        </view>
        <button class="btn-ghost my-retry press" @click="reload">重试</button>
      </view>

      <view
        v-for="item in list"
        :key="item.id"
        class="my-card sticker press"
        :class="{ collect: tab === 'collects' }"
        @click="openDetail(item)"
      >
        <image v-if="item.image" class="my-img" :src="item.image" mode="aspectFill" lazy-load />
        <view class="my-body">
          <text class="my-title">{{ item.title }}</text>
          <text class="my-content">{{ item.content }}</text>
          <view class="my-foot">
            <view v-if="tab === 'collects'" class="my-kind clip-tag">
              <text>收藏</text>
            </view>
            <text class="my-time tabular-nums">{{ item.time }}</text>
            <!-- 编辑：仅自己的帖子/商品（收藏 tab 是他人内容，不显示） -->
            <view
              v-if="tab !== 'collects'"
              class="my-edit btn-ghost press"
              @click.stop="onEdit(item)"
            >
              <text>编辑</text>
            </view>
            <!-- 标记已售 / 重新上架：仅自己的商品，按状态二态切换 -->
            <view
              v-if="tab === 'products' && item.type === 'product'"
              class="my-sold btn-ghost press"
              :class="{ sold: item.status === 'sold' }"
              @click.stop="onToggleSold(item)"
            >
              <text>{{ item.status === 'sold' ? '重新上架' : '标记已售' }}</text>
            </view>
            <view
              v-if="tab !== 'collects' && (item.type === 'post' || item.type === 'product')"
              class="my-del btn-ghost press"
              @click.stop="onDelete(item)"
            >
              <text>删除</text>
            </view>
          </view>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">My List</text>
          <text class="empty-title">这里还黑着灯</text>
          <text class="empty-sub">还没有内容</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePagedList } from '@/composables/use-paged-list'
import { adaptMyItem } from '@/adapters'
import { callFunction } from '@/utils/api'
import { useUserStore } from '@/stores/user'

// 管理台入口显隐：role 只在 login 云函数返回后可信（restore 刷新），不持久化
const userStore = useUserStore()
const isAdmin = computed(() => userStore.userInfo?.role === 'admin')
/** 个人资料条用：昵称/头像/学校 */
const me = computed(() => (userStore.userInfo || {}) as any)

/** 打开自己的主页（user-profile 传自己的 _id） */
function goMyProfile() {
  const id = userStore.userInfo?._id
  if (!id) {
    uni.navigateTo({ url: '/pages/user-update/user-update' })
    return
  }
  uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${id}` })
}

function goAdmin() {
  uni.navigateTo({ url: '/pages/admin/admin' })
}

function goVerify() {
  uni.navigateTo({ url: '/pages/verify/verify' })
}

function goPage(url: string) {
  uni.navigateTo({ url })
}

const tabs = [
  { label: '帖子', value: 'posts' },
  { label: '好物', value: 'products' },
  { label: '收藏', value: 'collects' }
]
const tab = ref('posts')
const stats = ref<any>({ posts: '0', products: '0', collects: '0' })

// 响应式 query：切 tab 时 hook 自动取最新 type（hook 支持 ref/computed）
const liveQuery = computed(() => ({ type: tab.value }))
const { pagingRef, list, queryList, reload, error } = usePagedList({
  fnName: 'my-list',
  query: liveQuery,
  adapt: (raw) => adaptMyItem(raw, tab.value as any)
})

function onTab(v: string) {
  if (v === tab.value) return
  tab.value = v
  reload()
}

// 统计：走后端 stats 模式（my-list { stats: true } → counts），返回真实计数；
// 旧实现用 pageSize=1 + hasMore 猜数，只会显示 0/1/99+，完全失真。
async function loadStats() {
  try {
    const res: any = await callFunction('my-list', { stats: true })
    const c = res?.counts || {}
    stats.value = {
      posts: String(c.posts ?? 0),
      products: String(c.products ?? 0),
      collects: String(c.collects ?? 0)
    }
  } catch {
    stats.value = { posts: '-', products: '-', collects: '-' }
  }
}

// 按 item.type 分流：商品 → 商品详情，帖子（含收藏里的帖子）→ 帖子详情
function openDetail(item: any) {
  const url =
    item.type === 'product'
      ? `/pages/product-detail/product-detail?id=${item.id}`
      : `/pages/post-detail/post-detail?id=${item.id}`
  // @ts-ignore
  uni.navigateTo({ url })
}

async function onDelete(item: any) {
  const modal: any = await new Promise((resolve) => {
    uni.showModal({
      title: '删除',
      content: '确定删除该条内容？删除后不可恢复',
      confirmText: '删除',
      success: (r) => resolve(r),
      fail: () => resolve(null)
    })
  })
  if (!modal?.confirm) return
  try {
    // 商品用 product-delete、帖子用 post-delete（后端为两套独立云函数）
    if (item.type === 'product') {
      await callFunction('product-delete', { productId: item.id })
    } else {
      await callFunction('post-delete', { postId: item.id })
    }
    uni.showToast({ title: '已删除', icon: 'success' })
    reload()
    // 统计也要重算：旧版只 reload 列表，删掉唯一一条后顶部仍显示「1 帖子」
    loadStats()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
  }
}

// 编辑：带 id 跳创建页，创建页读 query 进入编辑模式（预填表单）
function onEdit(item: any) {
  const url =
    item.type === 'product'
      ? `/pages/product-create/product-create?id=${item.id}`
      : `/pages/post-create/post-create?id=${item.id}`
  // @ts-ignore
  uni.navigateTo({ url })
}

// 标记已售 / 重新上架：product-update 的快捷操作，只传 markSold（true→sold，false→on_sale）
async function onToggleSold(item: any) {
  const mark = item.status !== 'sold'
  try {
    const res: any = await callFunction('product-update', { productId: item.id, markSold: mark })
    // 以后端返回的最终状态为准回写本地行，避免与后端状态机不一致
    item.status = res?.status || (mark ? 'sold' : 'on_sale')
    uni.showToast({ title: mark ? '已标记为已售' : '已重新上架', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

onMounted(() => loadStats())

// onShow 刷新：从编辑页 navigateBack 回来后重拉列表与统计。
// 首次进入的 onShow 跳过（z-paging :auto 已发首屏请求，避免双请求）。
let firstShow = true
onShow(() => {
  if (firstShow) {
    firstShow = false
    return
  }
  reload()
  loadStats()
})
</script>

<style lang="scss" scoped>
/* 统计 + Tab 固定，列表区滚动：z-paging 根节点是 height:100%，
   父级必须是有确定高度的 flex 容器，只用 padding 会让内容区被裁成 0。 */
.my-root {
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
  padding: 24rpx 0 0;
  box-sizing: border-box;
}
.my-root > z-paging,
.my-root > .z-paging-content {
  flex: 1 1 0;
  min-height: 0;
}

.my-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0;
  gap: 24rpx;
}
.my-retry {
  padding: 0 48rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
}

.stat-row {
  display: flex;
  justify-content: space-around;
  padding: 24rpx;
  margin: 0 32rpx 20rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.stat-num {
  font-size: 40rpx;
  font-weight: var(--fw-title);
}
.stat-label {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.tab-row {
  display: flex;
  padding: 0 32rpx 16rpx;
  gap: 16rpx;
}
.my-tab {
  padding: 10rpx 32rpx;
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

.admin-entry {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 0 32rpx 20rpx;
  padding: 20rpx 24rpx;
  background: var(--bg-elevated);
  border: 1rpx solid var(--accent-dim);
  border-radius: var(--radius-sharp);
  .admin-entry-badge {
    font-size: 18rpx;
    letter-spacing: 3rpx;
    font-weight: var(--fw-title);
    color: #0d110e;
    background: var(--accent);
    padding: 6rpx 14rpx;
  }
  .admin-entry-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
  }
  .admin-entry-title {
    font-size: 28rpx;
    color: var(--text-primary);
  }
  .admin-entry-sub {
    font-size: 20rpx;
    color: var(--text-tertiary);
  }
  .admin-entry-arrow {
    font-size: 28rpx;
    color: var(--accent);
    font-weight: var(--fw-title);
  }
}

.my-card {
  display: flex;
  gap: 20rpx;
  margin: 20rpx 32rpx;
  padding: 20rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  .my-img {
    width: 140rpx;
    height: 140rpx;
    border-radius: var(--radius-sharp);
    flex-shrink: 0;
    background: var(--bg-elevated);
  }
  .my-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .my-title {
    font-size: 28rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .my-content {
    font-size: 24rpx;
    color: var(--text-secondary);
    margin-top: 8rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .my-foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 12rpx;
    padding-top: 12rpx;
  }
  .my-kind {
    padding: 2rpx 12rpx;
    font-size: 20rpx;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    font-weight: var(--fw-title);
  }
  .my-time {
    font-size: 22rpx;
    color: var(--text-tertiary);
  }
  .my-edit {
    margin-left: auto;
    padding: 4rpx 16rpx;
    font-size: 22rpx;
    font-weight: var(--fw-body);
    color: var(--accent);
    border-radius: var(--radius-sharp);
  }
  .my-sold {
    padding: 4rpx 16rpx;
    font-size: 22rpx;
    font-weight: var(--fw-body);
    color: var(--secondary);
    border-radius: var(--radius-sharp);
  }
  .my-sold.sold {
    color: var(--text-tertiary);
  }
  .my-del {
    padding: 4rpx 16rpx;
    font-size: 22rpx;
    font-weight: var(--fw-body);
    color: var(--danger);
    border-radius: var(--radius-sharp);
  }
  .my-del .btn-ghost:active {
    border-color: var(--danger);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0;
  .empty-shape {
    width: 64rpx;
    height: 64rpx;
    background: var(--accent);
    opacity: 0.15;
    clip-path: var(--clip-diamond);
    margin-bottom: 24rpx;
  }
  .empty-title {
    font-size: 32rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
  }
  .empty-sub {
    margin-top: 8rpx;
    font-size: 24rpx;
    color: var(--text-secondary);
  }
}

/* 内容发现入口行 */
.entry-row {
  display: flex;
  gap: 16rpx;
  margin: 0 32rpx 20rpx;
}
.entry-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 0;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
}
.entry-chip-label {
  font-size: 24rpx;
  color: var(--text-secondary);
}

/* 个人资料条 */
.me-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 0 32rpx 20rpx;
  padding: 20rpx 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.me-avatar {
  width: 88rpx;
  height: 88rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border-radius: var(--radius-sharp);
  overflow: hidden;
}
.me-avatar-img {
  width: 88rpx;
  height: 88rpx;
}
.me-avatar-ph {
  font-size: 36rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
}
.me-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.me-name {
  font-size: 32rpx;
  color: var(--text-primary);
}
.me-sub {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.me-arrow {
  font-size: 28rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
</style>
