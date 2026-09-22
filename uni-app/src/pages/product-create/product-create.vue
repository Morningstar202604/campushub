<template>
  <view class="create-root">
    <!-- 标题 -->
    <view class="form-block sticker">
      <text class="block-label">标题 <text class="req">*</text></text>
      <input v-model="form.title" class="input" placeholder="商品标题（不超过30字）" maxlength="30" />
    </view>

    <!-- 图片（必须≥1，最多9） -->
    <view class="form-block sticker">
      <text class="block-label">图片 <text class="req">*</text>（{{ form.images.length }}/9）</text>
      <view class="img-grid">
        <view v-for="(img, i) in form.images" :key="i" class="img-item">
          <image class="img-thumb" :src="imagePreviews[i] || img" mode="aspectFill" />
          <view class="img-del" @click="removeImage(i)"><text>×</text></view>
        </view>
        <view v-if="form.images.length < 9" class="img-add" @click="chooseImage">
          <text class="img-plus">+</text>
        </view>
      </view>
      <text v-if="uploading" class="hint">正在上传图片…</text>
    </view>

    <!-- 价格 -->
    <view class="form-block sticker">
      <text class="block-label">售价（元）<text class="req">*</text></text>
      <input v-model="form.price" class="input" type="digit" placeholder="0.00" />
    </view>

    <!-- 原价（可选） -->
    <view class="form-block sticker">
      <text class="block-label">原价（元，可选）</text>
      <input v-model="form.originalPrice" class="input" type="digit" placeholder="留空则无划线价" />
    </view>

    <!-- 分类 / 成色 / 交易方式 -->
    <view class="form-block sticker">
      <text class="block-label">分类</text>
      <view class="chip-row">
        <view v-for="c in categories" :key="c.value" class="chip clip-tag" :class="{ active: form.category === c.value }" @click="form.category = c.value">
          <text>{{ c.label }}</text>
        </view>
      </view>
      <text class="block-label sub">成色</text>
      <view class="chip-row">
        <view v-for="c in conditions" :key="c.value" class="chip clip-tag" :class="{ active: form.condition === c.value }" @click="form.condition = c.value">
          <text>{{ c.label }}</text>
        </view>
      </view>
      <text class="block-label sub">交易方式</text>
      <view class="chip-row">
        <view v-for="c in trades" :key="c.value" class="chip clip-tag" :class="{ active: form.tradeType === c.value }" @click="form.tradeType = c.value">
          <text>{{ c.label }}</text>
        </view>
      </view>
    </view>

    <!-- 地点 / 联系方式 -->
    <view class="form-block sticker">
      <text class="block-label">交易地点</text>
      <input v-model="form.location" class="input" placeholder="如：东区宿舍楼下" maxlength="200" />
      <text class="block-label sub">联系方式</text>
      <input v-model="form.contactInfo" class="input" placeholder="手机号 / 微信号等" maxlength="100" />
    </view>

    <!-- 描述 -->
    <view class="form-block sticker">
      <text class="block-label">描述</text>
      <textarea v-model="form.description" class="textarea" placeholder="补充说明（不超过2000字）" maxlength="2000" />
    </view>

    <!-- 提交 -->
    <view class="submit-wrap">
      <button class="submit-btn sticker" :disabled="submitting || uploading" @click="submit">
        <text>{{ submitting ? (isEdit ? '保存中…' : '发布中…') : (isEdit ? '保存修改' : '发布好物') }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, uploadImage, fileIDToTempUrl } from '@/utils/api'

// ⚠️ 本枚举是「商品分类」的唯一事实来源。
// market.vue 的筛选枚举必须与本清单对齐（market 额外含 value='all' 的「全部」，后端 product-list 会跳过 'all' 不做过滤）。
const categories = [
  { label: '数码', value: 'digital' },
  { label: '教材', value: 'books' },
  { label: '生活', value: 'living' },
  { label: '运动', value: 'sports' },
  { label: '其他', value: 'other' }
]
const conditions = [
  { label: '全新', value: 'new' },
  { label: '九成新', value: 'good' },
  { label: '有使用痕迹', value: 'fair' },
  { label: '较旧', value: 'old' }
]
const trades = [
  { label: '面交', value: 'face' },
  { label: '邮寄', value: 'mail' },
  { label: '面交/邮寄', value: 'both' }
]

const CATEGORY_VALUES = categories.map((c) => c.value)
const CONDITION_VALUES = conditions.map((c) => c.value)
const TRADE_VALUES = trades.map((c) => c.value)

const form = reactive({
  title: '',
  description: '',
  images: [] as string[],
  price: '',
  originalPrice: '',
  category: 'other',
  condition: 'good',
  tradeType: 'face',
  location: '',
  contactInfo: ''
})
const imagePreviews = ref<string[]>([])
const submitting = ref(false)
const uploading = ref(false)

// 幂等键：进入页面生成一次，失败重试复用（后端 product-create 用 clientReqId + 唯一索引防双商品），
// 仅提交成功后重置。
// ⚠️ 仅创建分支使用；编辑走 product-update（天然幂等），不带 clientReqId。
function genReqId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
const clientReqId = ref(genReqId('prod'))

// ---- 编辑模式 ----
// my-list / product-detail 带 ?id= 进入 → 编辑态：拉 product-detail 预填表单，提交走 product-update
const editId = ref('')
const isEdit = computed(() => !!editId.value)

onLoad((q: any) => {
  editId.value = String(q?.id || q?.productId || '')
  if (isEdit.value) {
    // @ts-ignore
    uni.setNavigationBarTitle({ title: '编辑商品' })
    loadProductForEdit()
  }
})

// 拉取商品详情并预填表单（编辑模式）
async function loadProductForEdit() {
  try {
    const res: any = await callFunction('product-detail', { productId: editId.value })
    const p = res?.product ?? null
    if (!p) {
      uni.showToast({ title: '商品不存在或已下架', icon: 'none' })
      return
    }
    form.title = p.title || ''
    form.description = p.description || ''
    // 图片回填原始 fileID（提交时原样带回 product-update），预览另存临时 URL
    form.images = Array.isArray(p.images) ? [...p.images] : []
    form.price = p.price != null ? String(p.price) : ''
    form.originalPrice = p.originalPrice != null ? String(p.originalPrice) : ''
    // 枚举字段兜底：库里值不在当前枚举内时回落到默认，避免选中态丢失
    form.category = CATEGORY_VALUES.includes(p.category) ? p.category : 'other'
    form.condition = CONDITION_VALUES.includes(p.condition) ? p.condition : 'good'
    form.tradeType = TRADE_VALUES.includes(p.tradeType) ? p.tradeType : 'face'
    form.location = p.location || ''
    form.contactInfo = p.contactInfo || ''
    imagePreviews.value = await Promise.all(
      form.images.map((f) => fileIDToTempUrl(f).catch(() => f))
    )
  } catch (e: any) {
    console.error('[product-create] 编辑回填失败', e?.message || e)
    uni.showToast({ title: e?.message || '加载商品失败', icon: 'none' })
  }
}

async function chooseImage() {
  if (form.images.length >= 9) return
  // 先选图、拿到结果后再置 uploading：用户取消选择框时既不会卡住提交按钮（H5）
  // 也不会误报「图片上传失败」（小程序端 fail 回调 errMsg 含 cancel）
  let r: any
  try {
    r = await new Promise((resolve, reject) => {
      // @ts-ignore
      uni.chooseImage({ count: 9 - form.images.length, success: resolve, fail: reject })
    })
  } catch (e: any) {
    if (String(e?.errMsg || e?.message || '').toLowerCase().includes('cancel')) return // 用户主动取消
    uni.showToast({ title: e?.message || '选择图片失败', icon: 'none' })
    return
  }
  const paths: string[] = r?.tempFilePaths ?? []
  if (!paths.length) return
  uploading.value = true
  try {
    for (const p of paths) {
      const fileID = await uploadImage(p)
      form.images.push(fileID)
    }
    imagePreviews.value = await Promise.all(form.images.map((f) => fileIDToTempUrl(f).catch(() => f)))
  } catch (e: any) {
    uni.showToast({ title: e?.message || '图片上传失败', icon: 'none' })
  } finally {
    uploading.value = false
  }
}

function removeImage(i: number) {
  form.images.splice(i, 1)
  imagePreviews.value.splice(i, 1)
}

async function submit() {
  // 本地前置校验（与后端 product-create 契约严格对齐）
  if (!form.title.trim()) return uni.showToast({ title: '请输入商品标题', icon: 'none' })
  if (form.title.trim().length > 30) return uni.showToast({ title: '标题不能超过30字', icon: 'none' })
  if (!form.images.length) return uni.showToast({ title: '请至少上传一张图片', icon: 'none' })
  if (form.images.length > 9) return uni.showToast({ title: '图片不能超过9张', icon: 'none' })
  const price = Number(form.price)
  if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) {
    return uni.showToast({ title: '请输入有效价格', icon: 'none' })
  }
  let originalPrice: number | null = null
  if (form.originalPrice !== '') {
    const op = Number(form.originalPrice)
    if (!Number.isFinite(op) || op <= 0) return uni.showToast({ title: '请输入有效原价', icon: 'none' })
    if (op < price) return uni.showToast({ title: '原价不能低于售价', icon: 'none' })
    originalPrice = op
  }
  if (!CATEGORY_VALUES.includes(form.category) || !CONDITION_VALUES.includes(form.condition) || !TRADE_VALUES.includes(form.tradeType)) {
    return uni.showToast({ title: '请选择分类 / 成色 / 交易方式', icon: 'none' })
  }

  submitting.value = true
  try {
    // ---- 编辑分支：product-update，天然幂等，不带 clientReqId；成功后返回上一页 ----
    if (isEdit.value) {
      await callFunction('product-update', {
        productId: editId.value,
        title: form.title.trim(),
        description: form.description.trim(),
        images: form.images,
        price,
        originalPrice,
        category: form.category,
        condition: form.condition,
        tradeType: form.tradeType,
        location: form.location,
        contactInfo: form.contactInfo
      })
      uni.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        // @ts-ignore
        uni.navigateBack()
      }, 600)
      return
    }
    // ---- 创建分支：product-create（clientReqId 幂等防双商品）----
    const res: any = await callFunction('product-create', {
      clientReqId: clientReqId.value,
      title: form.title.trim(),
      description: form.description.trim(),
      images: form.images,
      price,
      originalPrice,
      category: form.category,
      condition: form.condition,
      tradeType: form.tradeType,
      location: form.location,
      contactInfo: form.contactInfo
    })
    const productId = res?.productId
    clientReqId.value = genReqId('prod')
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => {
      // @ts-ignore
      uni.redirectTo({ url: `/pages/product-detail/product-detail?id=${productId}` })
    }, 600)
  } catch (e: any) {
    // 失败不重置 clientReqId，重试复用同一幂等键
    uni.showToast({ title: e?.message || '发布失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.create-root { padding: 24rpx 32rpx 80rpx; }

.form-block {
  padding: 24rpx; margin-bottom: 20rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.block-label { display: block; font-size: 26rpx; font-weight: var(--fw-title); color: var(--text-primary); margin-bottom: 16rpx; }
.block-label.sub { margin-top: 24rpx; }
.req { color: var(--accent); }

.input {
  width: 100%; font-size: 28rpx; color: var(--text-primary);
  background: var(--bg-elevated); padding: 16rpx; border-radius: var(--radius-sharp);
  border: 1rpx solid var(--border); box-sizing: border-box; margin-bottom: 8rpx;
}
.textarea {
  width: 100%; min-height: 160rpx; font-size: 28rpx; color: var(--text-primary);
  background: var(--bg-elevated); padding: 16rpx; border-radius: var(--radius-sharp);
  border: 1rpx solid var(--border); box-sizing: border-box; line-height: 1.6;
}

.chip-row { display: flex; flex-wrap: wrap; gap: 16rpx; }
.chip {
  padding: 8rpx 24rpx; font-size: 24rpx; color: var(--text-secondary);
  background: var(--bg-elevated); border: 1rpx solid var(--border);
  &.active { color: #0D110E; background: var(--accent); font-weight: var(--fw-title); }
}

.img-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.img-item { position: relative; width: 160rpx; height: 160rpx; }
.img-thumb { width: 100%; height: 100%; border-radius: var(--radius-sharp); background: var(--bg-elevated); }
.img-del {
  position: absolute; top: -8rpx; right: -8rpx; width: 36rpx; height: 36rpx;
  background: var(--danger); color: #0D110E; border-radius: 8rpx;
  display: flex; align-items: center; justify-content: center; font-size: 24rpx; font-weight: var(--fw-title);
}
.img-add {
  width: 160rpx; height: 160rpx; border: 2rpx dashed var(--border); border-radius: var(--radius-sharp);
  display: flex; align-items: center; justify-content: center;
  .img-plus { font-size: 48rpx; color: var(--text-tertiary); }
}
.hint { display: block; font-size: 22rpx; color: var(--text-tertiary); margin-top: 12rpx; }

.submit-wrap { margin-top: 40rpx; }
.submit-btn {
  width: 100%; padding: 24rpx; background: var(--accent);
  color: #0D110E; font-size: 30rpx; font-weight: var(--fw-title);
  border: none; border-radius: var(--radius-sharp);
  &[disabled] { opacity: 0.6; }
}
</style>
