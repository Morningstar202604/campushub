<template>
  <view class="my-root">
    <!-- 顶部统计 -->
    <view class="stat-row sticker">
      <view class="stat-item">
        <text class="stat-num tabular-nums">{{ stats.posts }}</text>
        <text class="stat-label">帖子</text>
      </view>
      <view class="stat-item">
        <text class="stat-num tabular-nums">{{ stats.products }}</text>
        <text class="stat-label">好物</text>
      </view>
      <view class="stat-item">
        <text class="stat-num tabular-nums">{{ stats.collects }}</text>
        <text class="stat-label">收藏</text>
      </view>
    </view>

    <!-- Tab：帖子 / 好物 / 收藏 -->
    <view class="tab-row">
      <view v-for="t in tabs" :key="t.value" class="tab" :class="{ active: t.value === tab }" @click="onTab(t.value)">
        <text>{{ t.label }}</text>
      </view>
    </view>

    <z-paging ref="pagingRef" v-model="list" :auto="true" @query="queryList" safe-area-inset-bottom>
      <view
        v-for="item in list"
        :key="item.id"
        class="my-card sticker"
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
            <text
              v-if="tab !== 'collects'"
              class="my-edit"
              @click.stop="onEdit(item)"
            >编辑</text>
            <!-- 标记已售 / 重新上架：仅自己的商品，按状态二态切换 -->
            <text
              v-if="tab === 'products' && item.type === 'product'"
              class="my-sold"
              :class="{ sold: item.status === 'sold' }"
              @click.stop="onToggleSold(item)"
            >{{ item.status === 'sold' ? '重新上架' : '标记已售' }}</text>
            <text
              v-if="tab !== 'collects' && (item.type === 'post' || item.type === 'product')"
              class="my-del"
              @click.stop="onDelete(item)"
            >删除</text>
          </view>
        </view>
      </view>

      <template #empty>
        <view class="empty-state">
          <view class="empty-shape"></view>
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

const tabs = [
  { label: '帖子', value: 'posts' },
  { label: '好物', value: 'products' },
  { label: '收藏', value: 'collects' }
]
const tab = ref('posts')
const stats = ref<any>({ posts: '0', products: '0', collects: '0' })

// 响应式 query：切 tab 时 hook 自动取最新 type（hook 支持 ref/computed）
const liveQuery = computed(() => ({ type: tab.value }))
const { pagingRef, list, queryList, reload } = usePagedList({
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
.my-root { padding: 24rpx 0; }

.stat-row {
  display: flex; justify-content: space-around; padding: 24rpx; margin: 0 32rpx 20rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.stat-num { font-size: 40rpx; font-weight: var(--fw-title); color: var(--accent); }
.stat-label { font-size: 22rpx; color: var(--text-tertiary); }

.tab-row { display: flex; padding: 0 32rpx 16rpx; }
.tab {
  padding: 10rpx 32rpx; font-size: 26rpx; color: var(--text-secondary);
  background: var(--bg-card); border: 1rpx solid var(--border); clip-path: polygon(0 0, 100% 0, 100% 100%, 8rpx 100%, 0 calc(100% - 8rpx));
  &.active { color: #0D110E; background: var(--accent); font-weight: var(--fw-title); }
}

.my-card {
  display: flex; gap: 20rpx; margin: 20rpx 32rpx; padding: 20rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
  .my-img { width: 140rpx; height: 140rpx; border-radius: var(--radius-sharp); flex-shrink: 0; background: var(--bg-elevated); }
  .my-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .my-title { font-size: 28rpx; font-weight: var(--fw-title); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .my-content { font-size: 24rpx; color: var(--text-secondary); margin-top: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .my-foot { margin-top: auto; display: flex; align-items: center; gap: 12rpx; padding-top: 12rpx; }
  .my-kind { padding: 2rpx 12rpx; font-size: 20rpx; color: var(--text-secondary); background: var(--bg-elevated); font-weight: var(--fw-title); }
  .my-time { font-size: 22rpx; color: var(--text-tertiary); }
  .my-edit { margin-left: auto; font-size: 22rpx; color: var(--accent); font-weight: var(--fw-title); }
  .my-sold { font-size: 22rpx; color: var(--secondary); font-weight: var(--fw-title); }
  .my-sold.sold { color: var(--text-tertiary); }
  .my-del { margin-left: auto; font-size: 22rpx; color: var(--danger); font-weight: var(--fw-title); }
  /* 同时有 编辑+删除 时，删除不再独占 margin-left:auto，由编辑占位 */
  .my-edit ~ .my-del { margin-left: 0; }
}

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 80rpx 0;
  .empty-shape { width: 48rpx; height: 48rpx; background: var(--accent); clip-path: polygon(0 0, 100% 0, 100% 100%, 8rpx 100%, 0 calc(100% - 8rpx)); margin-bottom: 24rpx; }
  .empty-title { font-size: 32rpx; font-weight: var(--fw-title); color: var(--text-primary); }
  .empty-sub { margin-top: 8rpx; font-size: 22rpx; color: var(--text-tertiary); }
}
</style>
