<template>
  <view class="bl-page">
    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      safe-area-inset-bottom
      @query="queryList"
    >
      <view v-if="error" class="bl-state">
        <text class="bl-state-err">{{ error }}</text>
        <button class="bl-retry press" @click="retry">重试</button>
      </view>

      <view class="bl-list">
        <view v-for="u in list" :key="u.id" class="bl-item press">
          <view class="bl-avatar" @click="openProfile(u.id)">
            <image v-if="u.avatar" :src="u.avatar" class="bl-avatar-img" mode="aspectFill" />
            <text v-else class="bl-avatar-ph">{{ (u.nickname || '?').slice(0, 1) }}</text>
          </view>
          <view class="bl-info">
            <view class="bl-name" @click="openProfile(u.id)">{{ u.nickname }}</view>
            <view class="bl-school" v-if="u.school || u.college">{{ u.school || u.college }}</view>
          </view>
          <button class="bl-unblock" @click="unblock(u)">解除</button>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape empty-shape--hex"></view>
          <text class="empty-kicker">Blocklist</text>
          <text class="empty-title">黑名单是空的</text>
          <text class="empty-sub">在对方主页点「拉黑」后，可在这里统一管理</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { callFunction } from '@/utils/api'

interface BlockedUser {
  id: string
  nickname: string
  avatar: string
  school: string
  college?: string
}

const list = ref<BlockedUser[]>([])
const error = ref('')
const pagingRef = ref<any>(null)

async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  try {
    const res: any = await callFunction('block', { action: 'list', page, pageSize: size })
    const rawList: any[] = res?.list ?? []
    const users: BlockedUser[] = rawList.map((r) => ({
      id: r._id || r.id || '',
      nickname: r.nickname || '同学',
      avatar: r.avatar || '',
      school: r.school || r.college || '',
      college: r.college || r.school || ''
    }))
    const hasMore = rawList.length >= size
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

/** 解除拉黑：后端删除记录后把该行从列表移除（不整页 reload，保留其余行） */
async function unblock(u: BlockedUser) {
  try {
    await callFunction('block', { action: 'unblock', targetUserId: u.id })
    list.value = list.value.filter((x) => x.id !== u.id)
    uni.showToast({ title: '已解除', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

function openProfile(id: string) {
  if (!id) return
  // @ts-ignore
  uni.navigateTo({ url: '/pages/user-profile/user-profile?id=' + id })
}
</script>

<style lang="scss" scoped>
/* 页头固定 + 列表区滚动：z-paging 根节点是 height:100%，父级必须是有确定高度的 flex 容器，
   只用 min-height 会让它的百分比高度解析为 auto，整块内容被 overflow:hidden 裁成 0。 */
.bl-page {
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
.bl-page > z-paging,
.bl-page > .z-paging-content {
  flex: 1 1 0;
  min-height: 0;
}

.bl-list {
  padding: 24rpx 32rpx 40rpx;
}
.bl-item {
  display: flex;
  align-items: center;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.bl-avatar {
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
.bl-avatar-img {
  width: 100%;
  height: 100%;
}
.bl-avatar-ph {
  font-size: 36rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.bl-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}
.bl-name {
  font-size: 30rpx;
  font-weight: var(--fw-title);
  color: var(--text-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bl-school {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bl-unblock {
  flex-shrink: 0;
  background: var(--bg-elevated);
  color: var(--danger);
  font-size: 24rpx;
  font-weight: var(--fw-title);
  border: 3rpx solid var(--border);
  padding: 0 24rpx;
  height: 64rpx;
  line-height: 64rpx;
}

.bl-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.bl-state-err {
  display: block;
  font-size: 24rpx;
  color: var(--danger);
  margin-bottom: 20rpx;
}
.bl-retry {
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
