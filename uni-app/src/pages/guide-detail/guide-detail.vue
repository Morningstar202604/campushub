<template>
  <view class="gd-page">
    <!-- 加载中 -->
    <view v-if="loading" class="gd-state">
      <text class="gd-state-text">LOADING</text>
    </view>

    <!-- 错误 -->
    <view v-else-if="error" class="gd-state">
      <text class="gd-state-text gd-state-err">{{ error }}</text>
      <button class="gd-retry" @click="load">RETRY</button>
    </view>

    <!-- 空态：无 id 或后端查无此指南 -->
    <view v-else-if="!guide.id" class="gd-state">
      <text class="gd-state-text">指南不存在或暂未发布</text>
    </view>

    <template v-else>
      <!-- 顶部状态条 -->
      <view class="gd-header">
        <view class="gd-kicker">CAMPUS GUIDE</view>
        <view v-if="guide.title" class="gd-title">{{ guide.title }}</view>
        <view v-if="guide.summary" class="gd-summary">{{ guide.summary }}</view>
        <view class="gd-meta-row">
          <view v-if="guide.category" class="gd-chip">
            <text class="gd-chip-acid">{{ guide.category }}</text>
          </view>
          <view v-if="guide.viewCount > 0" class="gd-view">
            <text>{{ guide.viewCount }}</text>
            <text class="gd-view-label"> views</text>
          </view>
          <text v-if="guide.time" class="gd-time tabular-nums">{{ guide.time }}</text>
        </view>
        <view v-if="guide.tags && guide.tags.length" class="gd-tags">
          <text v-for="(t, i) in guide.tags" :key="i" class="gd-tag">{{ t }}</text>
        </view>
      </view>

      <!-- 正文 -->
      <view class="gd-body">
        <view class="gd-block">
          <view class="gd-block-label">STEP 01</view>
          <rich-text :nodes="contentNodes" class="gd-rich" space="all-line-breaks" />
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, fileIDToTempUrl } from '@/utils/api'
import { fmtTime } from '@/adapters'

interface GuideDetail {
  id: string
  title: string
  summary: string
  coverImage: string
  category: string
  tags: string[]
  viewCount: number
  content: string
  time: string
}

const guideId = ref('')
const loading = ref(true)
const error = ref('')

// 默认空结构：模板在加载完成前即可安全取字段（不会抛 TypeError / 渲染 undefined）
const guide = ref<GuideDetail>({
  id: '',
  title: '',
  summary: '',
  coverImage: '',
  category: '',
  tags: [],
  viewCount: 0,
  content: '',
  time: ''
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    // 后端契约：guide-detail → ok({ guide })
    const res: any = await callFunction('guide-detail', { guideId: guideId.value })
    const g = res?.guide ?? {}
    const cover = await fileIDToTempUrl(g.coverImage || '').catch(() => g.coverImage || '')
    const content = g.content || g.body || g.description || ''
    guide.value = {
      id: g._id || g.id || guideId.value,
      title: g.title || '',
      summary: g.summary || '',
      coverImage: cover,
      category: g.category || '',
      tags: Array.isArray(g.tags) ? g.tags : [],
      viewCount: g.viewCount ?? 0,
      content,
      time: g.createdAt ? fmtTime(g.createdAt) : ''
    }
  } catch (e: any) {
    guide.value = { ...guide.value, id: '', title: '', summary: '', content: '' }
    error.value = e?.message || String(e)
    console.error('[guide-detail]', error.value)
  } finally {
    loading.value = false
  }
}

// ---- rich-text 正文 ----
// uni-app 已知限制：rich-text 内部是原生节点，页面样式（含 :deep）命不中，
// 因此必须把样式内联进 HTML 字符串。颜色只用 CSS 变量（--text-body 等），不写死色值。
const STYLE_H = 'font-size:32rpx;line-height:1.4;margin:24rpx 0 12rpx;color:var(--text-primary);font-weight:var(--fw-title)'
const STYLE_P = 'font-size:27rpx;line-height:1.8;margin:0 0 14rpx;color:var(--text-body)'
const STYLE_LI = 'font-size:26rpx;line-height:1.75;margin:0 0 8rpx;color:var(--text-body)'
const STYLE_EMPTY = 'color:var(--text-tertiary);font-size:24rpx'

const INLINE_STYLES: Record<string, string> = {
  h1: 'font-size:36rpx;line-height:1.35;margin:26rpx 0 12rpx;color:var(--text-primary);font-weight:var(--fw-title)',
  h2: STYLE_H,
  h3: 'font-size:29rpx;line-height:1.45;margin:22rpx 0 10rpx;color:var(--text-primary);font-weight:var(--fw-title)',
  h4: STYLE_H,
  h5: STYLE_H,
  h6: STYLE_H,
  p: STYLE_P,
  li: STYLE_LI,
  strong: 'color:var(--text-primary);font-weight:var(--fw-title)',
  em: 'font-style:italic;color:var(--text-secondary)',
  a: 'color:var(--accent)'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 极简清洗：去 script/style 块与内联事件，阻断注入（内容来自自家云函数，仍做兜底） */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '')
}

/** 给富文本原生标签注入内联样式（已带 style 的做追加合并） */
function decorate(html: string): string {
  return html.replace(/<\s*(h[1-6]|p|li|strong|em|a)([^>]*)>/gi, (m, tag: string, attrs: string) => {
    const style = INLINE_STYLES[tag.toLowerCase()]
    if (!style) return m
    if (/style\s*=/i.test(attrs)) {
      const merged = attrs.replace(
        /style\s*=\s*(['"])(.*?)\1/i,
        (_x, q: string, s: string) => `style=${q}${s};${style}${q}`
      )
      return `<${tag}${merged}>`
    }
    return `<${tag}${attrs} style="${style}">`
  })
}

const contentNodes = computed(() => {
  const raw = (guide.value.content || '').trim()
  if (!raw) return `<p style="${STYLE_EMPTY}">该指南暂无正文内容</p>`
  // 后端 guides.content 存的是 HTML（init-db 种子即 <h2>/<p>），直接透传并注入内联样式；
  // 早期实现把 HTML 转义后当纯文本渲染 → 页面显示成字面量 <h2>，属 bug。
  if (/<[a-z][^>]*>/i.test(raw)) return decorate(sanitizeHtml(raw))
  // 兜底：纯文本按行转段落
  return escapeHtml(raw)
    .split('\n')
    .map((line) => {
      const t = line.trim()
      if (!t) return ''
      if (/^#{1,6}\s/.test(t) || /^step/i.test(t)) return `<p style="${STYLE_H}">${t.replace(/^#{1,6}\s*/, '')}</p>`
      if (/^[-*•]\s/.test(t)) return `<p style="${STYLE_LI}">– ${t.replace(/^[-*•]\s*/, '')}</p>`
      return `<p style="${STYLE_P}">${t}</p>`
    })
    .filter(Boolean)
    .join('')
})

onLoad((opts) => {
  guideId.value = String((opts && (opts.id || opts.guideId)) || '')
  load()
})
</script>

<style lang="scss" scoped>
/* token 经 App.vue 的全局 :root 继承，任何组件样式表都能直接用 var(--*)，
   与是否 scoped / 是否 lang="scss" 无关；此处保留 scoped 做样式隔离，且不 @import tokens（避免重复定义）。 */
.gd-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 40rpx;
}

/* 顶部 */
.gd-header {
  padding: 28rpx 32rpx 20rpx;
}
.gd-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
  margin-bottom: 16rpx;
}
.gd-title {
  font-size: 44rpx;
  font-weight: var(--fw-title);
  line-height: 1.15;
  color: var(--text-body);
  letter-spacing: -1rpx;
}
.gd-summary {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}
.gd-meta-row {
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.gd-chip {
  border: 3rpx solid var(--border);
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  font-weight: var(--fw-title);
}
.gd-chip-acid {
  color: var(--text-secondary);
}
.gd-view {
  font-size: 22rpx;
  color: var(--text-body);
}
.gd-view-label {
  color: var(--text-tertiary);
}
.gd-time {
  margin-left: auto;
  font-size: 20rpx;
  color: var(--text-tertiary);
}
.gd-tags {
  margin-top: 20rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.gd-tag {
  font-size: 20rpx;
  color: var(--text-secondary);
  border: 2rpx solid var(--border);
  padding: 4rpx 12rpx;
}

/* 正文 */
.gd-body {
  margin: 8rpx 32rpx 0;
}
.gd-block {
  border: 3rpx solid var(--border);
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
  padding: 28rpx 24rpx;
  background: var(--bg-deep);
}
.gd-block-label {
  font-size: 18rpx;
  letter-spacing: 3rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
  margin-bottom: 16rpx;
}
.gd-rich {
  min-height: 40rpx;
}

/* 状态 */
.gd-state {
  padding: 80rpx 32rpx;
  text-align: center;
}
.gd-state-text {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
}
.gd-state-err {
  color: var(--danger);
}
.gd-retry {
  margin-top: 24rpx;
  background: var(--accent);
  color: var(--bg-page);
  font-weight: var(--fw-title);
  font-size: 24rpx;
  border: none;
  padding: 0 40rpx;
  height: 72rpx;
  line-height: 72rpx;
}
</style>
