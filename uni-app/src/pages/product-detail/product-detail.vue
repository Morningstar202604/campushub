<template>
  <view class="detail-root">
    <!-- 加载中：product 未就绪时不渲染 product.xxx（避免首屏 TypeError） -->
    <view v-if="loading" class="state-block">
      <text class="state-text">LOADING</text>
    </view>

    <!-- 失败 / 已下架 / 无此商品 -->
    <view v-else-if="!product" class="state-block">
      <text class="state-text state-err">{{ loadError || '商品不存在或已下架' }}</text>
      <view v-if="productId" class="state-retry" @click="loadDetail">重试</view>
    </view>

    <template v-else>
      <!-- 商品图 -->
      <view v-if="displayImages.length" class="product-gallery sticker">
        <image
          v-for="(img, i) in displayImages"
          :key="i"
          class="product-img"
          :src="img"
          mode="aspectFill"
          lazy-load
          @click="previewImage(i)"
        />
      </view>

      <!-- 标题 + 价格 + 状态 -->
      <view class="product-head sticker">
        <view class="head-top">
          <text class="product-title">{{ product.title }}</text>
          <text class="product-status" :class="statusClass">{{ statusLabel }}</text>
        </view>
        <view class="product-price-row">
          <text class="price-now">¥{{ product.price }}</text>
          <text v-if="product.originalPrice" class="price-orig">¥{{ product.originalPrice }}</text>
          <text class="product-cat">{{ catLabel(product.category) }} · {{ condLabel(product.condition) }}</text>
        </view>
      </view>

      <!-- 详情正文 -->
      <view v-if="product.description" class="product-desc sticker">
        <text class="desc-text">{{ product.description }}</text>
      </view>

      <!-- 交易信息 -->
      <view class="product-info sticker">
        <view v-if="product.location" class="info-row">
          <text class="info-label">交易地点</text>
          <text class="info-value">{{ product.location }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">交易方式</text>
          <text class="info-value">{{ tradeLabel(product.tradeType) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">浏览</text>
          <text class="info-value tabular-nums">{{ product.viewCount }}</text>
        </view>
      </view>

      <!-- 联系卖家（CALL_PHONE 权限已在 manifest.json 声明） -->
      <view v-if="product.contactInfo" class="contact-row sticker">
        <view class="contact-body">
          <text class="contact-label">联系方式</text>
          <text class="contact-value">{{ product.contactInfo }}</text>
        </view>
        <text
          class="contact-btn clip-tag"
          :class="{ disabled: !canTrade }"
          @click="onContact"
        >{{ contactBtnLabel }}</text>
      </view>
      <view v-if="!canTrade" class="info-hint">
        <text>该商品{{ statusLabel }}，暂不可联系卖家</text>
      </view>

      <!-- 操作行 -->
      <view class="action-bar sticker">
        <view class="action-item" :class="{ active: action.liked.value }" @click="action.toggleLike()">
          <text class="action-label">点赞</text>
          <text class="action-count tabular-nums">{{ action.likeCount.value }}</text>
        </view>
        <view class="action-item" :class="{ active: action.collected.value }" @click="action.toggleCollect()">
          <text class="action-label">收藏</text>
          <text class="action-count tabular-nums">{{ collectCount }}</text>
        </view>
        <!-- 作者本人视角：编辑 / 标记已售（二态） -->
        <view v-if="isMine" class="action-item mine" @click="onEdit">
          <text class="action-label">编辑</text>
        </view>
        <view v-if="isMine" class="action-item mine" :class="{ done: product.status === 'sold' }" @click="onToggleSold">
          <text class="action-label">{{ product.status === 'sold' ? '重新上架' : '标记已售' }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, fileIDToTempUrl } from '@/utils/api'
import { useAction } from '@/composables/use-action'
import { useUserStore } from '@/stores/user'
import { adaptProductDetail } from '@/adapters'
import type { ProductDetail } from '@/adapters'

const userStore = useUserStore()

const productId = ref('')
const product = ref<ProductDetail | null>(null)
// 后端原始 product 文档：用于取 userId 与当前登录用户比对（作者本人视角判断）
const productRaw = ref<any>(null)
const displayImages = ref<string[]>([])
const loading = ref(true)
const loadError = ref('')

const action = useAction({ targetId: productId, targetType: 'product' })

function catLabel(c: string): string {
  const m: Record<string, string> = { digital: '数码', books: '教材', living: '生活', sports: '运动', other: '其他' }
  return m[c] || c || '其他'
}
function condLabel(c: string): string {
  const m: Record<string, string> = { new: '全新', good: '九成新', fair: '有使用痕迹', old: '较旧' }
  return m[c] || c || ''
}
function tradeLabel(t: string): string {
  const m: Record<string, string> = { face: '面交', mail: '邮寄', both: '面交/邮寄' }
  return m[t] || t || '面交'
}

// 商品状态：on_sale 在售 / sold 已售出 / off_shelf 已下架
const statusLabel = computed(() => {
  const s = product.value?.status
  if (s === 'sold') return '已售出'
  if (s === 'off_shelf') return '已下架'
  return '在售'
})
const statusClass = computed(() => {
  const s = product.value?.status
  if (s === 'sold') return 'is-sold'
  if (s === 'off_shelf') return 'is-off'
  return 'is-on'
})
const canTrade = computed(() => (product.value?.status ?? 'on_sale') === 'on_sale')

const isPhone = computed(() => /^(?:\+?\d[\d\s-]{4,})$/.test((product.value?.contactInfo || '').trim()))
const contactBtnLabel = computed(() => {
  if (!canTrade.value) return '不可联系'
  return isPhone.value ? '拨号' : '复制'
})

// 收藏数：以服务端 collectCount 为基准，仅叠加本次会话内的收藏变化
const initialCollected = ref(false)
const collectCount = computed(() => {
  const base = product.value?.collectCount ?? 0
  return Math.max(0, base - (initialCollected.value ? 1 : 0) + (action.collected.value ? 1 : 0))
})

// 作者本人：后端 product-detail 返回完整文档（含 userId），与当前登录用户 _id 比对
const isMine = computed(() => {
  const uid = userStore.userInfo?._id
  return !!uid && !!productRaw.value?.userId && productRaw.value.userId === uid
})

// 编辑：带 id 进商品创建页的编辑模式（预填表单）
function onEdit() {
  // @ts-ignore
  uni.navigateTo({ url: `/pages/product-create/product-create?id=${productId.value}` })
}

// 标记已售 / 重新上架：product-update 快捷操作，只传 markSold（true→sold，false→on_sale）
async function onToggleSold() {
  const mark = (product.value?.status ?? 'on_sale') !== 'sold'
  try {
    const res: any = await callFunction('product-update', { productId: productId.value, markSold: mark })
    if (product.value) product.value.status = res?.status || (mark ? 'sold' : 'on_sale')
    uni.showToast({ title: mark ? '已标记为已售' : '已重新上架', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function loadDetail() {
  if (!productId.value) {
    loadError.value = '缺少商品ID'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res: any = await callFunction('product-detail', { productId: productId.value })
    const vm = adaptProductDetail(res)
    if (vm.status === 'deleted') {
      product.value = null
      loadError.value = '该商品已被删除'
      return
    }
    product.value = vm
    productRaw.value = res?.product ?? null
    initialCollected.value = vm.isCollected
    // product-detail 不返回 isLiked，仅回填收藏态（点赞由 composable 管理，不再自拼 callFunction）
    action.hydrate({ isLiked: false, isCollected: vm.isCollected, likeCount: vm.likeCount })
    // 图片 fileID(cloud://) → 临时可访问 URL，否则小程序/App 端不显示
    displayImages.value = await Promise.all(
      (vm.images || []).map((f) => fileIDToTempUrl(f).catch(() => f))
    )
  } catch (e: any) {
    product.value = null
    loadError.value = e?.message || String(e)
    console.error('[product-detail]', loadError.value)
  } finally {
    loading.value = false
  }
}

function previewImage(idx: number) {
  if (!displayImages.value.length) return
  // @ts-ignore
  uni.previewImage({ urls: displayImages.value, current: displayImages.value[idx] })
}

function onContact() {
  if (!canTrade.value) {
    uni.showToast({ title: `商品${statusLabel.value}，暂不可联系`, icon: 'none' })
    return
  }
  const v = (product.value?.contactInfo || '').trim()
  if (!v) return
  if (isPhone.value) {
    // 拨号：manifest.json 已声明 CALL_PHONE 权限
    // @ts-ignore
    uni.makePhoneCall({
      phoneNumber: v.replace(/[\s-]/g, ''),
      fail: () => {
        // 拨号不可用（如 H5）时退化为复制
        // @ts-ignore
        uni.setClipboardData({ data: v, success: () => uni.showToast({ title: '号码已复制', icon: 'none' }) })
      }
    })
  } else {
    // @ts-ignore
    uni.setClipboardData({ data: v, success: () => uni.showToast({ title: '已复制联系方式', icon: 'none' }) })
  }
}

onLoad((q) => {
  productId.value = String(q?.id || q?.productId || '')
  loadDetail()
})

onUnmounted(() => {
  displayImages.value = []
})
</script>

<style lang="scss">
.detail-root { padding: 24rpx 32rpx 80rpx; }

.state-block { padding: 140rpx 32rpx; text-align: center; }
.state-text { display: block; font-size: 24rpx; color: var(--text-secondary); letter-spacing: 2rpx; }
.state-err { color: var(--danger); }
.state-retry {
  display: inline-block; margin-top: 28rpx; padding: 12rpx 36rpx;
  font-size: 24rpx; font-weight: var(--fw-title); color: var(--accent);
  border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}

.product-gallery {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8rpx;
  padding: 12rpx; background: var(--bg-card);
  border: 1rpx solid var(--border); border-radius: var(--radius-sharp); margin-bottom: 20rpx;
  .product-img { width: 100%; height: 300rpx; border-radius: var(--radius-sharp); background: var(--bg-elevated); }
}

.product-head {
  padding: 24rpx; background: var(--bg-card);
  border: 1rpx solid var(--border); border-radius: var(--radius-sharp); margin-bottom: 20rpx;
}
.head-top { display: flex; align-items: flex-start; gap: 16rpx; }
.product-title { flex: 1; font-size: 34rpx; font-weight: var(--fw-title); color: var(--text-primary); }
.product-status {
  flex-shrink: 0; padding: 4rpx 14rpx; font-size: 20rpx; font-weight: var(--fw-title);
  border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
  &.is-on { color: var(--accent); border-color: var(--accent); }
  &.is-sold { color: var(--warning); border-color: var(--warning); }
  &.is-off { color: var(--text-tertiary); }
}

.product-price-row { display: flex; align-items: baseline; gap: 16rpx; margin-top: 16rpx; }
.price-now { font-size: 40rpx; font-weight: var(--fw-title); color: var(--accent); }
.price-orig { font-size: 24rpx; color: var(--text-tertiary); text-decoration: line-through; }
.product-cat { margin-left: auto; font-size: 22rpx; color: var(--text-secondary); }

.product-desc { padding: 24rpx; background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp); margin-bottom: 20rpx; }
.desc-text { font-size: 26rpx; color: var(--text-primary); line-height: 1.75; }

.product-info { padding: 8rpx 24rpx; background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp); }
.info-row { display: flex; padding: 16rpx 0; border-bottom: 1rpx solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { width: 140rpx; font-size: 24rpx; color: var(--text-tertiary); flex-shrink: 0; }
.info-value { flex: 1; font-size: 26rpx; color: var(--text-primary); }
.info-value.tabular-nums { color: var(--accent); }

.contact-row {
  display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; padding: 20rpx 24rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.contact-body { flex: 1; min-width: 0; }
.contact-label { display: block; font-size: 20rpx; color: var(--text-tertiary); }
.contact-value { display: block; font-size: 28rpx; font-weight: var(--fw-title); color: var(--text-primary); margin-top: 4rpx; }
.contact-btn {
  flex-shrink: 0; padding: 12rpx 32rpx; font-size: 24rpx; font-weight: var(--fw-title);
  color: var(--bg-page); background: var(--accent);
  &.disabled { color: var(--text-tertiary); background: var(--bg-elevated); }
}
.info-hint { margin-top: 12rpx; font-size: 22rpx; color: var(--text-tertiary); }

.action-bar {
  display: flex; gap: 48rpx; margin-top: 24rpx; padding: 20rpx 32rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
  .action-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
  .action-label { font-size: 22rpx; color: var(--text-secondary); }
  .action-count { font-size: 24rpx; font-weight: var(--fw-title); color: var(--text-primary); }
  .action-item.active .action-label { color: var(--accent); }
  .action-item.mine .action-label { color: var(--secondary); }
  .action-item.mine.done .action-label { color: var(--text-tertiary); }
}
</style>
