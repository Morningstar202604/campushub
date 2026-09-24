<template>
  <div class="post-card" @click="$emit('open', post)">
    <div class="pc-head">
      <span class="pc-kind" :style="{ color: kindColor(post.kind) }">{{ kindLabel(post.kind) }}</span>
      <span v-if="post.is_pinned" class="pc-pin">置顶</span>
      <span v-if="post.resolved" class="pc-resolved">已解决</span>
      <span class="pc-time">{{ fmtTime(post.created_at) }}</span>
    </div>
    <div class="pc-body">
      <div class="pc-main">
        <div class="pc-title ellipsis">{{ post.title || '（无标题）' }}</div>
        <div v-if="post.content" class="pc-content ellipsis-2">{{ post.content }}</div>
        <div class="pc-meta">
          <span>{{ displayName(post) }}</span>
          <span class="pc-counts">
            <van-icon name="eye-o" /> {{ post.view_count }}
            <van-icon name="good-job-o" /> {{ post.like_count }}
            <van-icon name="comment-o" /> {{ post.comment_count }}
          </span>
        </div>
      </div>
      <img v-if="post.images?.length" :src="post.images[0]" class="pc-img" alt="" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Post } from '@/types'
import { fmtTime, kindLabel } from '@/utils/format'

defineProps<{ post: Post }>()
defineEmits<{ open: [post: Post] }>()

const KIND_COLORS: Record<string, string> = {
  post: '#2b7cf6', task: '#8f6bf6', lost: '#f6a02b', found: '#2e9e5b', confession: '#f64f7c'
}
function kindColor(kind?: string) { return KIND_COLORS[kind || 'post'] || '#2b7cf6' }
function displayName(post: Post) {
  return post.is_anonymous ? '匿名同学' : (post.author?.nickname || '同学')
}
</script>

<style scoped>
.post-card { background: #fff; border-radius: 12px; padding: 12px 14px; margin: 0 12px 10px; box-shadow: 0 1px 2px rgba(28,35,48,.04); cursor: pointer; }
.pc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.pc-kind { font-size: 12px; font-weight: 600; }
.pc-pin { font-size: 11px; color: #fff; background: #f64f7c; border-radius: 4px; padding: 1px 6px; }
.pc-resolved { font-size: 11px; color: #2e9e5b; border: 1px solid #2e9e5b; border-radius: 4px; padding: 1px 6px; }
.pc-time { margin-left: auto; font-size: 12px; color: #9aa3b2; }
.pc-body { display: flex; gap: 10px; }
.pc-main { flex: 1; min-width: 0; }
.pc-title { font-size: 15px; font-weight: 600; color: #1c2330; }
.pc-content { font-size: 13px; color: #66707f; line-height: 1.6; margin-top: 4px; }
.pc-meta { display: flex; justify-content: space-between; font-size: 12px; color: #9aa3b2; margin-top: 8px; }
.pc-counts { display: flex; gap: 10px; }
.pc-img { width: 84px; height: 84px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #f0f2f5; }
</style>
