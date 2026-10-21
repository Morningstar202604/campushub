<template>
  <view class="fw-page">
    <!-- Tab 切换：双 tab 各自独立分页，切换时 reload 复位 -->
    <view class="fw-tabs">
      <view class="fw-tab clip-tag" :class="{ 'fw-tab-on': tab === 'following' }" @click="switchTab('following')">
        <text class="fw-tab-label">关注</text>
        <text class="fw-tab-count" v-if="tab === 'following' && total">{{ total }}</text>
      </view>
      <view class="fw-tab clip-tag" :class="{ 'fw-tab-on': tab === 'followers' }" @click="switchTab('followers')">
        <text class="fw-tab-label">粉丝</text>
        <text class="fw-tab-count" v-if="tab === 'followers' && total">{{ total }}</text>
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
      <view v-if="error" class="fw-state">
        <text class="fw-state-err">{{ error }}</text>
        <button class="fw-retry press" @click="retry">重试</button>
      </view>

      <view class="fw-list">
        <view v-for="u in list" :key="u.id" class="fw-item press">
          <view class="fw-avatar" @click="openProfile(u.id)">
            <image v-if="u.avatar" :src="u.avatar" class="fw-avatar-img" mode="aspectFill" />
            <text v-else class="fw-avatar-ph">{{ (u.nickname || '?').slice(0, 1) }}</text>
          </view>
          <view class="fw-info">
            <view class="fw-name" @click="openProfile(u.id)">{{ u.nickname }}</view>
            <view class="fw-school" v-if="u.school || u.college">{{ u.school || u.college }}</view>
          </view>
          <button class="fw-followbtn" @click="toggleFollow(u)">
            {{ followingMap[u.id] ? '已关注' : '+ 关注' }}
          </button>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape empty-shape--hex"></view>
          <text class="empty-kicker">Connections</text>
          <text class="empty-title">{{ tab === 'following' ? '还没有关注任何人' : '还没有粉丝' }}</text>
          <text class="empty-sub">去发现志趣相投的同学</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { callFunction } from '@/utils/api'

type Tab = 'following' | 'followers'

interface FollowUser {
  id: string
  nickname: string
  avatar: string
  school: string
  bio: string
  college?: string
}

const tab = ref<Tab>('following')
const list = ref<FollowUser[]>([])
const total = ref(0)
const error = ref('')
const followingMap = ref<Record<string, boolean>>({})
const pagingRef = ref<any>(null)

function switchTab(t: Tab) {
  if (tab.value === t) return
  tab.value = t
  error.value = ''
  followingMap.value = {}
  // 复位并重新加载（query 用 tab.value 实时取最新）
  pagingRef.value?.reload?.()
}

async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  const currentTab = tab.value
  try {
    const res: any = await callFunction('follow', { action: currentTab, page, pageSize: size })
    // 关键：请求返回时用户可能已切 tab，丢弃过期响应
    if (currentTab !== tab.value) return
    const rawList: any[] = res?.list ?? []
    total.value = res?.total ?? rawList.length
    const users: FollowUser[] = rawList.map((r) => ({
      id: r._id || r.id || '',
      nickname: r.nickname || '同学',
      avatar: r.avatar || '',
      // 后端 follow 列表 field 只含 school，同时兼容 college
      school: r.school || r.college || '',
      bio: r.bio || '',
      college: r.college || r.school || ''
    }))
    if (currentTab === 'following') {
      // 「我关注的」列表里的人必然都是已关注态
      const m: Record<string, boolean> = {}
      for (const u of users) m[u.id] = true
      followingMap.value = m
    } else {
      // 「粉丝」列表无法从一次请求得知关注态 → 首屏并发 check（限量，避免打爆云函数）
      const ids = users.slice(0, 10).map((u) => u.id)
      const m: Record<string, boolean> = {}
      await Promise.all(
        ids.map(async (id) => {
          try {
            const r: any = await callFunction('follow', { action: 'check', targetUserId: id })
            m[id] = Boolean(r?.isFollowing)
          } catch {
            m[id] = false
          }
        })
      )
      if (currentTab === tab.value) followingMap.value = { ...followingMap.value, ...m }
    }
    const hasMore = rawList.length >= size
    // 第二参数是 noMore（没有更多），传 hasMore 会让第 2 页永远加载不出来
    paging.completeByNoMore(users, !hasMore)
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

async function toggleFollow(u: FollowUser) {
  const action = followingMap.value[u.id] ? 'unfollow' : 'follow'
  try {
    const res: any = await callFunction('follow', { action, targetUserId: u.id })
    // 用后端返回的 following 布尔值更新态（follow → true / unfollow → false）
    followingMap.value = { ...followingMap.value, [u.id]: Boolean(res?.following) }
  } catch (e: any) {
    // ALREADY（已关注）视为成功态
    if (e?.code === 'ALREADY') {
      followingMap.value = { ...followingMap.value, [u.id]: true }
      return
    }
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

function openProfile(id: string) {
  if (!id) return
  uni.navigateTo({ url: '/pages/user-profile/user-profile?id=' + id })
}
</script>

<style lang="scss" scoped>
/* 页头固定 + 列表区滚动：z-paging 根节点是 height:100%，父级必须是有确定高度的 flex 容器，
   只用 min-height 会让它的百分比高度解析为 auto，整块内容被 overflow:hidden 裁成 0。 */
.fw-page {
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
.fw-page > z-paging,
.fw-page > .z-paging-content {
  flex: 1 1 0;
  min-height: 0;
}

.fw-tabs {
  display: flex;
  border-bottom: 3rpx solid var(--border);
}
.fw-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 28rpx 0;
  color: var(--text-tertiary);
  border-bottom: 4rpx solid transparent;
  &.fw-tab-on {
    color: #0D110E;
    background: var(--accent);
    border-bottom-color: var(--accent);
    font-weight: var(--fw-title);
  }
}
.fw-tab-label {
  font-size: 30rpx;
  font-weight: var(--fw-title);
}
.fw-tab-count {
  font-size: 22rpx;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  padding: 2rpx 10rpx;
}

.fw-list {
  padding: 24rpx 32rpx 40rpx;
}
.fw-item {
  display: flex;
  align-items: center;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.fw-avatar {
  width: 80rpx;
  height: 80rpx;
  border: 3rpx solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-elevated);
}
.fw-avatar-img {
  width: 100%;
  height: 100%;
}
.fw-avatar-ph {
  font-size: 36rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.fw-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}
.fw-name {
  font-size: 30rpx;
  font-weight: var(--fw-title);
  color: var(--text-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fw-school {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fw-followbtn {
  flex-shrink: 0;
  background: var(--bg-elevated);
  color: var(--text-body);
  font-size: 24rpx;
  font-weight: var(--fw-title);
  border: 3rpx solid var(--border);
  padding: 0 24rpx;
  height: 64rpx;
  line-height: 64rpx;
}

.fw-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.fw-state-err {
  display: block;
  font-size: 24rpx;
  color: var(--danger);
  margin-bottom: 20rpx;
}
.fw-retry {
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
