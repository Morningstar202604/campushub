<template>
  <div class="page detail-page">
    <van-nav-bar fixed placeholder left-arrow @click-left="router.back()">
      <template #right>
        <van-icon name="ellipsis" size="20" color="#1c2330" @click="onMore" />
      </template>
    </van-nav-bar>

    <van-skeleton v-if="loading" title :row="6" style="padding: 16px" />

    <template v-else-if="product">
      <!-- 图片轮播 -->
      <van-swipe v-if="product.images?.length" class="swipe" :autoplay="0" indicator-color="#fff">
        <van-swipe-item v-for="(img, i) in product.images" :key="i">
          <img :src="img" class="swipe-img" @click="preview(i)" />
        </van-swipe-item>
      </van-swipe>

      <!-- 价格与标题 -->
      <div class="card">
        <div class="p-price-row">
          <span class="p-price">{{ fmtPrice(product.price) }}</span>
          <span v-if="product.original_price" class="p-orig">{{ fmtPrice(product.original_price) }}</span>
          <span v-if="product.status === 'sold'" class="p-sold">已售出</span>
        </div>
        <h1 class="p-title">{{ product.title }}</h1>
        <div class="p-meta">
          <span>{{ conditionLabel(product.condition) }}</span>
          <span>·</span>
          <span>{{ product.trade_type }}</span>
          <span v-if="product.location">·</span>
          <span v-if="product.location">{{ product.location }}</span>
          <span class="p-view"><van-icon name="eye-o" /> {{ product.view_count }}</span>
        </div>
        <div class="p-desc">{{ product.description }}</div>
      </div>

      <!-- 卖家 -->
      <div class="card seller-card">
        <van-image round width="40" height="40" :src="product.seller?.avatar || ''" fit="cover" />
        <div class="seller-info">
          <div class="seller-name">{{ product.seller?.nickname || '同学' }}</div>
          <div class="seller-time">{{ fmtTime(product.created_at) }} 发布</div>
        </div>
        <van-button v-if="!isMine && auth.isLoggedIn" size="small" round :type="following ? 'default' : 'primary'" @click="onFollow">
          {{ following ? '已关注' : '关注' }}
        </van-button>
      </div>

      <!-- 联系方式 -->
      <div v-if="product.contact_info" class="card contact-card">
        <div class="contact-title">联系卖家</div>
        <div class="contact-info">{{ product.contact_info }}</div>
        <div class="contact-tip">交易请当面验货，切勿提前转账，谨防诈骗</div>
      </div>

      <!-- 操作条 -->
      <div class="action-bar">
        <div class="action" :class="{ on: collected }" @click="onCollect">
          <van-icon :name="collected ? 'star' : 'star-o'" size="22" />
          <span>{{ product.collect_count }}</span>
        </div>
        <div class="action" @click="scrollToComments">
          <van-icon name="comment-o" size="22" />
          <span>{{ product.comment_count }}</span>
        </div>
        <van-button
          v-if="isMine"
          size="small" round
          :type="product.status === 'on_sale' ? 'success' : 'primary'"
          style="margin-left: auto"
          @click="onToggleStatus"
        >{{ product.status === 'on_sale' ? '标记已售' : '重新上架' }}</van-button>
      </div>

      <!-- 评论 -->
      <div class="card" id="comments">
        <div class="cmt-title">评论（{{ product.comment_count }}）</div>
        <div v-if="!comments.length" class="cmt-empty">还没有评论</div>
        <div v-for="c in comments" :key="c.id" class="cmt-item">
          <van-image round width="32" height="32" :src="c.user?.avatar || ''" fit="cover" />
          <div class="cmt-body">
            <div class="cmt-head">
              <span class="cmt-name">{{ c.user?.nickname || '同学' }}</span>
              <span class="cmt-time">{{ fmtTime(c.created_at) }}</span>
            </div>
            <div class="cmt-content">{{ c.content }}</div>
          </div>
        </div>
      </div>

      <!-- 底部输入 -->
      <div class="input-bar">
        <input v-model="inputText" class="input-field" placeholder="问卖家问题…" @keyup.enter="sendComment" />
        <van-button size="small" type="primary" :disabled="!inputText.trim()" @click="sendComment">发送</van-button>
      </div>

      <!-- 更多操作 -->
      <van-action-sheet v-model:show="sheetShow" :actions="sheetActions" cancel-text="取消" @select="onSheetSelect" />

      <!-- 举报弹层 -->
      <van-dialog
        v-model:show="reportShow"
        title="举报"
        show-cancel-button
        confirm-button-text="提交举报"
        :before-close="onReportBeforeClose"
      >
        <div class="report-body">
          <van-field
            v-model="reportText"
            type="textarea"
            rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请填写举报原因（必填，200字内）"
          />
        </div>
      </van-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import { productById, updateProductStatus, softDeleteProduct } from '@/api/products'
import { listComments, addComment } from '@/api/posts'
import { toggleCollect, isCollected, toggleFollow, isFollowing } from '@/api/social'
import { submitReport } from '@/api/misc'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import type { Product, Comment } from '@/types'
import { fmtTime, fmtPrice, conditionLabel } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const productId = computed(() => String(route.params.id))
const loading = ref(true)
const product = ref<Product | null>(null)
const comments = ref<Comment[]>([])
const collected = ref(false)
const following = ref(false)
const inputText = ref('')
const isMine = computed(() => auth.isLoggedIn && product.value?.seller_id === auth.profile?.id)
const sheetShow = ref(false)
const sheetActions = ref<{ name: string; action: string }[]>([])
const reportShow = ref(false)
const reportText = ref('')

onMounted(init)

async function init() {
  try {
    product.value = await productById(productId.value)
    if (!product.value) { showFailToast('内容不存在'); return }
    supabase.rpc('incr_view', { t_type: 'product', t_id: productId.value }).then(() => {
      if (product.value) product.value.view_count += 1
    }, () => {})
    const [c, cl, f] = await Promise.all([
      listComments('product', productId.value),
      isCollected('product', productId.value),
      isFollowing(product.value.seller_id)
    ])
    comments.value = c
    collected.value = cl
    following.value = f
  } catch (e: any) {
    showFailToast(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function preview(i: number) {
  showImagePreview({ images: product.value?.images || [], startPosition: i })
}

async function onCollect() {
  try {
    await toggleCollect('product', productId.value, collected.value)
    collected.value = !collected.value
    if (product.value) product.value.collect_count += collected.value ? 1 : -1
  } catch (e: any) { loginFirst(e) }
}

async function onFollow() {
  try {
    await toggleFollow(product.value!.seller_id, following.value)
    following.value = !following.value
  } catch (e: any) { loginFirst(e) }
}

async function onToggleStatus() {
  if (!product.value) return
  const toSold = product.value.status === 'on_sale'
  try {
    await showConfirmDialog({
      title: '提示',
      message: toSold ? '标记为已售？商品将从市集列表下架，但详情保留。' : '重新上架这件商品？'
    })
  } catch { return }
  try {
    await updateProductStatus(product.value.id, toSold ? 'sold' : 'on_sale')
    product.value.status = toSold ? 'sold' : 'on_sale'
    showSuccessToast(toSold ? '已标记售出' : '已重新上架')
  } catch (e: any) { showFailToast(e?.message || '操作失败') }
}

async function sendComment() {
  const text = inputText.value.trim()
  if (!text) return
  try {
    await addComment('product', productId.value, text)
    comments.value = await listComments('product', productId.value)
    if (product.value) product.value.comment_count += 1
    inputText.value = ''
  } catch (e: any) { loginFirst(e) }
}

function scrollToComments() {
  document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })
}

function loginFirst(e: any) {
  if (/请先登录/.test(e?.message || '')) {
    showFailToast('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
  } else showFailToast(e?.message || '操作失败')
}

async function onMore() {
  const actions = []
  if (isMine.value) actions.push({ name: '删除商品', action: 'delete' })
  actions.push({ name: '举报', action: 'report' })
  sheetActions.value = actions
  sheetShow.value = true
}

function onSheetSelect(item: { action: string }) {
  if (item.action === 'delete') doDelete()
  if (item.action === 'report') doReport()
}

async function doDelete() {
  try {
    await showConfirmDialog({ title: '提示', message: '确定删除这件商品吗？删除后不可恢复。' })
  } catch { return }
  try {
    await softDeleteProduct(productId.value)
    showSuccessToast('已删除')
    setTimeout(() => router.replace('/market'), 600)
  } catch (e: any) { showFailToast(e?.message || '删除失败') }
}

async function doReport() {
  reportText.value = ''
  reportShow.value = true
}

async function onReportBeforeClose(action: string) {
  if (action !== 'confirm') return true
  const reason = reportText.value.trim()
  if (!reason) {
    showFailToast('请填写举报原因')
    return false
  }
  try {
    await submitReport('product', productId.value, reason)
    showSuccessToast('已提交，管理员会尽快处理')
    return true
  } catch (e: any) { loginFirst(e); return false }
}
</script>

<style scoped>
.detail-page { padding-bottom: 70px; }
.swipe { margin: 12px; border-radius: 12px; overflow: hidden; }
.swipe-img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; cursor: zoom-in; }

.p-price-row { display: flex; align-items: baseline; gap: 8px; }
.p-price { font-size: 24px; font-weight: 800; color: #f64f2b; }
.p-orig { font-size: 13px; color: #9aa3b2; text-decoration: line-through; }
.p-sold { font-size: 12px; color: #fff; background: #9aa3b2; border-radius: 4px; padding: 2px 8px; }
.p-title { font-size: 18px; margin: 8px 0 4px; line-height: 1.4; }
.p-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: #9aa3b2; align-items: center; }
.p-view { display: flex; gap: 3px; align-items: center; margin-left: auto; }
.p-desc { font-size: 14px; line-height: 1.8; margin-top: 12px; white-space: pre-wrap; word-break: break-word; }

.seller-card { display: flex; align-items: center; gap: 12px; }
.seller-info { flex: 1; }
.seller-name { font-size: 15px; font-weight: 600; }
.seller-time { font-size: 12px; color: #9aa3b2; margin-top: 2px; }

.contact-card { background: #fff8ef; }
.contact-title { font-size: 13px; color: #f6a02b; font-weight: 600; }
.contact-info { font-size: 16px; font-weight: 600; margin: 6px 0; word-break: break-all; }
.contact-tip { font-size: 12px; color: #f6a02b; }

.action-bar { position: sticky; top: 46px; z-index: 5; display: flex; align-items: center; background: #fff; margin: 0 12px; border-radius: 12px; padding: 8px 12px; box-shadow: 0 1px 2px rgba(28,35,48,.04); }
.action { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #66707f; margin-right: 24px; cursor: pointer; }
.action.on { color: #f6a02b; }

.cmt-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.cmt-empty { text-align: center; color: #9aa3b2; font-size: 13px; padding: 20px 0; }
.cmt-item { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid #f2f3f5; }
.cmt-body { flex: 1; min-width: 0; }
.cmt-head { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.cmt-name { font-weight: 600; }
.cmt-time { margin-left: auto; color: #c2c9d2; }
.cmt-content { font-size: 14px; line-height: 1.6; margin-top: 4px; }

.input-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid #f2f3f5; }
.input-field { flex: 1; border: 1px solid #e5e8ee; border-radius: 999px; padding: 8px 14px; font-size: 14px; outline: none; }
.report-body { padding: 12px 16px 20px; }
</style>
