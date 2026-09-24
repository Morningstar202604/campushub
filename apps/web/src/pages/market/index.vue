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
      <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="onLoad">
        <div class="grid">
          <ProductCard
            v-for="p in list" :key="p.id" :product="p"
            @open="(product) => router.push(`/product/${product.id}`)"
          />
        </div>
        <van-empty v-if="finished && !list.length" description="这里还没有在售商品" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { marketProducts } from '@/api/products'
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
const list = ref<Product[]>([])
const page = ref(0)
const loading = ref(false)
const finished = ref(false)
const refreshing = ref(false)

onMounted(() => {
  appStore.loadCategories()
  onLoad()
})

function pick(id: string) {
  categoryId.value = id
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
    const { list: items, hasMore } = await marketProducts({
      categoryId: categoryId.value || undefined,
      page: next
    })
    list.value.push(...items)
    page.value = next
    finished.value = !hasMore
  } catch (e: any) {
    finished.value = true
    console.warn('[market] 加载失败', e?.message)
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
</script>

<style scoped>
.cat-scroll { display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px 4px; -webkit-overflow-scrolling: touch; }
.cat-scroll::-webkit-scrollbar { display: none; }
.cat-chip { flex-shrink: 0; padding: 6px 14px; font-size: 13px; color: #66707f; background: #fff; border-radius: 999px; border: 1px solid #e5e8ee; cursor: pointer; }
.cat-chip.active { color: #fff; background: var(--app-primary); border-color: var(--app-primary); font-weight: 600; }

.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 10px 12px; }
</style>
