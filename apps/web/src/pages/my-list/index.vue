<template>
  <div class="page">
    <van-nav-bar :title="tabTitle" fixed placeholder left-arrow @click-left="router.back()" />

    <van-tabs v-model:active="tab" sticky offset-top="46">
      <van-tab title="我的帖子" name="posts" />
      <van-tab title="我的商品" name="products" />
      <van-tab title="我的收藏" name="collects" />
    </van-tabs>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div v-if="!list.length && loaded" style="padding-top: 40px">
        <van-empty :description="emptyText" />
      </div>

      <!-- 帖子 -->
      <PostCard v-for="p in list as Post[]" v-show="tab === 'posts'" :key="p.id" :post="p" @open="(post) => router.push(`/post/${post.id}`)" />

      <!-- 商品 -->
      <div v-show="tab === 'products'" class="grid">
        <ProductCard v-for="p in list as Product[]" :key="p.id" :product="p" @open="(product) => router.push(`/product/${product.id}`)" />
      </div>

      <!-- 收藏（混合，按类型渲染） -->
      <template v-if="tab === 'collects'">
        <PostCard v-for="p in collectPosts" :key="p.id" :post="p" @open="(post) => router.push(`/post/${post.id}`)" />
        <div class="grid">
          <ProductCard v-for="p in collectProducts" :key="p.id" :product="p" @open="(product) => router.push(`/product/${product.id}`)" />
        </div>
      </template>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showFailToast } from 'vant'
import { useAuthStore } from '@/stores/auth'
import { myPosts, myProducts, myCollects } from '@/api/my'
import type { Post, Product } from '@/types'
import PostCard from '@/components/PostCard.vue'
import ProductCard from '@/components/ProductCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tab = ref(String(route.query.tab || 'posts'))
const list = ref<(Post | Product)[]>([])
const loaded = ref(false)
const refreshing = ref(false)

const tabTitle = computed(() => ({ posts: '我的帖子', products: '我的商品', collects: '我的收藏' })[tab.value] || '我的内容')
const emptyText = computed(() => ({ posts: '还没有发布过帖子，去首页发一条吧', products: '还没有发布过商品，去市集发布吧', collects: '还没有收藏内容，看到喜欢的点个收藏' })[tab.value] || '暂无内容')
const collectPosts = computed(() => list.value.filter(x => 'kind' in x) as Post[])
const collectProducts = computed(() => list.value.filter(x => 'price' in x) as Product[])

watch(tab, load)

onMounted(load)

async function load() {
  if (!auth.profile) {
    showFailToast('请先登录')
    router.replace({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  loaded.value = false
  list.value = []
  try {
    if (tab.value === 'posts') {
      list.value = await myPosts()
    } else if (tab.value === 'products') {
      list.value = await myProducts()
    } else {
      list.value = await myCollects()
    }
  } catch (e: any) {
    console.warn('[my-list] 加载失败', e?.message)
  } finally {
    loaded.value = true
  }
}

async function onRefresh() {
  await load()
  refreshing.value = false
}
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 10px 12px; }
</style>
