<template>
  <div class="page detail-page">
    <van-nav-bar fixed placeholder left-arrow @click-left="router.back()">
      <template #right>
        <van-icon name="ellipsis" size="20" color="#1c2330" @click="onMore" />
      </template>
    </van-nav-bar>

    <van-skeleton v-if="loading" title :row="6" style="padding: 16px" />

    <template v-else-if="post">
      <!-- 内容 -->
      <div class="card">
        <div class="d-head">
          <span class="d-kind" :style="{ color: kindColor(post.kind) }">{{ kindLabel(post.kind) }}</span>
          <span v-if="post.is_pinned" class="d-badge-pin">置顶</span>
          <span v-if="post.is_essence" class="d-badge-essence">精华</span>
          <span v-if="post.resolved" class="d-badge-done">已解决</span>
        </div>
        <h1 class="d-title">{{ post.title }}</h1>
        <div class="d-author-row">
          <span class="d-author">{{ post.is_anonymous ? '匿名同学' : (post.author?.nickname || '同学') }}</span>
          <span class="d-time">{{ fmtTime(post.created_at) }}</span>
          <span class="d-view"><van-icon name="eye-o" /> {{ post.view_count }}</span>
        </div>
        <div class="d-content">{{ post.content }}</div>
        <div v-if="post.location" class="d-location"><van-icon name="location-o" /> {{ post.location }}</div>
        <div v-if="post.tags?.length" class="d-tags">
          <span v-for="t in post.tags" :key="t" class="d-tag"># {{ t }}</span>
        </div>
        <div v-if="post.images?.length" class="d-images">
          <img v-for="(img, i) in post.images" :key="i" :src="img" class="d-img" @click="preview(i)" />
        </div>
      </div>

      <!-- 操作条 -->
      <div class="action-bar">
        <div class="action" :class="{ on: liked }" @click="onLike">
          <van-icon :name="liked ? 'good-job' : 'good-job-o'" size="22" />
          <span>{{ post.like_count }}</span>
        </div>
        <div class="action" :class="{ on: collected }" @click="onCollect">
          <van-icon :name="collected ? 'star' : 'star-o'" size="22" />
          <span>{{ post.collect_count }}</span>
        </div>
        <div class="action">
          <van-icon name="comment-o" size="22" />
          <span>{{ post.comment_count }}</span>
        </div>
      </div>

      <!-- 评论 -->
      <div class="card">
        <div class="cmt-title">评论（{{ post.comment_count }}）</div>
        <div v-if="!comments.length" class="cmt-empty">还没有评论，来说两句吧</div>
        <div v-for="(c, i) in comments" :key="c.id" class="cmt-item">
          <van-image round width="32" height="32" :src="c.user?.avatar || ''" fit="cover" />
          <div class="cmt-body">
            <div class="cmt-head">
              <span class="cmt-name">{{ c.user?.nickname || '同学' }}</span>
              <span class="cmt-floor">#{{ i + 1 }}楼</span>
              <span class="cmt-time">{{ fmtTime(c.created_at) }}</span>
            </div>
            <div class="cmt-content">
              <template v-if="c.reply_to_user_id">回复 <span class="cmt-reply">{{ replyName(c) }}：</span></template>
              {{ c.content }}
            </div>
            <div class="cmt-actions">
              <span @click="startReply(c)">回复</span>
              <span v-if="canDelete(c)" class="cmt-del" @click="delComment(c)">删除</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部输入 -->
      <div class="input-bar">
        <input v-model="inputText" class="input-field" :placeholder="replyTo ? `回复 @${replyTo}` : '友善评论…'" @keyup.enter="sendComment" />
        <van-button size="small" type="primary" :disabled="!inputText.trim()" @click="sendComment">发送</van-button>
      </div>

      <!-- 更多操作 -->
      <van-action-sheet v-model:show="sheetShow" :actions="sheetActions" cancel-text="取消" @select="onSheetSelect" />

      <!-- 举报弹层 -->
      <van-dialog
        v-model:show="reportShow"
        title="举报"
        show-cancel-button
        confirm-button-text="提交举报"
        :before-close="onReportBeforeClose"
      >
        <div class="report-body">
          <van-field
            v-model="reportText"
            type="textarea"
            rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请填写举报原因（必填，200字内）"
          />
        </div>
      </van-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import { postById, listComments, addComment, softDeletePost, softDeleteComment, markResolved } from '@/api/posts'
import { toggleLike, isLiked, toggleCollect, isCollected } from '@/api/social'
import { submitReport } from '@/api/misc'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import type { Post, Comment } from '@/types'
import { fmtTime, kindLabel } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const postId = computed(() => String(route.params.id))
const loading = ref(true)
const post = ref<Post | null>(null)
const comments = ref<Comment[]>([])
const liked = ref(false)
const collected = ref(false)
const inputText = ref('')
const replyTo = ref('')
const replyParentId = ref<string | undefined>(undefined)
const sheetShow = ref(false)
const sheetActions = ref<{ name: string; action: string }[]>([])
const reportShow = ref(false)
const reportText = ref('')

onMounted(init)

async function init() {
  try {
    post.value = await postById(postId.value)
    if (!post.value) { showFailToast('内容不存在'); return }
    // 浏览量（RPC，失败不影响）
    supabase.rpc('incr_view', { t_type: 'post', t_id: postId.value }).then(() => {
      if (post.value) post.value.view_count += 1
    }, () => {})
    const [c, lk, cl] = await Promise.all([
      listComments('post', postId.value),
      isLiked('post', postId.value),
      isCollected('post', postId.value)
    ])
    comments.value = c
    liked.value = lk
    collected.value = cl
  } catch (e: any) {
    showFailToast(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function kindColor(kind?: string) {
  return { post: '#2b7cf6', task: '#8f6bf6', lost: '#f6a02b', found: '#2e9e5b', confession: '#f64f7c' }[kind || 'post'] || '#2b7cf6'
}

function preview(i: number) {
  showImagePreview({ images: post.value?.images || [], startPosition: i })
}

async function onLike() {
  try {
    await toggleLike('post', postId.value, liked.value)
    liked.value = !liked.value
    if (post.value) post.value.like_count += liked.value ? 1 : -1
  } catch (e: any) {
    requireLogin(e)
  }
}

async function onCollect() {
  try {
    await toggleCollect('post', postId.value, collected.value)
    collected.value = !collected.value
    if (post.value) post.value.collect_count += collected.value ? 1 : -1
  } catch (e: any) {
    requireLogin(e)
  }
}

function replyName(c: Comment): string {
  const target = comments.value.find(x => x.id === c.parent_id)
  return target?.user?.nickname || '同学'
}

function startReply(c: Comment) {
  replyTo.value = c.user?.nickname || '同学'
  replyParentId.value = c.id
}

async function sendComment() {
  const text = inputText.value.trim()
  if (!text) return
  try {
    await addComment('post', postId.value, text, replyParentId.value)
    comments.value = await listComments('post', postId.value)
    if (post.value) post.value.comment_count += 1
    inputText.value = ''
    replyTo.value = ''
    replyParentId.value = undefined
  } catch (e: any) {
    requireLogin(e)
  }
}

function canDelete(c: Comment) {
  return auth.isLoggedIn && (c.user_id === auth.profile?.id)
}

async function delComment(c: Comment) {
  try {
    await showConfirmDialog({ title: '提示', message: '删除这条评论？' })
  } catch { return }
  try {
    await softDeleteComment(c.id)
    comments.value = comments.value.filter(x => x.id !== c.id)
    if (post.value) post.value.comment_count = Math.max(0, post.value.comment_count - 1)
  } catch (e: any) {
    showFailToast(e?.message || '删除失败')
  }
}

function requireLogin(e: any) {
  if (/请先登录/.test(e?.message || '')) {
    showFailToast('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
  } else {
    showFailToast(e?.message || '操作失败')
  }
}

async function onMore() {
  const mine = auth.isLoggedIn && post.value?.author_id === auth.profile?.id
  const actions = []
  if (mine) {
    actions.push({ name: post.value?.resolved ? '取消已解决' : '标记已解决', action: 'resolve' })
    actions.push({ name: '删除帖子', action: 'delete' })
  }
  actions.push({ name: '举报', action: 'report' })
  sheetActions.value = actions
  sheetShow.value = true
}

function onSheetSelect(item: { action: string }) {
  if (item.action === 'resolve') doResolve()
  if (item.action === 'delete') doDelete()
  if (item.action === 'report') doReport()
}

async function doResolve() {
  if (!post.value) return
  try {
    await markResolved(post.value.id, !post.value.resolved)
    post.value.resolved = !post.value.resolved
    showSuccessToast('已更新')
  } catch (e: any) { showFailToast(e?.message || '操作失败') }
}

async function doDelete() {
  try {
    await showConfirmDialog({ title: '提示', message: '确定删除这条帖子吗？删除后不可恢复。' })
  } catch { return }
  try {
    await softDeletePost(postId.value)
    showSuccessToast('已删除')
    setTimeout(() => router.replace('/'), 600)
  } catch (e: any) { showFailToast(e?.message || '删除失败') }
}

async function doReport() {
  reportText.value = ''
  reportShow.value = true
}

async function onReportBeforeClose(action: string) {
  if (action !== 'confirm') return true
  const reason = reportText.value.trim()
  if (!reason) {
    showFailToast('请填写举报原因')
    return false
  }
  try {
    await submitReport('post', postId.value, reason)
    showSuccessToast('已提交，管理员会尽快处理')
    return true
  } catch (e: any) {
    requireLogin(e)
    return false
  }
}
</script>

<style scoped>
.detail-page { padding-bottom: 70px; }
.d-head { display: flex; gap: 8px; align-items: center; }
.d-kind { font-size: 12px; font-weight: 700; }
.d-badge-pin { font-size: 11px; color: #fff; background: #f64f7c; border-radius: 4px; padding: 1px 6px; }
.d-badge-essence { font-size: 11px; color: #f6a02b; border: 1px solid #f6a02b; border-radius: 4px; padding: 1px 6px; }
.d-badge-done { font-size: 11px; color: #2e9e5b; border: 1px solid #2e9e5b; border-radius: 4px; padding: 1px 6px; }
.d-title { font-size: 20px; margin: 8px 0; line-height: 1.4; }
.d-author-row { display: flex; gap: 10px; align-items: center; font-size: 12px; color: #9aa3b2; }
.d-view { display: flex; gap: 3px; align-items: center; }
.d-content { font-size: 15px; line-height: 1.8; margin-top: 12px; white-space: pre-wrap; word-break: break-word; }
.d-location { margin-top: 10px; font-size: 13px; color: #f6a02b; display: flex; align-items: center; gap: 4px; }
.d-tags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.d-tag { font-size: 12px; color: #2b7cf6; background: #e8f1ff; padding: 2px 8px; border-radius: 4px; }
.d-images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 12px; }
.d-img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }

.action-bar { position: sticky; top: 46px; z-index: 5; display: flex; background: #fff; margin: 0 12px; border-radius: 12px; padding: 8px 0; box-shadow: 0 1px 2px rgba(28,35,48,.04); }
.action { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: #66707f; cursor: pointer; }
.action.on { color: #f64f7c; }

.cmt-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.cmt-empty { text-align: center; color: #9aa3b2; font-size: 13px; padding: 20px 0; }
.cmt-item { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid #f2f3f5; }
.cmt-body { flex: 1; min-width: 0; }
.cmt-head { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.cmt-name { font-weight: 600; color: #1c2330; }
.cmt-floor { color: #c2c9d2; }
.cmt-time { margin-left: auto; color: #c2c9d2; }
.cmt-content { font-size: 14px; line-height: 1.6; margin-top: 4px; }
.cmt-reply { color: #2b7cf6; }
.cmt-actions { margin-top: 6px; font-size: 12px; color: #9aa3b2; display: flex; gap: 16px; }
.cmt-del { color: #f64f2b; }

.input-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #f2f3f5; }
.input-field { flex: 1; border: 1px solid #e5e8ee; border-radius: 999px; padding: 8px 14px; font-size: 14px; outline: none; }
.report-body { padding: 12px 16px 20px; }
</style>
