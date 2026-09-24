<template>
  <div class="page">
    <van-nav-bar :title="scene ? sceneTitle : '发布'" fixed placeholder left-arrow @click-left="back" />

    <!-- 场景选择 -->
    <div v-if="!scene" class="scene-list">
      <div v-for="s in scenes" :key="s.key" class="scene-card" @click="pick(s.key)">
        <div class="scene-icon" :style="{ background: s.bg }">{{ s.icon }}</div>
        <div>
          <div class="scene-name">{{ s.name }}</div>
          <div class="scene-desc">{{ s.desc }}</div>
        </div>
        <van-icon name="arrow" class="scene-arrow" />
      </div>
      <div class="login-tip" v-if="!auth.isLoggedIn">
        <van-icon name="info-o" /> 发布前需要先<router-link to="/login">登录</router-link>
      </div>
    </div>

    <!-- 场景表单 -->
    <div v-else class="form-wrap">
      <!-- 通用：帖子 -->
      <template v-if="scene === 'post'">
        <van-field label="分类" required :model-value="selectedLabel" placeholder="请选择分类" readonly is-link @click="showCat = true" />
        <van-field v-model="postForm.title" label="标题" required maxlength="30" placeholder="一句话概括（30字内）" />
        <van-field v-model="postForm.content" label="内容" type="textarea" rows="4" autosize :placeholder="postForm.kind === 'confession' ? '想说的话' : '详细描述'" />
        <van-field label="图片">
          <template #input><van-uploader v-model="postFiles" :max-count="9" /></template>
        </van-field>
        <van-field v-if="postForm.kind === 'lost' || postForm.kind === 'found'" v-model="postForm.location" label="地点" placeholder="如：东区食堂门口" />
        <van-cell v-if="postForm.kind !== 'confession'" center title="匿名发布" :border="false">
          <template #right-icon><van-switch v-model="postForm.is_anonymous" size="22" /></template>
        </van-cell>
        <div v-if="postForm.kind === 'confession'" class="anon-tip">表白墙为匿名发布，不会显示你的昵称</div>
      </template>

      <!-- 卖闲置 -->
      <template v-else-if="scene === 'product'">
        <van-field v-model="productForm.title" label="标题" required maxlength="30" placeholder="如：九成新高数教材一套" />
        <van-field label="图片" required>
          <template #input><van-uploader v-model="productFiles" :max-count="9" /></template>
        </van-field>
        <van-field v-model="productForm.price" label="价格" required type="number" placeholder="售价（元）" />
        <van-field v-model="productForm.original_price" label="原价" type="number" placeholder="原价（选填，展示折扣）" />
        <van-field label="成色" required>
          <template #input>
            <select v-model="productForm.condition" class="plain-select">
              <option v-for="(label, key) in conditions" :key="key" :value="key">{{ label }}</option>
            </select>
          </template>
        </van-field>
        <van-field v-model="productForm.description" label="描述" type="textarea" rows="3" autosize placeholder="新旧程度、购买渠道、瑕疵说明等" />
        <van-field v-model="productForm.trade_type" label="交易方式" placeholder="如：校内自提 / 可邮寄" />
        <van-field v-model="productForm.location" label="交易地点" placeholder="如：三食堂门口" />
        <van-field v-model="productForm.contact_info" label="联系方式" required placeholder="微信/QQ/手机号" />
      </template>

      <!-- 失物/招领 -->
      <template v-else-if="scene === 'lostfound'">
        <van-field label="类型">
          <template #input>
            <van-tabs v-model:active="lostKind" :border="false" @change="onLostKind">
              <van-tab title="失物" name="lost" />
              <van-tab title="招领" name="found" />
            </van-tabs>
          </template>
        </van-field>
        <van-field v-model="postForm.title" label="标题" required maxlength="30" :placeholder="lostKind === 'lost' ? '丢了什么？' : '捡到了什么？'" />
        <van-field v-model="postForm.content" label="描述" type="textarea" rows="3" autosize :placeholder="lostKind === 'lost' ? '特征、丢失时间地点等' : '特征、捡到时间地点等'" />
        <van-field v-model="postForm.location" label="地点" placeholder="如：图书馆三楼" />
        <van-field label="图片">
          <template #input><van-uploader v-model="postFiles" :max-count="6" /></template>
        </van-field>
        <div class="anon-tip">失物/招领建议留下联系方式，方便同学联系你（发布后可修改）</div>
      </template>

      <!-- 表白墙 -->
      <template v-else-if="scene === 'confession'">
        <van-field v-model="postForm.content" label="内容" required type="textarea" rows="5" autosize maxlength="500" placeholder="想说的话（500字内）" show-word-limit />
        <van-field label="图片">
          <template #input><van-uploader v-model="postFiles" :max-count="6" /></template>
        </van-field>
        <div class="anon-tip">匿名发布，不会显示你的任何信息</div>
      </template>

      <div style="padding: 16px 12px 40px;">
        <van-button type="primary" block round :loading="submitting" :disabled="!auth.isLoggedIn" @click="submit">
          {{ submitting ? '发布中…' : '发布' }}
        </van-button>
        <van-button v-if="!auth.isLoggedIn" block plain type="primary" style="margin-top: 10px" @click="router.push('/login')">去登录</van-button>
      </div>
    </div>

    <!-- 分类选择弹层 -->
    <van-popup v-model:show="showCat" position="bottom" round>
      <div class="cat-picker">
        <div class="cat-picker-title">选择分类</div>
        <div class="cat-grid">
          <div
            v-for="c in appStore.categories" :key="c.id"
            class="cat-opt" :class="{ active: postForm.category_id === c.id }"
            @click="selectCat(c)"
          >{{ c.emoji }} {{ c.name }}</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { createPost } from '@/api/posts'
import { createProduct } from '@/api/products'
import { uploadImages, ensureBucket } from '@/lib/upload'

const router = useRouter()
const appStore = useAppStore()
const auth = useAuthStore()

const scenes = [
  { key: 'post', icon: '📝', name: '发帖子', desc: '图文信息、提问、分享', bg: '#e8f1ff' },
  { key: 'product', icon: '🛒', name: '卖闲置', desc: '二手商品，4 项必填快速上架', bg: '#fff3e8' },
  { key: 'lostfound', icon: '🔍', name: '失物 / 招领', desc: '丢了东西或捡到东西', bg: '#eef9ef' },
  { key: 'confession', icon: '💌', name: '表白墙', desc: '匿名表白、留言', bg: '#ffeef4' }
]
const conditions = { new: '全新', almost_new: '几乎全新', good: '良好', fair: '一般', damaged: '损坏' }

const scene = ref('')
const sceneTitle = computed(() => scenes.find(s => s.key === scene.value)?.name || '发布')
const lostKind = ref<'lost' | 'found'>('lost')

const showCat = ref(false)
const postFiles = ref<{ file: File }[]>([])
const productFiles = ref<{ file: File }[]>([])

const postForm = ref({
  category_id: '', title: '', content: '', location: '', kind: 'post', is_anonymous: false
})
const productForm = ref({
  title: '', description: '', price: '', original_price: '', condition: 'good',
  trade_type: '', location: '', contact_info: ''
})

const submitting = ref(false)

const selectedLabel = computed(() => {
  const c = appStore.categories.find(x => x.id === postForm.value.category_id)
  return c ? `${c.emoji} ${c.name}` : ''
})

function back() {
  if (scene.value) { scene.value = ''; return }
  router.back()
}

function pick(key: string) {
  scene.value = key
  if (key === 'product') {
    productForm.value.trade_type = '校内自提'
  } else if (key === 'lostfound') {
    postForm.value.kind = lostKind.value
    // 失物/招领固定归属"失物招领"分类，用户无需手动选择
    postForm.value.category_id = 'cat_lost'
  } else if (key === 'confession') {
    postForm.value.kind = 'confession'
    postForm.value.is_anonymous = true
    // 表白墙固定归属"表白墙"分类
    postForm.value.category_id = 'cat_confess'
  } else {
    postForm.value.kind = 'post'
    postForm.value.is_anonymous = false
  }
}

function onLostKind(name: string) {
  postForm.value.kind = name as 'lost' | 'found'
}

function selectCat(c: { id: string; name: string; emoji: string }) {
  postForm.value.category_id = c.id
  // 选了表白墙分类则切换为表白场景语义
  if (c.name.includes('表白')) { postForm.value.kind = 'confession'; postForm.value.is_anonymous = true }
  showCat.value = false
}

async function submit() {
  if (!auth.isLoggedIn) { showFailToast('请先登录'); return }
  submitting.value = true
  try {
    await ensureBucket()
    if (scene.value === 'product') {
      await submitProduct()
    } else {
      await submitPost()
    }
    showSuccessToast('发布成功')
    setTimeout(() => {
      router.replace('/')
    }, 800)
  } catch (e: any) {
    showFailToast(e?.message || '发布失败')
  } finally {
    submitting.value = false
  }
}

async function submitPost() {
  const f = postForm.value
  if (!f.category_id) throw new Error('请选择分类')
  if (!f.title.trim() && scene.value !== 'confession') throw new Error('请填写标题')
  if (!f.content.trim() && !postFiles.value.length) throw new Error('请填写内容或上传图片')
  const images = await uploadImages(postFiles.value.map(x => x.file))
  await createPost({
    category_id: f.category_id,
    kind: f.kind,
    title: scene.value === 'confession' ? '匿名表白' : f.title.trim(),
    content: f.content.trim(),
    images,
    location: f.location.trim(),
    is_anonymous: f.is_anonymous
  })
}

async function submitProduct() {
  const f = productForm.value
  if (!f.title.trim()) throw new Error('请填写标题')
  if (!productFiles.value.length) throw new Error('请至少上传一张图片')
  const price = Number(f.price)
  if (!price || price <= 0) throw new Error('请填写正确的价格')
  if (!f.contact_info.trim()) throw new Error('请填写联系方式')
  const images = await uploadImages(productFiles.value.map(x => x.file))
  await createProduct({
    category_id: 'cat_idle',
    title: f.title.trim(),
    description: f.description.trim(),
    images,
    price,
    original_price: f.original_price ? Number(f.original_price) : null,
    condition: f.condition,
    trade_type: f.trade_type.trim() || '校内自提',
    location: f.location.trim(),
    contact_info: f.contact_info.trim()
  })
}
</script>

<style scoped>
.scene-list { padding: 12px; }
.scene-card { display: flex; align-items: center; gap: 12px; background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(28,35,48,.04); cursor: pointer; }
.scene-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.scene-name { font-size: 16px; font-weight: 600; }
.scene-desc { font-size: 12px; color: #9aa3b2; margin-top: 2px; }
.scene-arrow { margin-left: auto; color: #c2c9d2; }
.login-tip { text-align: center; color: #9aa3b2; font-size: 13px; padding: 16px 0; }
.form-wrap { padding-top: 4px; }
.anon-tip { font-size: 12px; color: #f6a02b; padding: 6px 16px 0; }
.plain-select { border: none; outline: none; background: transparent; font-size: 14px; color: #1c2330; width: 100%; }
.cat-picker { padding: 16px 12px 32px; max-height: 60vh; overflow-y: auto; }
.cat-picker-title { font-size: 16px; font-weight: 600; text-align: center; margin-bottom: 14px; }
.cat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.cat-opt { text-align: center; padding: 14px 0; background: #f7f8fa; border-radius: 10px; font-size: 14px; cursor: pointer; }
.cat-opt.active { background: #e8f1ff; color: var(--app-primary); font-weight: 600; }
</style>
