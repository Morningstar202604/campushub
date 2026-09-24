<template>
  <div class="page">
    <van-nav-bar title="校园指南" fixed placeholder left-arrow @click-left="router.back()" />

    <van-tabs v-model:active="catId" sticky offset-top="46">
      <van-tab title="全部" name="" />
      <van-tab v-for="c in cats" :key="c.id" :title="`${c.icon} ${c.name}`" :name="c.id" />
    </van-tabs>

    <div v-if="!list.length" style="padding-top: 40px"><van-empty description="暂无指南内容" /></div>
    <div v-for="g in list" :key="g.id" class="guide-card" @click="router.push(`/guide/${g.id}`)">
      <div class="guide-main">
        <div class="guide-title ellipsis">{{ g.title }}</div>
        <div class="guide-summary ellipsis-2">{{ g.summary }}</div>
        <div class="guide-meta">
          <span>{{ g.tags?.slice(0, 3).map(t => '#' + t).join(' ') }}</span>
          <span><van-icon name="eye-o" /> {{ g.view_count }}</span>
        </div>
      </div>
      <img v-if="g.cover_image" :src="g.cover_image" class="guide-cover" alt="" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { guideCategories, guides } from '@/api/misc'
import type { Guide, GuideCategory } from '@/types'

const router = useRouter()
const cats = ref<GuideCategory[]>([])
const list = ref<Guide[]>([])
const catId = ref('')

watch(catId, load)

onMounted(async () => {
  cats.value = await guideCategories().catch(() => [])
  load()
})

async function load() {
  try {
    list.value = await guides(catId.value || undefined)
  } catch (e: any) {
    console.warn('[guide]', e?.message)
  }
}
</script>

<style scoped>
.guide-card { display: flex; gap: 12px; background: #fff; margin: 0 12px 10px; border-radius: 12px; padding: 14px; cursor: pointer; box-shadow: 0 1px 2px rgba(28,35,48,.04); }
.guide-main { flex: 1; min-width: 0; }
.guide-title { font-size: 15px; font-weight: 600; }
.guide-summary { font-size: 13px; color: #66707f; line-height: 1.6; margin-top: 4px; }
.guide-meta { display: flex; justify-content: space-between; font-size: 12px; color: #9aa3b2; margin-top: 8px; }
.guide-cover { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
</style>
