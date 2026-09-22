<template>
  <view class="detail-root">
    <!-- 加载中：post 尚未就绪时绝不能让模板取 post.xxx（否则首屏 TypeError） -->
    <view v-if="loading" class="state-block">
      <text class="state-text">LOADING</text>
    </view>

    <!-- 失败 / 已删除 / 无此帖 -->
    <view v-else-if="!post" class="state-block">
      <text class="state-text state-err">{{ loadError || '帖子不存在或已删除' }}</text>
      <view v-if="postId" class="state-retry" @click="loadDetail">重试</view>
    </view>

    <template v-else>
      <!-- 标题区（若帖无标题则只显示 kind 标签 + 内容） -->
      <view v-if="post.title" class="detail-title sticker">
        <text class="title-text">{{ post.title }}</text>
      </view>

      <!-- 帖子正文 + 图片 -->
      <view class="detail-card sticker">
        <view class="detail-meta">
          <view class="meta-author clip-tag">
            <text>{{ authorName }}</text>
          </view>
          <text class="meta-kind">{{ kindLabel(post.kind) }}</text>
          <text v-if="post.resolved" class="meta-resolved">已解决</text>
          <text class="meta-time tabular-nums">{{ post.time }}</text>
        </view>

        <text v-if="post.content" class="detail-content">{{ post.content }}</text>

        <view v-if="displayImages.length" class="detail-images">
          <image
            v-for="(img, i) in displayImages"
            :key="i"
            class="detail-img"
            :src="img"
            mode="aspectFill"
            lazy-load
            @click="previewImage(i)"
          />
        </view>
      </view>

      <!-- 操作行：点赞 / 收藏 / 浏览 -->
      <view class="action-bar sticker">
        <view class="action-item" :class="{ active: action.liked.value }" @click="action.toggleLike()">
          <text class="action-label">点赞</text>
          <text class="action-count tabular-nums">{{ action.likeCount.value }}</text>
        </view>
        <view class="action-item" :class="{ active: action.collected.value }" @click="action.toggleCollect()">
          <text class="action-label">收藏</text>
          <text class="action-count tabular-nums">{{ collectCount }}</text>
        </view>
        <view class="action-item">
          <text class="action-label">浏览</text>
          <text class="action-count tabular-nums">{{ post.viewCount }}</text>
        </view>
        <view
          v-if="canResolve"
          class="action-item resolve"
          :class="{ done: post.resolved }"
          @click="onResolve"
        >
          <text class="action-label">{{ post.resolved ? '已解决' : '标记已解决' }}</text>
        </view>
      </view>

      <!-- 评论楼层 + 楼中楼 -->
      <view class="comment-section">
        <view class="section-head">
          <text class="section-title">回应（{{ totalComments }}）</text>
        </view>

        <view v-if="comments.error.value" class="error-banner sticker">
          <text class="error-text">{{ comments.error.value }}</text>
        </view>

        <view v-for="f in comments.floors.value" :key="f._id" class="comment-floor sticker">
          <view class="floor-head">
            <text class="floor-author">{{ f.userNickname }}</text>
            <text v-if="f.replyToNickname" class="floor-reply">回复 {{ f.replyToNickname }}</text>
            <text class="floor-time tabular-nums">{{ fmtTime(f.createdAt) }}</text>
          </view>
          <text class="floor-content">{{ f.content }}</text>
          <view class="floor-actions">
            <text class="floor-like" @click="comments.toggleLikeComment(f)">
              {{ f.liked ? '已点灯' : '点灯' }}{{ f.likeCount ? ` · ${f.likeCount}` : '' }}
            </text>
          </view>

          <!-- 楼中楼（子回复） -->
          <view v-if="f.replies?.length" class="floor-replies">
            <view v-for="r in f.replies" :key="r._id" class="reply-item">
              <view class="reply-head">
                <text class="reply-author">{{ r.userNickname }}</text>
                <text v-if="r.replyToNickname" class="reply-reply">回复 {{ r.replyToNickname }}</text>
                <text class="reply-time tabular-nums">{{ fmtTime(r.createdAt) }}</text>
              </view>
              <text class="reply-content">{{ r.content }}</text>
            </view>
          </view>
        </view>

        <view v-if="!comments.floors.value.length && !comments.loading.value" class="comment-empty">
          <text>还没有回应，来点第一盏灯</text>
        </view>

        <!-- 发布输入 -->
        <view class="comment-input sticker">
          <input
            v-model="comments.draft.value"
            class="comment-input-box"
            :placeholder="`回复给 ${authorName}`"
            maxlength="500"
            @confirm="onSend"
          />
          <text class="comment-send" :class="{ disabled: !comments.draft.value.trim() || comments.loading.value }" @click="onSend">
            发送
          </text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, fileIDToTempUrl } from '@/utils/api'
import { useAction } from '@/composables/use-action'
import { useComments } from '@/composables/use-comments'
import { adaptPostDetail, fmtTime } from '@/adapters'
import type { PostDetail } from '@/adapters'

const postId = ref('')
const post = ref<PostDetail | null>(null)
// 后端原始 post：仅用于取作者展示名（userNickname / isAnonymous 是后端落库真值）
const postRaw = ref<any>(null)
const displayImages = ref<string[]>([])
const loading = ref(true)
const loadError = ref('')

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
  const map: Record<string, string> = { post: '信息', task: '任务', lost: '失物', found: '招领', confession: '表白' }
  return map[kind] || kind || '校园'
}
const canResolve = computed(() => ['task', 'lost', 'found'].includes(post.value?.kind || ''))
const totalComments = computed(() =>
  Math.max(post.value?.commentCount ?? 0, comments.floors.value.length)
)

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
  } catch (e: any) {
    post.value = null
    loadError.value = e?.message || String(e)
    console.error('[post-detail]', loadError.value)
  } finally {
    loading.value = false
  }
}

async function onSend() {
  await comments.submit()
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

function previewImage(idx: number) {
  if (!displayImages.value.length) return
  // uni.previewImage：原生全屏预览，三端通用（小程序/H5/App）
  // @ts-ignore
  uni.previewImage({
    urls: displayImages.value,
    current: displayImages.value[idx]
  })
}

// onLoad（uni-app 页面生命周期）取 query
onLoad((q) => {
  postId.value = String(q?.id || q?.postId || '')
  loadDetail()
})

// 页面卸载兜底：清空预览引用，避免大图 URL 随组件实例泄漏
onUnmounted(() => {
  displayImages.value = []
})
</script>

<style lang="scss" scoped>
.detail-root { padding: 24rpx 32rpx 80rpx; }

.state-block { padding: 140rpx 32rpx; text-align: center; }
.state-text { display: block; font-size: 24rpx; color: var(--text-secondary); letter-spacing: 2rpx; }
.state-err { color: var(--danger); }
.state-retry {
  display: inline-block; margin-top: 28rpx; padding: 12rpx 36rpx;
  font-size: 24rpx; font-weight: var(--fw-title); color: var(--accent);
  border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}

.detail-title {
  padding: 24rpx;
  margin-bottom: 20rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  .title-text { font-size: 36rpx; font-weight: var(--fw-title); color: var(--text-primary); display: block; }
}

.detail-card {
  padding: 28rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}

.detail-meta {
  display: flex; align-items: center; gap: 16rpx; margin-bottom: 16rpx;
  .meta-author { padding: 4rpx 16rpx; font-size: 22rpx; color: var(--accent); background: var(--bg-elevated); font-weight: var(--fw-title); }
  .meta-kind { font-size: 22rpx; color: var(--text-secondary); }
  .meta-resolved { font-size: 20rpx; color: var(--secondary); font-weight: var(--fw-title); }
  .meta-time { margin-left: auto; font-size: 22rpx; color: var(--text-tertiary); }
}

.detail-content { display: block; font-size: 28rpx; line-height: 1.75; color: var(--text-primary); }

.detail-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; margin-top: 20rpx; }
.detail-img { width: 100%; height: 200rpx; border-radius: var(--radius-sharp); background: var(--bg-elevated); }

.action-bar {
  display: flex; gap: 40rpx; margin-top: 24rpx; padding: 20rpx 32rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
  .action-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
  .action-label { font-size: 22rpx; color: var(--text-secondary); }
  .action-count { font-size: 24rpx; font-weight: var(--fw-title); color: var(--text-primary); }
  .action-item.active .action-label { color: var(--accent); }
  .action-item.resolve .action-label { color: var(--secondary); }
  .action-item.done .action-label { color: var(--text-tertiary); }
}

.comment-section { margin-top: 32rpx; }
.section-head { padding: 16rpx 0; }
.section-title { font-size: 30rpx; font-weight: var(--fw-title); color: var(--text-primary); }

.comment-floor {
  margin-top: 16rpx; padding: 20rpx; background: var(--bg-card);
  border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.floor-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.floor-author { font-size: 24rpx; font-weight: var(--fw-title); color: var(--accent); }
.floor-reply { font-size: 22rpx; color: var(--text-tertiary); }
.floor-time { margin-left: auto; font-size: 20rpx; color: var(--text-tertiary); }
.floor-content { display: block; font-size: 26rpx; color: var(--text-primary); line-height: 1.6; }
.floor-actions { margin-top: 12rpx; }
.floor-like { font-size: 22rpx; color: var(--text-secondary); }

.floor-replies { margin-top: 16rpx; padding-left: 24rpx; border-left: 2rpx solid var(--border); }
.reply-item { padding: 12rpx 0; }
.reply-head { display: flex; align-items: center; gap: 12rpx; }
.reply-author { font-size: 22rpx; font-weight: var(--fw-title); color: var(--text-primary); }
.reply-time { margin-left: auto; font-size: 20rpx; color: var(--text-tertiary); }
.reply-content { display: block; font-size: 24rpx; color: var(--text-secondary); line-height: 1.5; margin-top: 4rpx; }

.comment-empty { padding: 40rpx; text-align: center; font-size: 24rpx; color: var(--text-tertiary); }

.comment-input {
  display: flex; gap: 16rpx; margin-top: 24rpx; padding: 16rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.comment-input-box { flex: 1; font-size: 26rpx; color: var(--text-primary); background: var(--bg-elevated); padding: 12rpx 16rpx; border-radius: var(--radius-sharp); }
.comment-send { font-size: 24rpx; font-weight: var(--fw-title); color: var(--accent); padding: 12rpx 24rpx; }
.comment-send.disabled { color: var(--text-tertiary); opacity: 0.6; }

.error-banner {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16rpx 24rpx; background: var(--bg-card);
  border: 1rpx solid var(--danger); border-radius: var(--radius-sharp);
  .error-text { font-size: 24rpx; color: var(--danger); }
}
</style>
