<template>
  <view class="ann-page">
    <!-- 顶栏 -->
    <view class="ann-top">
      <view class="ann-heading">
        <text class="ann-kicker clip-tag">ANNOUNCEMENTS</text>
        <text class="ann-sub">全站公告运营 · 最多展示 5 条启用中的公告</text>
      </view>
      <button class="btn-ghost ann-refresh press" @click="loadAll">刷新</button>
    </view>

    <!-- 新建表单（create） -->
    <view class="ann-form sticker">
      <text class="ann-form-title title-900">发布公告</text>
      <input v-model="form.title" class="ann-input" :maxlength="50" placeholder="标题（50 字内）" />
      <textarea
        v-model="form.content"
        class="ann-textarea"
        :maxlength="1000"
        placeholder="正文（1000 字内）"
      />
      <view class="ann-form-foot">
        <view
          class="ann-pin clip-tag press"
          :class="{ active: form.isPinned }"
          @click="form.isPinned = !form.isPinned"
        >
          <text>置顶</text>
        </view>
        <button class="btn-primary ann-submit press" :disabled="submitting" @click="onCreate">
          发布
        </button>
      </view>
    </view>

    <!-- 错误 / 空态 -->
    <view v-if="error" class="ann-state">
      <view class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">ERROR</text>
        <text class="empty-title">{{ error }}</text>
      </view>
      <button class="ann-retry press" @click="loadAll">重试</button>
    </view>
    <view v-else-if="loading" class="ann-state">
      <text class="ann-loading">加载中…</text>
    </view>
    <view v-else-if="!list.length" class="empty-state">
      <view class="empty-shape"></view>
      <text class="empty-kicker">ANNOUNCEMENTS</text>
      <text class="empty-title">还没有公告</text>
      <text class="empty-sub">发布第一条公告通知全站</text>
    </view>

    <!-- 列表（list-all，后端固定 limit 50 无分页，不用 z-paging） -->
    <view v-else class="ann-list">
      <view v-for="a in list" :key="a._id" class="ann-item" :class="{ off: a.status !== 'active' }">
        <view class="ann-item-head">
          <text class="badge" :class="a.status === 'active' ? 'badge-ok' : 'badge-dim'">
            {{ a.status === 'active' ? '上线中' : '已下线' }}
          </text>
          <text v-if="a.isPinned" class="badge badge-pin">置顶</text>
          <text class="time tabular-nums">{{ fmt(a.createdAt) }}</text>
        </view>
        <text class="ann-item-title title-900">{{ a.title }}</text>
        <text class="ann-item-content">{{ a.content }}</text>
        <view class="ann-item-actions">
          <!-- toggle：上/下线二态切换 -->
          <button class="act act-accent press" @click.stop="onToggle(a)">
            {{ a.status === 'active' ? '下线' : '上线' }}
          </button>
          <button class="act act-danger press" @click.stop="onDelete(a)">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'
import { ensureAdmin } from '@/composables/use-admin-guard'

/**
 * 公告管理：announcement 云函数管理员侧 4 个动作全接入
 *   list-all 拉全量（后端 limit 50，无分页语义）→ 不用 z-paging，onLoad 一次性拉取
 *   create / toggle / delete → 操作后本地刷新
 * 守卫：onLoad 校验 role === 'admin'（服务端 checkAdmin 强制，前端仅体验层）。
 */

const list = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const submitting = ref(false)
const form = reactive({ title: '', content: '', isPinned: false })

onLoad(async () => {
  // 共享守卫：先等登录态刷新再判定 role（role 不进本地持久化，冷启动时这里恒为 undefined）
  if (!(await ensureAdmin())) return
  loadAll()
})

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const res: any = await callFunction('announcement', { action: 'list-all' })
    list.value = res?.list ?? []
  } catch (e: any) {
    error.value = String(e?.message || e)
    console.error('[announcements] list-all 失败', error.value)
  } finally {
    loading.value = false
  }
}

async function onCreate() {
  const title = form.title.trim()
  const content = form.content.trim()
  if (!title || !content) {
    uni.showToast({ title: '标题和内容不能为空', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await callFunction('announcement', {
      action: 'create',
      title,
      content,
      isPinned: form.isPinned
    })
    uni.showToast({ title: '已发布', icon: 'success' })
    form.title = ''
    form.content = ''
    form.isPinned = false
    loadAll()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '发布失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function onToggle(a: any) {
  const toActive = a.status !== 'active'
  try {
    const res: any = await callFunction('announcement', { action: 'toggle', id: a._id })
    // 以后端返回的最终状态为准回写，避免与后端状态机漂移
    a.status = res?.status || (toActive ? 'active' : 'inactive')
    uni.showToast({ title: toActive ? '已上线' : '已下线', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function onDelete(a: any) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除公告',
      content: `确定删除「${a.title}」？删除后不可恢复`,
      confirmText: '删除',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return
  try {
    await callFunction('announcement', { action: 'delete', id: a._id })
    list.value = list.value.filter((x) => x._id !== a._id)
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
  }
}

function fmt(t: any): string {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<style lang="scss" scoped>
.ann-page {
  /* H5：100vh 含浏览器/应用导航栏，会多出 44px 造成整页滚动条；
     小程序/App 无 --window-top，100vh 即可视区。 */
  /* #ifdef H5 */
  min-height: calc(100vh - var(--window-top));
  /* #endif */
  /* #ifndef H5 */
  min-height: 100vh;
  /* #endif */
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 60rpx;
}

/* 顶栏 */
.ann-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
}
.ann-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.ann-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.ann-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}
.ann-refresh {
  font-size: 22rpx;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  margin: 0;
}

/* 新建表单 */
.ann-form {
  margin: 0 32rpx 24rpx;
  padding: 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.ann-form-title {
  font-size: 28rpx;
  color: var(--text-primary);
}
.ann-input {
  height: 72rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: var(--text-body);
  background: var(--bg-deep);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.ann-textarea {
  width: 100%;
  height: 200rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: var(--text-body);
  background: var(--bg-deep);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  line-height: 1.6;
}
.ann-form-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ann-pin {
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--bg-deep);
  border: 1rpx solid var(--border);
  &.active {
    color: #0d110e;
    background: var(--accent);
    font-weight: var(--fw-title);
  }
}
.ann-submit {
  font-size: 26rpx;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 40rpx;
  margin: 0;
}

/* 列表 */
.ann-list {
  padding: 0 24rpx;
}
.ann-item {
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  padding: 24rpx;
  margin-bottom: 20rpx;
  &.off {
    opacity: 0.55;
  }
}
.ann-item-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.ann-item-title {
  display: block;
  font-size: 30rpx;
  color: var(--text-primary);
  line-height: 1.4;
}
.ann-item-content {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}
.ann-item-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
}

.badge {
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  font-weight: var(--fw-title);
  letter-spacing: 2rpx;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  flex-shrink: 0;
}
.badge-ok {
  color: var(--success);
  background: var(--bg-elevated);
}
.badge-pin {
  color: #0d110e;
  background: var(--accent);
}
.badge-dim {
  color: var(--text-tertiary);
  background: var(--bg-deep);
}
.time {
  margin-left: auto;
  font-size: 20rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.act {
  font-size: 22rpx;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  margin: 0;
  border-radius: var(--radius-sharp);
}
.act-accent {
  background: transparent;
  color: var(--accent);
  border: 2rpx solid var(--accent-dim);
}
.act-danger {
  background: var(--danger);
  color: #14100e;
  border: none;
  font-weight: var(--fw-title);
}

/* 状态 */
.ann-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.ann-loading {
  font-size: 24rpx;
  color: var(--text-tertiary);
}
.ann-retry {
  margin: 20rpx auto 0;
  background: var(--bg-elevated);
  color: var(--text-body);
  font-size: 24rpx;
  font-weight: var(--fw-title);
  border: 2rpx solid var(--border);
  padding: 0 40rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: var(--radius-sharp);
}
</style>
