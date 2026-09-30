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
      <div v-if="feed.loading && !feed.list.length" class="skeleton-list">
        <div v-for="i in 4" :key="i" class="skeleton-card">
          <div class="sk-line w80"></div>
          <div class="sk-line w100"></div>
          <div class="sk-line w40"></div>
        </div>
      </div>
      <van-list v-model:loading="feed.loading" :finished="feed.finished" finished-text="没有更多了" @load="feed.loadMore">
        <PostCard v-for="p in feed.list" :key="p.id" :post="p" @open="(post) => router.push(`/post/${post.id}`)" />
        <van-empty v-if="feed.finished && !feed.list.length" description="还没有内容，去发布第一条吧" />
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
import { usePagination } from '@/composables/usePagination'
import type { Post } from '@/types'
import PostCard from '@/components/PostCard.vue'

const router = useRouter()
const appStore = useAppStore()
const announcements = computed(() => appStore.announcements)

const categoryId = ref('')
const tab = ref('recommend')
const refreshing = ref(false)

const feed = usePagination<Post>((p) =>
  feedPosts({
    categoryId: categoryId.value || undefined,
    tab: tab.value as any,
    page: p,
  }),
)

// 首屏主动加载（van-list 的 immediate-check 在某些环境下不触发，不能依赖它出首屏）
onMounted(() => {
  appStore.loadCategories()
  appStore.loadAnnouncements()
  feed.loadMore()
})

function pickCategory(id: string) {
  categoryId.value = id
  feed.reset()
}

function onTabChange() {
  feed.reset()
}

async function onRefresh() {
  await feed.reset()
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
  background: var(--app-card); border-radius: 999px; border: 1px solid #e5e8ee; cursor: pointer;
}
.cat-chip.active { color: #fff; background: var(--app-primary); border-color: var(--app-primary); font-weight: 600; }
</style>
