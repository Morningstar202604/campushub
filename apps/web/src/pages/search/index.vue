<template>
  <div class="page">
    <van-nav-bar fixed placeholder left-arrow @click-left="router.back()">
      <template #title>
        <van-search
          v-model="keyword"
          placeholder="搜索帖子、商品"
          shape="round"
          autofocus
          @search="doSearch"
          @clear="results = null"
        />
      </template>
    </van-nav-bar>

    <div class="search-body">
      <van-empty v-if="results === null && !searching" description="输入关键词，搜索校园里的内容" />
      <van-empty v-else-if="results !== null && !results.posts.length && !results.products.length" description="没有找到相关内容" />

      <template v-else-if="results">
        <div class="sec-title">帖子</div>
        <PostCard v-for="p in results.posts" :key="p.id" :post="p" @open="(post) => router.push(`/post/${post.id}`)" />
        <div class="sec-title">商品</div>
        <div class="grid">
          <ProductCard v-for="p in results.products" :key="p.id" :product="p" @open="(product) => router.push(`/product/${product.id}`)" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showFailToast } from 'vant'
import { searchPosts, searchProducts } from '@/api/misc'
import type { Post, Product } from '@/types'
import PostCard from '@/components/PostCard.vue'
import ProductCard from '@/components/ProductCard.vue'

const router = useRouter()
const keyword = ref('')
const searching = ref(false)
const results = ref<{ posts: Post[]; products: Product[] } | null>(null)

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) { results.value = null; return }
  searching.value = true
  try {
    const [posts, products] = await Promise.all([searchPosts(kw), searchProducts(kw)])
    results.value = { posts: posts as Post[], products: products as Product[] }
  } catch (e: any) {
    showFailToast(e?.message || '搜索失败')
  } finally {
    searching.value = false
  }
}
</script>

<style scoped>
.search-body { padding-top: 4px; }
.sec-title { font-size: 13px; color: #9aa3b2; padding: 12px 16px 4px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 8px 12px; }
</style>
