<template>
  <view class="detail-root">
    <!-- 加载中：post 尚未就绪时绝不能让模板取 post.xxx（否则首屏 TypeError） -->
    <view v-if="loading" class="detail-skeleton">
      <Skeleton :rows="3" :card="true" />
    </view>

    <!-- 失败 / 已删除 / 无此帖 -->
    <view v-else-if="!post" class="empty-state">
      <view class="empty-shape--hex empty-shape"></view>
      <text class="empty-kicker">POST</text>
      <text class="empty-title">{{ loadError || '帖子不存在或已删除' }}</text>
      <view v-if="postId" class="state-retry press" @click="loadDetail">重试</view>
    </view>

    <template v-else>
      <!-- 标题区（若帖无标题则只显示 kind 标签 + 内容） -->
      <view v-if="post.title" class="detail-title sticker">
        <text class="title-text title-900">{{ post.title }}</text>
      </view>

      <!-- 帖子正文 + 图片 -->
      <view class="detail-card sticker">
        <view class="detail-meta">
          <view class="meta-author clip-tag">
            <text>{{ authorName }}</text>
          </view>
          <text v-if="post.authorVerified" class="meta-verified clip-tag">已认证</text>
          <text class="meta-kind">{{ kindLabel(post.kind) }}</text>
          <text v-if="post.resolved" class="meta-resolved">已解决</text>
          <text class="meta-time tabular-nums">{{ post.time }}</text>
        </view>

        <text v-if="post.content" class="detail-content">{{ post.content }}</text>

        <view v-if="visibleImages.length" class="detail-images">
          <image
            v-for="(img, i) in visibleImages"
            :key="i"
            class="detail-img"
            :src="img"
            mode="aspectFill"
            lazy-load
            @click="onPreview(img)"
            @error="onImgError(img)"
          />
        </view>
      </view>

      <!-- 操作行：点赞 / 收藏 / 浏览 -->
      <view class="action-bar sticker">
        <view
          class="action-item press"
          :class="{ active: action.liked.value }"
          @click="action.toggleLike()"
        >
          <text class="action-label">点赞</text>
          <text class="action-count tabular-nums">{{ action.likeCount.value }}</text>
        </view>
        <view
          class="action-item press"
          :class="{ active: action.collected.value }"
          @click="action.toggleCollect()"
        >
          <text class="action-label">收藏</text>
          <text class="action-count tabular-nums">{{ collectCount }}</text>
        </view>
        <view class="action-item">
          <text class="action-label">浏览</text>
          <text class="action-count tabular-nums">{{ post.viewCount }}</text>
        </view>
        <view
          v-if="canResolve"
          class="action-item resolve press"
          :class="{ done: post.resolved }"
          @click="onResolve"
        >
          <text class="action-label">{{ post.resolved ? '已解决' : '标记已解决' }}</text>
        </view>
        <!-- 编辑历史：仅本人（后端只允许作者/管理员读） -->
        <view v-if="isMine" class="action-item press" @click="onHistory">
          <text class="action-label">历史</text>
        </view>
        <!-- 举报：非本人内容才显示（自己的帖应该去「我的内容」编辑/删除） -->
        <view v-if="!isMine" class="action-item press" @click="onReport">
          <text class="action-label">举报</text>
        </view>
      </view>

      <!-- 评论楼层 + 楼中楼 -->
      <view class="comment-section">
        <view class="section-head">
          <text class="section-title title-900">回应（{{ totalComments }}）</text>
        </view>

        <view v-if="comments.error.value" class="error-banner sticker">
          <text class="error-text">{{ comments.error.value }}</text>
        </view>

        <view v-for="f in comments.floors.value" :key="f._id" class="comment-floor sticker press">
          <view class="floor-head">
            <text class="floor-author clip-tag">{{ f.userNickname }}</text>
            <text v-if="f.replyToNickname" class="floor-reply">回复 {{ f.replyToNickname }}</text>
            <text class="floor-time tabular-nums">{{ fmtTime(f.createdAt) }}</text>
          </view>
          <text class="floor-content">{{ f.content }}</text>
          <view class="floor-actions">
            <text class="floor-like press" @click="comments.toggleLikeComment(f)">
              {{ f.liked ? '已点灯' : '点灯' }}{{ f.likeCount ? ` · ${f.likeCount}` : '' }}
            </text>
            <text class="floor-like press" @click="onReplyTo(f)">回复</text>
            <text v-if="canDelete(f)" class="floor-like press" @click="onDeleteComment(f)"
              >删除</text
            >
          </view>

          <!-- 楼中楼（子回复） -->
          <view v-if="f.replies?.length" class="floor-replies">
            <view v-for="r in f.replies" :key="r._id" class="reply-item">
              <view class="reply-head">
                <text class="reply-author">{{ r.userNickname }}</text>
                <text v-if="r.replyToNickname" class="reply-reply"
                  >回复 {{ r.replyToNickname }}</text
                >
                <text class="reply-time tabular-nums">{{ fmtTime(r.createdAt) }}</text>
                <text v-if="canDelete(r)" class="reply-del press" @click="onDeleteComment(r)"
                  >删除</text
                >
              </view>
              <text class="reply-content">{{ r.content }}</text>
            </view>
          </view>
        </view>

        <view v-if="!comments.floors.value.length && !comments.loading.value" class="empty-state">
          <view class="empty-shape--hex empty-shape"></view>
          <text class="empty-kicker">REPLIES</text>
          <text class="empty-title">还没有回应</text>
          <text class="empty-sub">来点第一盏灯</text>
        </view>

        <!-- 发布输入 -->
        <view class="comment-input sticker">
          <view v-if="replyTarget" class="reply-hint">
            <text class="reply-hint-text">回复 {{ replyTarget.userNickname }}</text>
            <text class="reply-hint-cancel press" @click="cancelReply">取消</text>
          </view>
          <input
            ref="inputEl"
            v-model="comments.draft.value"
            class="comment-input-box"
            :placeholder="replyTarget ? `回复 ${replyTarget.userNickname}` : `回复给 ${authorName}`"
            maxlength="500"
            @confirm="onSend"
          />
          <text
            class="comment-send press"
            :class="{ disabled: !comments.draft.value.trim() || comments.loading.value }"
            @click="onSend"
          >
            发送
          </text>
        </view>
      </view>
    </template>

    <!-- 相关阅读：同分类热帖（详情页末尾，点击直达） -->
    <view v-if="related.length" class="related-section">
      <view class="section-head">
        <text class="section-title title-900">相关阅读</text>
      </view>
      <view
        v-for="r in related"
        :key="r._id"
        class="related-card sticker press"
        @click="openRelated(r)"
      >
        <view class="related-body">
          <text class="related-title">{{ r.title || r.content }}</text>
          <view class="related-meta">
            <text class="related-kind clip-tag">{{ kindLabel(r.kind) }}</text>
            <text class="related-stat tabular-nums">{{ r.likeCount }} 赞 · {{ r.commentCount }} 回应</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 编辑历史（仅作者可见）：原生弹层里用 scroll-view，三端表现一致 -->
    <view v-if="historyOpen" class="hist-mask" @click="historyOpen = false">
      <view class="hist-panel sticker" @click.stop>
        <view class="hist-head">
          <text class="hist-title title-900">编辑历史</text>
          <text class="hist-close press" @click="historyOpen = false">关闭</text>
        </view>
        <scroll-view class="hist-scroll" scroll-y>
          <view v-if="historyLoading" class="hist-state">LOADING…</view>
          <view v-else-if="!historyList.length" class="hist-state">还没有编辑记录</view>
          <view v-for="(h, i) in historyList" :key="h._id || i" class="hist-item">
            <view class="hist-meta">
              <text class="hist-ver">V{{ historyList.length - i }}</text>
              <text class="hist-time tabular-nums">{{ fmtTime(h.createdAt) }}</text>
            </view>
            <text v-if="h.title" class="hist-field">标题：{{ h.title }}</text>
            <text class="hist-field hist-content">内容：{{ h.content || '(空)' }}</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import Skeleton from '@/components/Skeleton.vue'
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { callFunction, fileIDToTempUrl } from '@/utils/api'
import { useAction } from '@/composables/use-action'
import { useComments } from '@/composables/use-comments'
import { useUserStore } from '@/stores/user'
import { adaptPostDetail, fmtTime } from '@/adapters'
import type { PostDetail } from '@/adapters'

const userStore = useUserStore()
const currentUser = computed(() => userStore.userInfo)
// 是否本人内容：匿名帖后端已抹掉 userId，此时一律按「非本人」处理（也就看不到编辑入口，
// 但举报入口会出现 —— 匿名帖同样可被举报，这是期望行为）。
const isMine = computed(() => {
  const uid = currentUser.value?._id
  const raw = postRaw.value
  if (!uid || !raw || raw.isAnonymous) return false
  return String(raw.userId || '') === String(uid)
})

const postId = ref('')
const post = ref<PostDetail | null>(null)
// 后端原始 post：仅用于取作者展示名（userNickname / isAnonymous 是后端落库真值）
const postRaw = ref<any>(null)
const displayImages = ref<string[]>([])
const brokenImages = ref<Record<number, boolean>>({})
const loading = ref(true)
const loadError = ref('')
// 楼中楼回复目标：点某楼层「回复」后，下一条评论挂到该楼层下
const replyTarget = ref<any>(null)
const inputEl = ref<any>(null)

// useAction 支持 ref；useComments 只接受字符串，故用 getter 把 live 的 postId 透传进去
const action = useAction({ targetId: postId, targetType: 'post' })
const comments = useComments({
  get targetId() {
    return postId.value
  },
  targetType: 'post'
})

// 作者展示名：匿名帖统一显示「匿名同学」，否则用后端 userNickname
const authorName = computed(() => {
  const raw = postRaw.value
  if (!raw) return '同学'
  if (raw.isAnonymous) return '匿名同学'
  return raw.userNickname || raw.nickname || '同学'
})

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
const canResolve = computed(() => ['task', 'lost', 'found'].includes(post.value?.kind || ''))
// 总回应数 = 楼层 + 楼中楼全部回复。
// 旧实现取 max(commentCount, floors.length)：发一条新评论后 floors.length 可能仍小于
// 服务端的 commentCount（后者含子回复），标题就一直停在旧数字上，看起来像没发出去。
const totalComments = computed(() => {
  const loaded = comments.floors.value.reduce((n, f) => n + 1 + (f.replies?.length || 0), 0)
  return Math.max(post.value?.commentCount ?? 0, loaded)
})

// 收藏数：以服务端 collectCount 为基准，只叠加「本次会话内」的收藏状态变化
const initialCollected = ref(false)
const collectCount = computed(() => {
  const base = post.value?.collectCount ?? 0
  return Math.max(0, base - (initialCollected.value ? 1 : 0) + (action.collected.value ? 1 : 0))
})

async function loadDetail() {
  if (!postId.value) {
    loadError.value = '缺少帖子ID'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res: any = await callFunction('post-detail', { postId: postId.value })
    const vm = adaptPostDetail(res)
    if (vm.status === 'deleted') {
      post.value = null
      loadError.value = '该内容已被删除'
      return
    }
    post.value = vm
    postRaw.value = res?.post ?? null
    initialCollected.value = vm.isCollected
    // 回填 useAction 已知状态（点赞/收藏由 composable 统一管理，页面不再自己拼 callFunction）
    action.hydrate({ isLiked: vm.isLiked, isCollected: vm.isCollected, likeCount: vm.likeCount })
    // 图片 fileID(cloud://) → 临时可访问 URL，否则小程序/App 端不显示
    displayImages.value = await Promise.all(
      (vm.images || []).map((f) => fileIDToTempUrl(f).catch(() => f))
    )
    await comments.loadAll()
    await loadRelated()
  } catch (e: any) {
    post.value = null
    loadError.value = e?.message || String(e)
    console.error('[post-detail]', loadError.value)
  } finally {
    loading.value = false
  }
}

async function onSend() {
  const target = replyTarget.value
  const created = await comments.submit(
    target?._id,
    target ? { userId: target.userId || '', nickname: target.userNickname } : undefined
  )
  if (created) replyTarget.value = null
}

/* ---------------- 相关阅读 ---------------- */
const related = ref<any[]>([])

async function loadRelated() {
  if (!postId.value) return
  try {
    const res: any = await callFunction('post-related', { postId: postId.value })
    related.value = res?.list ?? []
  } catch (e: any) {
    // 推荐是增强项，失败静默（不打断详情页主流程）
    related.value = []
    console.warn('[post-detail] 相关阅读加载失败', e?.message || e)
  }
}

function openRelated(r: any) {
  if (!r?._id) return
  uni.navigateTo({ url: '/pages/post-detail/post-detail?id=' + r._id })
}

/* ---------------- 编辑历史 ---------------- */
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyList = ref<any[]>([])

async function onHistory() {
  if (!postId.value) return
  historyOpen.value = true
  historyLoading.value = true
  try {
    const res: any = await callFunction('revision-list', { postId: postId.value })
    historyList.value = res?.list ?? []
  } catch (e: any) {
    historyList.value = []
    uni.showToast({ title: e?.message || '历史加载失败', icon: 'none' })
  } finally {
    historyLoading.value = false
  }
}

/** 点击某楼层的「回复」：把该楼层设为回复目标（楼中楼） */
function onReplyTo(floor: any) {
  replyTarget.value = floor
  nextTick(() => inputEl.value?.focus?.())
}

function cancelReply() {
  replyTarget.value = null
}

/** 仅本人或管理员可删（管理员身份由后端最终裁决，这里只做入口显隐） */
function canDelete(c: any): boolean {
  if (!c || String(c._id || '').startsWith('temp-')) return false
  const uid = currentUser.value?._id
  return !!uid && String(c.userId || '') === String(uid)
}

async function onDeleteComment(c: any) {
  const modal: any = await new Promise((resolve) => {
    uni.showModal({
      title: '删除评论',
      content: '删除后不可恢复',
      confirmText: '删除',
      success: (r) => resolve(r),
      fail: () => resolve(null)
    })
  })
  if (!modal?.confirm) return
  const okDel = await comments.remove(c._id)
  if (okDel)
    post.value && (post.value.commentCount = Math.max(0, (post.value.commentCount || 0) - 1))
}

/** 举报：带 targetId/targetType 跳到举报页（此前全站没有任何入口，举报页不可达） */
function onReport() {
  const id = post.value?.id || postId.value
  if (!id) return
  const label = (post.value?.title || post.value?.content || '帖子').slice(0, 20)
  uni.navigateTo({
    url: `/pages/report/report?targetId=${encodeURIComponent(id)}&targetType=post&targetLabel=${encodeURIComponent(label)}`
  })
}

async function onResolve() {
  if (post.value?.resolved) return
  const done = await action.resolvePost()
  if (done && post.value) {
    post.value.resolved = true
    uni.showToast({ title: '已标记为已解决', icon: 'success' })
  } else {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

// 可见图片（加载失败的自动隐藏）
const visibleImages = computed(() => displayImages.value.filter((_, i) => !brokenImages.value[i]))

function onImgError(img: string) {
  const idx = displayImages.value.indexOf(img)
  if (idx >= 0) brokenImages.value[idx] = true
}

function onPreview(img: string) {
  const urls = displayImages.value.filter(Boolean)
  if (!urls.length) return
  // uni.previewImage：原生全屏预览，三端通用（小程序/H5/App）
  // @ts-ignore
  uni.previewImage({ urls, current: img })
}

// onLoad（uni-app 页面生命周期）取 query
onLoad((q) => {
  postId.value = String(q?.id || q?.postId || '')
  loadDetail()
})

// 分享给好友：标题取标题/正文首行，首图作分享图（仅小程序端生效，H5/App 无害）
onShareAppMessage(() => ({
  title:
    post.value?.title ||
    (post.value?.content ? post.value.content.slice(0, 30) : 'CampusHub 校园动态'),
  path: `/pages/post-detail/post-detail?id=${postId.value}`,
  imageUrl: displayImages.value[0] || ''
}))

// 页面卸载兜底：清空预览引用，避免大图 URL 随组件实例泄漏
onUnmounted(() => {
  displayImages.value = []
})
</script>

<style lang="scss" scoped>
.detail-root {
  padding: 24rpx 32rpx 80rpx;
}

/* 相关阅读 */
.related-section {
  margin-top: 32rpx;
}
.related-card {
  margin-top: 16rpx;
  padding: 22rpx 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.related-title {
  display: block;
  font-size: 26rpx;
  color: var(--text-primary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.related-meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 10rpx;
}
.related-kind {
  padding: 2rpx 12rpx;
  font-size: 18rpx;
  color: var(--text-secondary);
  background: var(--bg-elevated);
}
.related-stat {
  font-size: 20rpx;
  color: var(--text-tertiary);
}

/* 编辑历史弹层 */
.hist-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.66);
  display: flex;
  align-items: flex-end;
}
.hist-panel {
  width: 100%;
  max-height: 72vh;
  background: var(--bg-card);
  border-top: 3rpx solid var(--border);
  padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.hist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hist-title {
  font-size: 30rpx;
}
.hist-close {
  font-size: 24rpx;
  color: var(--text-secondary);
  padding: 8rpx 16rpx;
}
.hist-scroll {
  max-height: 56vh;
}
.hist-state {
  padding: 40rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-tertiary);
  letter-spacing: 2rpx;
}
.hist-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--border);
}
.hist-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}
.hist-ver {
  font-size: 20rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
.hist-time {
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.hist-field {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  word-break: break-all;
}
.hist-content {
  margin-top: 4rpx;
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
.state-retry {
  display: inline-block;
  margin-top: 28rpx;
  padding: 12rpx 36rpx;
  font-size: 24rpx;
  font-weight: var(--fw-title);
  color: var(--secondary);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
}

.detail-title {
  padding: 24rpx;
  margin-bottom: 20rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
  .title-text {
    font-size: 36rpx;
    color: var(--text-primary);
    display: block;
  }
}

.detail-card {
  padding: 28rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
  .meta-author {
    padding: 4rpx 16rpx;
    font-size: 22rpx;
    color: var(--text-secondary);
    background: var(--bg-elevated);
  }
  .meta-kind {
    font-size: 22rpx;
    color: var(--text-secondary);
  }
  .meta-verified {
    font-size: 18rpx;
    padding: 2rpx 10rpx;
    color: var(--accent);
    background: var(--bg-elevated);
    font-weight: var(--fw-title);
  }
  .meta-resolved {
    font-size: 20rpx;
    color: var(--secondary);
    font-weight: var(--fw-title);
  }
  .meta-time {
    margin-left: auto;
    font-size: 22rpx;
    color: var(--text-tertiary);
  }
}

.detail-content {
  display: block;
  font-size: 28rpx;
  line-height: 1.75;
  color: var(--text-primary);
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  margin-top: 20rpx;
}
.detail-img {
  width: 100%;
  height: 200rpx;
  border-radius: var(--radius-sharp);
  background: var(--bg-elevated);
}

.action-bar {
  display: flex;
  gap: 40rpx;
  margin-top: 24rpx;
  padding: 20rpx 32rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
  .action-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
  }
  .action-label {
    font-size: 22rpx;
    color: var(--text-secondary);
  }
  .action-count {
    font-size: 24rpx;
    font-weight: var(--fw-title);
    color: var(--text-primary);
  }
  .action-item.active .action-label {
    color: var(--secondary);
  }
  .action-item.resolve .action-label {
    color: var(--secondary);
  }
  .action-item.done .action-label {
    color: var(--text-tertiary);
  }
}

.comment-section {
  margin-top: 32rpx;
}
.section-head {
  padding: 16rpx 0;
}
.section-title {
  font-size: 30rpx;
  color: var(--text-primary);
}

.comment-floor {
  margin-top: 16rpx;
  padding: 20rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.floor-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.floor-author {
  font-size: 24rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
  padding: 2rpx 12rpx;
  background: var(--bg-elevated);
}
.floor-reply {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.floor-time {
  margin-left: auto;
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.floor-content {
  display: block;
  font-size: 26rpx;
  color: var(--text-primary);
  line-height: 1.6;
}
.floor-actions {
  margin-top: 12rpx;
  display: flex;
  gap: 24rpx;
}
.floor-like {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.floor-replies {
  margin-top: 16rpx;
  padding-left: 24rpx;
  border-left: 2rpx solid var(--border);
}
.reply-item {
  padding: 12rpx 0;
}
.reply-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.reply-author {
  font-size: 22rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.reply-time {
  margin-left: auto;
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.reply-del {
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.reply-content {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 4rpx;
}

.reply-hint {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 0 12rpx;
  border-bottom: 1rpx solid var(--border);
  margin-bottom: 12rpx;
}
.reply-hint-text {
  font-size: 22rpx;
  color: var(--accent);
}
.reply-hint-cancel {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-left: auto;
}

.comment-input {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 16rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.comment-input-box {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-primary);
  background: var(--bg-elevated);
  padding: 12rpx 16rpx;
  border-radius: var(--radius-sharp);
}
.comment-send {
  font-size: 24rpx;
  font-weight: var(--fw-title);
  color: var(--secondary);
  padding: 12rpx 24rpx;
}
.comment-send.disabled {
  color: var(--text-tertiary);
  opacity: 0.6;
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 24rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--danger);
  border-radius: var(--radius-sharp);
  .error-text {
    font-size: 24rpx;
    color: var(--danger);
  }
}
</style>
