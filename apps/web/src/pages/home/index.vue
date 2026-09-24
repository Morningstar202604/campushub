<template>
  <div class="page">
    <van-nav-bar :title="appStore.siteName" fixed placeholder>
      <template #right>
        <van-icon name="search" size="20" color="#1c2330" @click="router.push('/search')" />
      </template>
    </van-nav-bar>

    <!-- 公告 -->
    <van-notice-bar
      v-if="announcements.length"
      left-icon="volume-o"
      :scrollable="true"
      :text="announcements.map(a => a.title).join('　·　')"
      @click="onAnnouncement"
    />

    <!-- 分类横滑 -->
    <div class="cat-scroll">
      <div class="cat-chip" :class="{ active: !categoryId }" @click="pickCategory('')">全部</div>
      <div
        v-for="c in appStore.categories" :key="c.id"
        class="cat-chip" :class="{ active: categoryId === c.id }"
        @click="pickCategory(c.id)"
      >{{ c.emoji }} {{ c.name }}</div>
    </div>

    <!-- 信息流 -->
    <van-tabs v-model:active="tab" sticky offset-top="46" @change="onTabChange">
      <van-tab title="推荐" name="recommend" />
      <van-tab title="最新" name="latest" />
      <van-tab title="热榜" name="hot" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
        <PostCard v-for="p in list" :key="p.id" :post="p" @open="(post) => router.push(`/post/${post.id}`)" />
        <van-empty v-if="finished && !list.length" description="还没有内容，去发布第一条吧" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { useAppStore } from '@/stores/app'
import { feedPosts } from '@/api/posts'
import type { Post } from '@/types'
import PostCard from '@/components/PostCard.vue'

const router = useRouter()
const appStore = useAppStore()
const announcements = computed(() => appStore.announcements)

const categoryId = ref('')
const tab = ref('recommend')
const list = ref<Post[]>([])
const page = ref(0)
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

// 首屏主动加载（van-list 的 immediate-check 在某些环境下不触发，不能依赖它出首屏）
onMounted(() => {
  appStore.loadCategories()
  appStore.loadAnnouncements()
  onLoad()
})

function pickCategory(id: string) {
  categoryId.value = id
  reset()
}

function onTabChange() {
  reset()
}

function reset() {
  list.value = []
  page.value = 0
  finished.value = false
  loading.value = false
  onLoad()
}

async function onLoad() {
  if (loading.value || finished.value) return
  loading.value = true
  try {
    const next = page.value + 1
    const { list: items, hasMore } = await feedPosts({
      categoryId: categoryId.value || undefined,
      tab: tab.value as any,
      page: next
    })
    list.value.push(...items)
    page.value = next
    finished.value = !hasMore
  } catch (e: any) {
    finished.value = true
    console.warn('[home] 加载失败', e?.message)
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  list.value = []
  page.value = 0
  finished.value = false
  loading.value = false
  await onLoad()
  refreshing.value = false
}

function onAnnouncement() {
  const a = announcements.value[0]
  if (!a) return
  showConfirmDialog({ title: a.title, message: a.content, showCancelButton: false, confirmButtonText: '知道了' }).catch(() => {})
}
</script>

<style scoped>
.cat-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px 4px; -webkit-overflow-scrolling: touch; }
.cat-scroll::-webkit-scrollbar { display: none; }
.cat-chip {
  flex-shrink: 0; padding: 6px 14px; font-size: 13px; color: #66707f;
  background: #fff; border-radius: 999px; border: 1px solid #e5e8ee; cursor: pointer;
}
.cat-chip.active { color: #fff; background: var(--app-primary); border-color: var(--app-primary); font-weight: 600; }
</style>
