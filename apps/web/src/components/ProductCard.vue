<template>
  <div class="product-card" @click="$emit('open', product)">
    <div class="pc-img-wrap">
      <img v-if="product.images?.length" :src="product.images[0]" class="pc-img" alt="" />
      <div v-else class="pc-img pc-img-empty"><van-icon name="photo-o" size="28" color="#c2c9d2" /></div>
      <span v-if="product.status === 'sold'" class="pc-sold">已售</span>
    </div>
    <div class="pc-title ellipsis">{{ product.title }}</div>
    <div class="pc-price">{{ fmtPrice(product.price) }} <span v-if="product.original_price" class="pc-orig">{{ fmtPrice(product.original_price) }}</span></div>
    <div class="pc-foot">
      <span>{{ conditionLabel(product.condition) }}</span>
      <span class="pc-counts"><van-icon name="eye-o" /> {{ product.view_count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '@/types'
import { fmtPrice, conditionLabel } from '@/utils/format'

defineProps<{ product: Product }>()
defineEmits<{ open: [product: Product] }>()
</script>

<style scoped>
.product-card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(28,35,48,.04); cursor: pointer; }
.pc-img-wrap { position: relative; }
.pc-img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #f0f2f5; }
.pc-img-empty { display: flex; align-items: center; justify-content: center; }
.pc-sold { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,.55); color: #fff; font-size: 11px; border-radius: 4px; padding: 2px 8px; }
.pc-title { font-size: 13px; color: #1c2330; padding: 8px 10px 0; }
.pc-price { font-size: 16px; font-weight: 700; color: #f64f2b; padding: 4px 10px 0; }
.pc-orig { font-size: 12px; color: #9aa3b2; text-decoration: line-through; font-weight: 400; margin-left: 4px; }
.pc-foot { display: flex; justify-content: space-between; font-size: 12px; color: #9aa3b2; padding: 6px 10px 10px; }
.pc-counts { display: flex; gap: 4px; align-items: center; }
</style>
