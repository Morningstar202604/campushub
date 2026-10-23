<template>
  <view class="profile-root">
    <!-- 加载中：profile 未就绪时不能取 profile.xxx（否则首屏 TypeError） -->
    <view v-if="loading" class="state-block">
      <text class="state-text">LOADING</text>
    </view>

    <!-- 失败 / 查无此人 -->
    <view v-else-if="!profile" class="state-block">
      <text class="state-text state-err">{{ loadError || '用户不存在' }}</text>
      <view v-if="queryUserId" class="state-retry press" @click="reload">重试</view>
    </view>

    <template v-else>
      <!-- 头像 + 昵称 -->
      <view class="profile-head sticker">
        <image v-if="profile.avatar" class="avatar" :src="profile.avatar" mode="aspectFill" />
        <view v-else class="avatar avatar--ph">
          <text class="avatar--ph-text">{{ (profile.nickname || '?').slice(0, 1) }}</text>
        </view>
        <view class="head-body">
          <view class="head-top">
            <text class="nickname title-900">{{ profile.nickname }}</text>
            <!-- isSelf 后端不返回，由前端用当前登录用户 _id 与 profile._id 比对得出 -->
            <view v-if="profile.isSelf" class="head-btn clip-tag press" @click="editProfile">
              <text>编辑资料</text>
            </view>
            <view
              v-else
              class="head-btn clip-tag press"
              :class="{ following: profile.isFollowing, busy: followLoading }"
              @click="onFollow"
            >
              <text>{{ profile.isFollowing ? '已关注' : '关注' }}</text>
            </view>
            <!-- 私信：直达聊天线程。本人页不显示；已拉黑对方时隐藏（发送会被服务端拒绝，不给无效入口） -->
            <view
              v-if="!profile.isSelf && !profile.isBlocked"
              class="head-btn head-btn--msg clip-tag press"
              @click="openChat"
            >
              <text>私信</text>
            </view>
            <!-- 拉黑：与关注并列的第二个动作。已拉黑态点击即解除（无需确认），
                 未拉黑态点击有二次确认——误点会让对方内容从信息流消失。 -->
            <view
              v-if="!profile.isSelf"
              class="head-btn head-btn--block clip-tag press"
              :class="{ blocked: profile.isBlocked, busy: blockLoading }"
              @click="onBlock"
            >
              <text>{{ profile.isBlocked ? '已拉黑' : '拉黑' }}</text>
            </view>
          </view>
          <text v-if="profile.bio" class="bio">{{ profile.bio }}</text>
          <text v-if="metaLine" class="meta">{{ metaLine }}</text>
          <view v-if="profile.tags.length" class="tags">
            <text v-for="t in profile.tags" :key="t" class="tag clip-tag">{{ t }}</text>
          </view>
        </view>
      </view>

      <!-- 统计：粉丝/关注后端对「非本人」脱敏不返回，故仅本人展示，其余只显示发帖数 -->
      <view class="stat-row sticker">
        <view v-for="s in stats" :key="s.label" class="stat-item">
          <text class="stat-num tabular-nums">{{ s.value }}</text>
          <text class="stat-label">{{ s.label }}</text>
        </view>
      </view>

      <!-- 最近帖子（后端 posts 是精简 field：无 content） -->
      <view class="section">
        <text class="section-title title-900">最近内容</text>
        <view
          v-for="p in profile.posts"
          :key="p._id"
          class="mini-card sticker press"
          @click="openPost(p)"
        >
          <image v-if="thumbs[p._id]" class="mini-thumb" :src="thumbs[p._id]" mode="aspectFill" />
          <view v-else class="mini-thumb mini-thumb--ph"></view>
          <view class="mini-body">
            <text class="mini-title">{{ p.title || '（无标题）' }}</text>
            <view class="mini-meta">
              <text class="mini-kind">{{ kindLabel(p.kind) }}</text>
              <text v-if="p.resolved" class="mini-resolved">已解决</text>
              <text class="mini-stat tabular-nums"
                >{{ p.likeCount ?? 0 }} 赞 · {{ p.commentCount ?? 0 }} 回应</text
              >
              <text class="mini-time tabular-nums">{{ fmtTime(p.createdAt) }}</text>
            </view>
          </view>
        </view>
        <view v-if="!profile.posts.length" class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">Activity</text>
          <text class="empty-title">还是一片空白</text>
          <text class="empty-sub">还没有发布过内容</text>
        </view>
        <view v-if="hasMore" class="load-more press" @click="loadMore">
          <text>{{ loadingMore ? '加载中…' : '加载更多' }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, fileIDToTempUrl } from '@/utils/api'
import { adaptProfile, fmtTime } from '@/adapters'
import type { UserProfile } from '@/adapters'
import { useUserStore } from '@/stores/user'

const PAGE_SIZE = 10

const profile = ref<UserProfile | null>(null)
const rawProfile = ref<any>(null)
const userStore = useUserStore()

const queryUserId = ref('') // 路由带来的他人 id（空 = 看自己）
const viewingId = ref('') // 实际请求的 userId
const myId = ref('') // 当前登录用户 _id（用于推断 isSelf）

const loading = ref(true)
const loadingMore = ref(false)
const followLoading = ref(false)
const blockLoading = ref(false)
const loadError = ref('')
const page = ref(1)
const hasMore = ref(false)
const thumbs = ref<Record<string, string>>({})

const metaLine = computed(() =>
  [profile.value?.college, profile.value?.major, profile.value?.grade].filter(Boolean).join(' · ')
)

const stats = computed<{ label: string; value: number }[]>(() => {
  const r = rawProfile.value || {}
  if (profile.value?.isSelf) {
    return [
      { label: '粉丝', value: r.followerCount ?? 0 },
      { label: '关注', value: r.followingCount ?? 0 },
      { label: '发帖', value: r.postCount ?? 0 }
    ]
  }
  return [{ label: '发帖', value: r.postCount ?? 0 }]
})

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    post: '信息',
    task: '任务',
    lost: '失物',
    found: '招领',
    confession: '表白'
  }
  return map[kind] || '信息'
}

/** 当前登录用户 _id：身份标识是 _id（后端 login 已剥离服务端凭证字段） */
async function resolveSelfId(): Promise<string> {
  if (userStore.userInfo?._id) return userStore.userInfo._id
  // 冷启动时 App.onLaunch 的 restore() 可能尚未完成，这里补一次（内部已 catch，不阻塞）
  if (!userStore.isLoggedIn) {
    await userStore.restore()
  }
  return userStore.userInfo?._id || ''
}

async function resolveThumbs(list: any[]) {
  const patch: Record<string, string> = {}
  for (const p of list) {
    const f = Array.isArray(p?.images) && p.images.length ? p.images[0] : ''
    patch[p._id] = f ? await fileIDToTempUrl(f).catch(() => f) : ''
  }
  thumbs.value = { ...thumbs.value, ...patch }
}

async function loadProfile(reset = true) {
  if (!viewingId.value) {
    loading.value = false
    loadError.value = '请先登录后再查看主页'
    return
  }
  if (reset) {
    page.value = 1
    loading.value = true
    loadError.value = ''
  } else {
    loadingMore.value = true
  }
  try {
    // 后端契约：ok({ profile, isFollowing, posts })，posts 支持 page/pageSize
    const res: any = await callFunction('user-profile', {
      userId: viewingId.value,
      page: page.value,
      pageSize: PAGE_SIZE
    })
    // adaptProfile 读的是 res.profile；isSelf 后端不返回 → 传当前用户 _id 由前端比对
    const vm = adaptProfile(res, myId.value)
    vm.avatar = vm.avatar ? await fileIDToTempUrl(vm.avatar).catch(() => vm.avatar) : ''
    const list = Array.isArray(vm.posts) ? vm.posts : []
    vm.posts = list
    if (reset) {
      profile.value = vm
      rawProfile.value = res?.profile ?? null
    } else if (profile.value) {
      profile.value.posts = [...profile.value.posts, ...list]
    }
    // 后端不返回 hasMore，用「本页是否取满」推断
    hasMore.value = list.length === PAGE_SIZE
    await resolveThumbs(list)
  } catch (e: any) {
    if (reset) {
      profile.value = null
      loadError.value = e?.message || String(e)
    }
    console.error('[user-profile]', e?.message || e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function reload() {
  loadProfile(true)
}

function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  page.value += 1
  loadProfile(false)
}

async function onFollow() {
  const p = profile.value
  if (!p || p.isSelf || !p.id || followLoading.value) return
  followLoading.value = true
  const before = p.isFollowing
  const wantFollow = !before
  try {
    // 后端参数名是 targetUserId（不是 userId）
    const res: any = await callFunction('follow', {
      action: wantFollow ? 'follow' : 'unfollow',
      targetUserId: p.id
    })
    const after = typeof res?.following === 'boolean' ? res.following : wantFollow
    p.isFollowing = after
    p.followerCount = Math.max(0, p.followerCount + (after ? 1 : 0) - (before ? 1 : 0))
  } catch (e: any) {
    // 重复关注：后端返回 ALREADY，属预期，按「已关注」纠正本地态
    if (e?.code === 'ALREADY') {
      p.isFollowing = true
      p.followerCount = Math.max(0, p.followerCount + (before ? 0 : 1))
    } else {
      uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
    }
  } finally {
    followLoading.value = false
  }
}

function editProfile() {
  // @ts-ignore
  uni.navigateTo({ url: '/pages/user-update/user-update' })
}

/** 私信：带上对方昵称进聊天页，省掉一次资料查询 */
function openChat() {
  const p = profile.value
  if (!p || p.isSelf || !p.id) return
  // @ts-ignore
  uni.navigateTo({
    url: `/pages/chat/chat?withUserId=${p.id}&withNickname=${encodeURIComponent(p.nickname)}`
  })
}

/**
 * 拉黑 / 解除拉黑。
 * 拉黑前二次确认：误点会让对方内容从信息流消失，且对方无感知，找回要点回这个页面；
 * 解除不确认（低风险操作，多一步确认反而是折磨）。
 */
async function onBlock() {
  const p = profile.value
  if (!p || p.isSelf || !p.id || blockLoading.value) return
  if (!p.isBlocked) {
    const confirm = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '拉黑',
        content: '拉黑后，对方的内容将不再出现在你的信息流里。随时可以在这里解除。',
        confirmText: '拉黑',
        cancelText: '取消',
        success: (r: any) => resolve(Boolean(r.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirm) return
  }
  blockLoading.value = true
  try {
    const res: any = await callFunction('block', {
      action: p.isBlocked ? 'unblock' : 'block',
      targetUserId: p.id
    })
    p.isBlocked = Boolean(res?.blocked)
    uni.showToast({ title: p.isBlocked ? '已拉黑' : '已解除拉黑', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  } finally {
    blockLoading.value = false
  }
}

function openPost(p: any) {
  if (!p?._id) return
  // @ts-ignore
  uni.navigateTo({ url: `/pages/post-detail/post-detail?id=${p._id}` })
}

onLoad((q) => {
  queryUserId.value = String(q?.id || q?.userId || '')
  if (queryUserId.value) {
    // 他人主页
    viewingId.value = queryUserId.value
    myId.value = userStore.userInfo?._id || ''
    loadProfile(true)
    return
  }
  // 未传 id：默认展示自己
  resolveSelfId().then((id) => {
    myId.value = id
    viewingId.value = id
    loadProfile(true)
  })
})
</script>

<style lang="scss" scoped>
.profile-root {
  padding: 24rpx 32rpx 80rpx;
}

.state-block {
  padding: 140rpx 32rpx;
  text-align: center;
}
.state-text {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
}
.state-err {
  color: var(--danger);
}
.state-retry {
  display: inline-block;
  margin-top: 28rpx;
  padding: 12rpx 36rpx;
  font-size: 24rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}

.profile-head {
  display: flex;
  gap: 24rpx;
  padding: 28rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: var(--radius-sharp);
  flex-shrink: 0;
  &--ph {
    background: var(--accent-dim);
    clip-path: var(--clip-diamond);
    opacity: 0.3;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  &--ph-text {
    font-size: 40rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
  }
}
.head-body {
  flex: 1;
  min-width: 0;
}
.head-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.nickname {
  font-size: 32rpx;
  color: var(--text-primary);
}
.head-btn {
  padding: 6rpx 20rpx;
  font-size: 22rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  background: var(--bg-elevated);
  margin-left: auto;
  &.following {
    color: var(--text-tertiary);
    background: var(--bg-card);
    border-width: 3rpx;
  }
  &.busy {
    opacity: 0.6;
  }
}
/* 拉黑按钮：跟在关注后面（margin-left:auto 由关注按钮吃掉），
   已拉黑态用危险色文案，与「已关注」的灰态区分——一个是状态，一个是待解除的动作 */
.head-btn--block {
  margin-left: 0;
  &.blocked {
    color: var(--danger);
  }
}
/* 私信按钮：与拉黑并列，同为次级动作，去掉 auto 边距 */
.head-btn--msg {
  margin-left: 0;
}
.bio {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 12rpx;
}
.meta {
  display: block;
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 8rpx;
}
.tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 12rpx;
}
.tag {
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  color: var(--accent);
  background: var(--bg-elevated);
}

.stat-row {
  display: flex;
  justify-content: space-around;
  padding: 20rpx;
  margin: 20rpx 0;
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
  font-size: 36rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.stat-label {
  font-size: 22rpx;
  color: var(--text-tertiary);
}

.section {
  margin-top: 8rpx;
}
.section-title {
  display: block;
  font-size: 30rpx;
  color: var(--text-primary);
  margin: 20rpx 0;
}
.mini-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.mini-thumb {
  width: 96rpx;
  height: 96rpx;
  flex-shrink: 0;
  border-radius: var(--radius-sharp);
  background: var(--bg-elevated);
  &--ph {
    background: var(--bg-elevated);
    border: 2rpx solid var(--border);
    clip-path: var(--clip-diamond);
    opacity: 0.5;
  }
}
.mini-body {
  flex: 1;
  min-width: 0;
}
.mini-title {
  display: block;
  font-size: 26rpx;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}
.mini-kind {
  font-size: 20rpx;
  color: var(--accent);
}
.mini-resolved {
  font-size: 20rpx;
  color: var(--secondary);
}
.mini-stat {
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.mini-time {
  margin-left: auto;
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.load-more {
  margin-top: 8rpx;
  padding: 20rpx;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-secondary);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  background: var(--bg-card);
}
</style>
