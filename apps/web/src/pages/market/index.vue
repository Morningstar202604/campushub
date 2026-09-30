<template>
  <div class="page">
    <van-nav-bar title="市集" fixed placeholder>
      <template #right>
        <van-icon name="search" size="20" color="#1c2330" @click="router.push('/search')" />
      </template>
    </van-nav-bar>

    <!-- 分类筛选（只显示二级分类） -->
    <div class="cat-scroll">
      <div class="cat-chip" :class="{ active: !categoryId }" @click="pick('')">全部</div>
      <div
        v-for="c in topCategories" :key="c.id"
        class="cat-chip" :class="{ active: categoryId === c.id }"
        @click="pick(c.id)"
      >{{ c.emoji }} {{ c.name }}</div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="feed.loading && !feed.list.length" class="skeleton-list">
        <div v-for="i in 4" :key="i" class="skeleton-card">
          <div class="sk-line w100"></div>
          <div class="sk-line w60"></div>
        </div>
      </div>
      <van-list v-model:loading="feed.loading" :finished="feed.finished" finished-text="没有更多了" @load="feed.loadMore">
        <div class="grid">
          <ProductCard
            v-for="p in feed.list" :key="p.id" :product="p"
            @open="(product) => router.push(`/product/${product.id}`)"
          />
        </div>
        <van-empty v-if="feed.finished && !feed.list.length" description="这里还没有在售商品" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { marketProducts } from '@/api/products'
import { usePagination } from '@/composables/usePagination'
import type { Product } from '@/types'
import ProductCard from '@/components/ProductCard.vue'

const router = useRouter()
const appStore = useAppStore()

// 市集只展示"二手闲置"分类及其子分类（如数码/书籍/生活用品），与帖子分类无关
const topCategories = computed(() => {
  const all = appStore.categories
  const idle = all.find(c => c.id === 'cat_idle')
  if (!idle) return all
  return all.filter(c => c.id === 'cat_idle' || c.parent_id === idle.id)
})

const categoryId = ref('')
const refreshing = ref(false)

const feed = usePagination<Product>((p) =>
  marketProducts({
    categoryId: categoryId.value || undefined,
    page: p,
  }),
)

onMounted(() => {
  appStore.loadCategories()
  feed.loadMore()
})

function pick(id: string) {
  categoryId.value = id
  feed.reset()
}

async function onRefresh() {
  await feed.reset()
  refreshing.value = false
}
</script>

<style scoped>
.cat-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px 4px; -webkit-overflow-scrolling: touch; }
.cat-scroll::-webkit-scrollbar { display: none; }
.cat-chip { flex-shrink: 0; padding: 6px 14px; font-size: 13px; color: #66707f; background: var(--app-card); border-radius: 999px; border: 1px solid #e5e8ee; cursor: pointer; }
.cat-chip.active { color: #fff; background: var(--app-primary); border-color: var(--app-primary); font-weight: 600; }

.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 10px 12px; }
</style>
