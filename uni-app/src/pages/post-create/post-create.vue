<template>
  <view class="create-root">
    <!-- 帖子类型（编辑模式下 kind 不可修改，仅展示） -->
    <view class="form-block sticker">
      <text class="block-label">类型</text>
      <view class="kind-grid">
        <view
          v-for="k in kinds"
          :key="k.value"
          class="kind-chip clip-tag"
          :class="{ active: kind === k.value }"
          @click="onKind(k.value)"
        >
          <text>{{ k.label }}</text>
        </view>
      </view>
      <text v-if="isEdit" class="hint">编辑模式：类型 / 匿名 / 任务过期等不可修改</text>
      <text v-else-if="kind === 'confession'" class="hint">表白墙将强制匿名发布（后端强制，无需手动选择）</text>
      <text v-else-if="kind === 'task'" class="hint">任务帖支持设置过期天数</text>
    </view>

    <!-- 标题 -->
    <view class="form-block sticker">
      <text class="block-label">标题 <text class="req">*</text></text>
      <input
        v-model="form.title"
        class="input"
        placeholder="一句话概括（不超过30字）"
        maxlength="30"
      />
    </view>

    <!-- 分类：多级下钻，必须选到叶子节点（后端会校验 categories 无子节点） -->
    <view class="form-block sticker">
      <text class="block-label">分类 <text class="req">*</text></text>
      <view class="cat-crumb">
        <text class="crumb" :class="{ on: !catPath.length }" @click="backTo(-1)">全部</text>
        <view v-for="(p, i) in catPath" :key="p.id" class="crumb-seg">
          <text class="crumb-sep">/</text>
          <text class="crumb" @click="backTo(i)">{{ p.name }}</text>
        </view>
      </view>
      <view class="cat-pick">
        <view
          v-for="c in catOptions"
          :key="c._id"
          class="cat-chip clip-tag"
          :class="{ active: categoryId === c._id, parent: hasChild(c._id) }"
          @click="pickCategory(c)"
        >
          <text>{{ c.name }}</text>
          <text v-if="hasChild(c._id)" class="cat-more">›</text>
        </view>
        <text v-if="!catOptions.length" class="hint">暂无可用分类</text>
      </view>
      <text v-if="categoryId" class="picked">已选：{{ selectedLabel }}</text>
      <text v-else-if="catPath.length" class="hint">请继续选择更具体的分类</text>
    </view>

    <!-- 任务帖：过期天数（编辑模式不可修改，隐藏） -->
    <view v-if="!isEdit && kind === 'task'" class="form-block sticker">
      <text class="block-label">任务过期</text>
      <view class="kind-grid">
        <view
          v-for="d in expireDays"
          :key="d"
          class="kind-chip clip-tag"
          :class="{ active: form.expireDays === d }"
          @click="form.expireDays = d"
        >
          <text>{{ d }} 天</text>
        </view>
      </view>
    </view>

    <!-- 失物/招领：地点（编辑模式不可修改，隐藏） -->
    <view v-if="!isEdit && (kind === 'lost' || kind === 'found')" class="form-block sticker">
      <text class="block-label">地点</text>
      <input v-model="form.location" class="input" placeholder="如：东区食堂门口" maxlength="50" />
    </view>

    <!-- 正文 -->
    <view class="form-block sticker">
      <text class="block-label">内容 <text v-if="!form.images.length" class="req">*</text></text>
      <textarea
        v-model="form.content"
        class="textarea"
        :placeholder="kind === 'confession' ? '想说的话（不超过500字）' : '详细描述（不超过2000字）'"
        :maxlength="kind === 'confession' ? 500 : 2000"
      />
    </view>

    <!-- 图片（最多9张） -->
    <view class="form-block sticker">
      <text class="block-label">图片（{{ form.images.length }}/9）</text>
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

    <!-- 标签（可选，最多10个，逗号分隔） -->
    <view class="form-block sticker">
      <text class="block-label">标签</text>
      <input v-model="form.tagsText" class="input" placeholder="用逗号分隔，最多10个" />
    </view>

    <!-- 提交 -->
    <view class="submit-wrap">
      <button
        class="submit-btn sticker"
        :disabled="submitting || uploading"
        @click="submit"
      >
        <text>{{ submitting ? (isEdit ? '保存中…' : '发布中…') : (isEdit ? '保存修改' : '发布') }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, uploadImage, fileIDToTempUrl } from '@/utils/api'

const kinds = [
  { label: '信息', value: 'post' },
  { label: '任务', value: 'task' },
  { label: '失物', value: 'lost' },
  { label: '招领', value: 'found' },
  { label: '表白', value: 'confession' }
]
const expireDays = [3, 7, 15, 30]

const kind = ref('post')
const form = reactive({
  title: '',
  content: '',
  tagsText: '',
  images: [] as string[],
  expireDays: 7,
  location: ''
})

// ---- 分类多级下钻 ----
// 一次拉全量分类（category-list 不传 parentId 返回全部），本地按 parentId 建树逐级下钻，
// 避免每钻一级都打一次云函数；只有当节点没有子节点时才允许作为最终 categoryId（后端要求叶子节点）。
const allCategories = ref<any[]>([])
const catPath = ref<{ id: string; name: string }[]>([])
const catOptions = ref<any[]>([])
const categoryId = ref('')

function childrenOf(parentId: string): any[] {
  const pid = String(parentId || '')
  return allCategories.value
    .filter((c) => String(c.parentId || '') === pid)
    .sort((a, b) => Number(a.order ?? a.sort ?? 0) - Number(b.order ?? b.sort ?? 0))
}
function hasChild(id: string): boolean {
  return allCategories.value.some((c) => String(c.parentId || '') === String(id))
}
function pickCategory(c: any) {
  if (hasChild(c._id)) {
    // 有子节点 → 下钻：把当前节点压入父级链，展示其子级，清空已选
    catPath.value = [...catPath.value, { id: c._id, name: c.name }]
    catOptions.value = childrenOf(c._id)
    categoryId.value = ''
  } else {
    // 叶子节点 → 确定为最终分类
    categoryId.value = c._id
  }
}
// 面包屑回退：level = -1 回到顶级
function backTo(level: number) {
  catPath.value = level < 0 ? [] : catPath.value.slice(0, level + 1)
  categoryId.value = ''
  const parentId = level < 0 ? '' : catPath.value[level].id
  catOptions.value = childrenOf(parentId)
}
// 提交给后端的分类链（父级链 + 叶子）
const categoryPath = computed(() =>
  [...catPath.value.map((p) => p.id), categoryId.value].filter(Boolean)
)
const selectedLabel = computed(() =>
  [...catPath.value.map((p) => p.name), ...catOptions.value.filter((c) => c._id === categoryId.value).map((c) => c.name)].join(' / ')
)

const submitting = ref(false)
const uploading = ref(false)

// 幂等键：进入页面生成一次，失败重试时复用同一个（后端用 clientReqId + 唯一索引防双帖）；
// 只有提交成功后才重置，下一次发布才是新的 clientReqId。
// ⚠️ 仅创建分支使用；编辑走 post-update（天然幂等），不带 clientReqId。
function genReqId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
const clientReqId = ref(genReqId('post'))

// ---- 编辑模式 ----
// my-list / post-detail 带 ?id= 进入 → 编辑态：拉 post-detail 预填表单，提交走 post-update
const editId = ref('')
const isEdit = computed(() => !!editId.value)
// 编辑进入时的原分类（分类未改动时不重复提交 categoryId/categoryPath）
const originalCategoryId = ref('')

onLoad((q: any) => {
  editId.value = String(q?.id || q?.postId || '')
  if (isEdit.value) {
    // @ts-ignore
    uni.setNavigationBarTitle({ title: '编辑帖子' })
  }
})

onMounted(async () => {
  try {
    const res: any = await callFunction('category-list', {})
    allCategories.value = res?.list ?? []
    catOptions.value = childrenOf('')
  } catch (e: any) {
    console.error('[post-create] category-list 拉取失败', e?.message || e)
    uni.showToast({ title: e?.message || '分类加载失败', icon: 'none' })
  }
  // 分类就绪后再回填（回填需要用分类树还原面包屑下钻链）
  if (isEdit.value) await loadPostForEdit()
})

// 拉取帖子详情并预填表单（编辑模式）
async function loadPostForEdit() {
  try {
    const res: any = await callFunction('post-detail', { postId: editId.value })
    const p = res?.post ?? null
    if (!p) {
      uni.showToast({ title: '帖子不存在或已删除', icon: 'none' })
      return
    }
    form.title = p.title || ''
    form.content = p.content || ''
    form.tagsText = Array.isArray(p.tags) ? p.tags.join('，') : ''
    // 图片回填原始 fileID（提交时原样带回 post-update），预览另存临时 URL
    form.images = Array.isArray(p.images) ? [...p.images] : []
    kind.value = p.kind || 'post'
    originalCategoryId.value = String(p.categoryId || '')
    await refreshImagePreviews()
    restoreCategory(String(p.categoryId || ''), p.categoryPath)
  } catch (e: any) {
    console.error('[post-create] 编辑回填失败', e?.message || e)
    uni.showToast({ title: e?.message || '加载帖子失败', icon: 'none' })
  }
}

// 用已存的 categoryId + categoryPath 还原分类下钻链（面包屑 + 可选项）
function restoreCategory(catId: string, path: any) {
  if (!catId) return
  const ids: string[] = Array.isArray(path) && path.length ? path.map(String) : []
  if (!ids.includes(catId)) ids.push(catId)
  // 优先用 categoryPath（祖先 id 链，末位是叶子本身）重建面包屑
  const chain: { id: string; name: string }[] = []
  for (const id of ids.slice(0, -1)) {
    const node = allCategories.value.find((c) => String(c._id) === id)
    if (!node) {
      chain.length = 0
      break
    }
    chain.push({ id: node._id, name: node.name })
  }
  // categoryPath 缺失/链断裂 → 用 parentId 从叶子向上爬
  if (!chain.length) {
    let cur: any = allCategories.value.find((c) => String(c._id) === catId)
    while (cur && String(cur.parentId || '')) {
      const parent: any = allCategories.value.find((c) => String(c._id) === String(cur.parentId))
      if (!parent) break
      chain.unshift({ id: parent._id, name: parent.name })
      cur = parent
    }
  }
  catPath.value = chain
  catOptions.value = childrenOf(chain.length ? chain[chain.length - 1].id : '')
  // 叶子分类即使不在当前 active 列表里也先回填（保存时后端会校验，失败则提示重选）
  categoryId.value = catId
}

function onKind(v: string) {
  // 编辑模式下 kind 不可修改（后端 post-update 不接受 kind），仅创建时可切换
  if (isEdit.value) return
  kind.value = v
  if (v !== 'task') form.expireDays = 7
  if (v !== 'lost' && v !== 'found') form.location = ''
}

async function chooseImage() {
  if (form.images.length >= 9) return
  // 先选图、拿到结果后再置 uploading：用户取消选择框时既不会卡住提交按钮（H5）
  // 也不会误报「图片上传失败」（小程序端 fail 回调 errMsg 含 cancel）
  let r: any
  try {
    // uni.chooseImage 三端通用（小程序/H5/App）
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
      // 上传到 CloudBase 存储 → 返回 fileID（后端 post-create 的图片安全校验依赖云存储 fileID）
      const fileID = await uploadImage(p)
      form.images.push(fileID)
    }
    // 预览用临时 URL（fileID 本身不能直接 <image> 渲染）
    await refreshImagePreviews()
  } catch (e: any) {
    console.error('[post-create] 上传图片失败', e?.message || e)
    uni.showToast({ title: e?.message || '图片上传失败', icon: 'none' })
  } finally {
    uploading.value = false
  }
}

// 维护「fileID → 临时 URL」预览映射（上传后刷新）
const imagePreviews = ref<string[]>([])
async function refreshImagePreviews() {
  imagePreviews.value = await Promise.all(
    form.images.map((f) => fileIDToTempUrl(f).catch(() => f))
  )
}

function removeImage(i: number) {
  form.images.splice(i, 1)
  imagePreviews.value.splice(i, 1)
}

async function submit() {
  // 本地前置校验（与后端契约对齐，减少无效请求）
  if (!form.title.trim()) return uni.showToast({ title: '请输入标题', icon: 'none' })
  if (form.title.trim().length > 30) return uni.showToast({ title: '标题不能超过30字', icon: 'none' })
  if (!form.content.trim() && !form.images.length) {
    return uni.showToast({ title: '请输入内容或上传图片', icon: 'none' })
  }
  if (!categoryId.value) {
    return uni.showToast({ title: catPath.value.length ? '请继续选择更具体的分类' : '请选择分类', icon: 'none' })
  }
  // 任务过期天数仅创建时可选（编辑模式后端不接受该字段，前端也不展示）
  if (!isEdit.value && kind.value === 'task' && !expireDays.includes(form.expireDays)) {
    return uni.showToast({ title: '请选择任务过期天数', icon: 'none' })
  }

  submitting.value = true
  try {
    const tags = form.tagsText
      ? form.tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 10)
      : []
    // ---- 编辑分支：post-update，天然幂等，不带 clientReqId；成功后返回上一页 ----
    if (isEdit.value) {
      const payload: Record<string, any> = {
        postId: editId.value,
        title: form.title.trim(),
        content: form.content.trim(),
        images: form.images,
        tags
      }
      // 分类改动才提交 categoryId/categoryPath（后端会校验叶子 + active）
      if (categoryId.value !== originalCategoryId.value) {
        payload.categoryId = categoryId.value
        payload.categoryPath = categoryPath.value
      }
      await callFunction('post-update', payload)
      uni.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        // @ts-ignore
        uni.navigateBack()
      }, 600)
      return
    }
    // ---- 创建分支：post-create（clientReqId 幂等防双帖）----
    const res: any = await callFunction('post-create', {
      clientReqId: clientReqId.value,
      title: form.title.trim(),
      content: form.content.trim(),
      images: form.images,
      tags,
      categoryId: categoryId.value,
      categoryPath: categoryPath.value,
      kind: kind.value,
      expireDays: kind.value === 'task' ? form.expireDays : 7,
      // 表白墙由后端强制匿名，这里同步传给后端（后端会再兜底一次）
      isAnonymous: kind.value === 'confession',
      location: ['lost', 'found'].includes(kind.value) ? form.location : ''
    })
    const postId = res?.postId
    // 发布成功 → 重置幂等键，下一次发布才是新的
    clientReqId.value = genReqId('post')
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => {
      // @ts-ignore
      uni.redirectTo({ url: `/pages/post-detail/post-detail?id=${postId}` })
    }, 600)
  } catch (e: any) {
    // 失败不重置 clientReqId：网络闪断重试复用同一个，后端幂等兜底防双帖
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
.req { color: var(--accent); }

.kind-grid, .cat-pick { display: flex; flex-wrap: wrap; gap: 16rpx; }
.kind-chip, .cat-chip {
  display: flex; align-items: center; gap: 6rpx;
  padding: 8rpx 24rpx; font-size: 24rpx; color: var(--text-secondary);
  background: var(--bg-elevated); border: 1rpx solid var(--border);
  &.active { color: #0D110E; background: var(--accent); font-weight: var(--fw-title); }
}
.cat-chip.parent { border-style: dashed; }
.cat-more { font-size: 26rpx; color: var(--text-tertiary); }

.cat-crumb { display: flex; flex-wrap: wrap; align-items: center; margin-bottom: 16rpx; }
.crumb-seg { display: flex; align-items: center; }
.crumb { font-size: 24rpx; color: var(--text-secondary); }
.crumb.on { color: var(--accent); font-weight: var(--fw-title); }
.crumb-sep { margin: 0 8rpx; color: var(--text-tertiary); }
.picked { display: block; font-size: 22rpx; color: var(--accent); margin-top: 12rpx; }

.input {
  width: 100%; font-size: 28rpx; color: var(--text-primary);
  background: var(--bg-elevated); padding: 16rpx; border-radius: var(--radius-sharp);
  border: 1rpx solid var(--border); box-sizing: border-box;
}
.textarea {
  width: 100%; min-height: 200rpx; font-size: 28rpx; color: var(--text-primary);
  background: var(--bg-elevated); padding: 16rpx; border-radius: var(--radius-sharp);
  border: 1rpx solid var(--border); box-sizing: border-box; line-height: 1.6;
}

.hint { display: block; font-size: 22rpx; color: var(--text-tertiary); margin-top: 12rpx; }

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

.submit-wrap { margin-top: 40rpx; }
.submit-btn {
  width: 100%; padding: 24rpx; background: var(--accent);
  color: #0D110E; font-size: 30rpx; font-weight: var(--fw-title);
  border: none; border-radius: var(--radius-sharp);
  &[disabled] { opacity: 0.6; }
}
</style>
