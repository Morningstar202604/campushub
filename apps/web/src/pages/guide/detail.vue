<template>
  <div class="page">
    <van-nav-bar :title="guide?.title || '指南'" fixed placeholder left-arrow @click-left="router.back()" />

    <van-skeleton v-if="!guide" title :row="8" style="padding: 16px" />

    <div v-else class="card">
      <h1 class="g-title">{{ guide.title }}</h1>
      <div class="g-meta">
        <span>{{ guide.tags?.map(t => '#' + t).join(' ') }}</span>
        <span><van-icon name="eye-o" /> {{ guide.view_count }}</span>
      </div>
      <!-- 富文本内容：管理端 vditor 的 Markdown → 本地渲染 + DOMPurify 净化 -->
      <div class="rich-text" v-html="renderedHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { guideById } from '@/api/misc'
import { supabase } from '@/lib/supabase'
import type { Guide } from '@/types'

const route = useRoute()
const router = useRouter()
const guide = ref<Guide | null>(null)
const guideId = computed(() => String(route.params.id))

const renderedHtml = computed(() => {
  if (!guide.value?.content) return ''
  const html = marked.parse(guide.value.content, { async: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
})

onMounted(async () => {
  try {
    guide.value = await guideById(guideId.value)
    supabase.rpc('incr_view', { t_type: 'guide', t_id: guideId.value }).then(() => {
      if (guide.value) guide.value.view_count += 1
    }, () => {})
  } catch { /* 忽略 */ }
})
</script>

<style scoped>
.g-title { font-size: 20px; margin: 0 0 8px; line-height: 1.4; }
.g-meta { display: flex; justify-content: space-between; font-size: 12px; color: #9aa3b2; padding-bottom: 12px; border-bottom: 1px solid #f2f3f5; margin-bottom: 12px; }
</style>

<style>
/* 富文本正文样式（指南内容，全局作用域以覆盖 v-html 内部元素） */
.rich-text { font-size: 15px; line-height: 1.8; color: #1c2330; word-break: break-word; }
.rich-text h1, .rich-text h2, .rich-text h3, .rich-text h4 { margin: 18px 0 8px; font-weight: 700; line-height: 1.4; }
.rich-text h1 { font-size: 20px; } .rich-text h2 { font-size: 18px; } .rich-text h3 { font-size: 16px; } .rich-text h4 { font-size: 15px; }
.rich-text p { margin: 8px 0; }
.rich-text ul, .rich-text ol { margin: 8px 0; padding-left: 22px; }
.rich-text li { margin: 4px 0; }
.rich-text a { color: #2b7cf6; }
.rich-text img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
.rich-text blockquote { margin: 10px 0; padding: 8px 12px; border-left: 3px solid #2b7cf6; background: #f0f6ff; border-radius: 6px; color: #66707f; }
.rich-text code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; background: #f2f3f5; padding: 2px 5px; border-radius: 4px; }
.rich-text pre { background: #1e2530; color: #e8eaef; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 10px 0; }
.rich-text pre code { background: transparent; color: inherit; padding: 0; }
.rich-text table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 14px; }
.rich-text th, .rich-text td { border: 1px solid #e5e8ee; padding: 6px 10px; text-align: left; }
.rich-text th { background: #f7f8fa; font-weight: 600; }
.rich-text hr { border: none; border-top: 1px solid #e5e8ee; margin: 16px 0; }
</style>
