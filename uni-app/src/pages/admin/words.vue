<template>
  <view class="wd-page">
    <view class="wd-head">
      <view class="wd-heading">
        <text class="wd-kicker clip-tag">WORD FILTER</text>
        <text class="wd-title title-900">敏感词库</text>
        <text class="wd-sub">block 拒发 · replace 替换 · flag 进审核队列</text>
      </view>
      <button class="btn-ghost wd-add press" @click="openCreate">新增</button>
    </view>

    <view class="wd-filters">
      <view
        v-for="s in segs"
        :key="s.value"
        class="wd-seg clip-tag press"
        :class="{ active: activeSeg === s.value }"
        @click="switchSeg(s.value)"
      >
        <text>{{ s.label }}</text>
      </view>
    </view>

    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="true"
      :fixed="false"
      safe-area-inset-bottom
      @query="queryList"
    >
      <view v-if="error" class="wd-state">
        <text class="wd-error">{{ error }}</text>
        <button class="btn-ghost wd-retry press" @click="reload">重试</button>
      </view>

      <view v-for="w in filtered" :key="w._id" class="wd-card sticker">
        <view class="wd-card-head">
          <text class="wd-word">{{ w.word }}</text>
          <text class="wd-action clip-tag" :class="'act-' + w.action">{{ actionLabel(w.action) }}</text>
          <text v-if="w.status !== 'active'" class="wd-off clip-tag">已停用</text>
        </view>
        <text v-if="w.replacement" class="wd-replace">替换为：{{ w.replacement }}</text>
        <view class="wd-actions">
          <button class="wd-btn press" @click="toggleStatus(w)">
            {{ w.status === 'active' ? '停用' : '启用' }}
          </button>
          <button class="wd-btn wd-btn-danger press" @click="removeWord(w)">删除</button>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">WORD FILTER</text>
          <text class="empty-title">词库还是空的</text>
          <text class="empty-sub">新增第一个敏感词，发布链路 5 分钟内生效</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'
import { ensureAdmin } from '@/composables/use-admin-guard'

const pagingRef = ref<any>(null)
const list = ref<any[]>([])
const error = ref('')
const activeSeg = ref('all')
const segs = [
  { label: '全部', value: 'all' },
  { label: '拒发', value: 'block' },
  { label: '替换', value: 'replace' },
  { label: '送审', value: 'flag' }
]

const filtered = computed(() =>
  activeSeg.value === 'all' ? list.value : list.value.filter((w) => w.action === activeSeg.value)
)

onLoad(async () => {
  const isAdmin = await ensureAdmin()
  if (isAdmin) pagingRef.value?.reload?.()
})

async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging) return
  error.value = ''
  try {
    const res: any = await callFunction('word-manage', { action: 'list', page, pageSize: size })
    const rows = res?.list ?? []
    paging.completeByNoMore(rows, rows.length < size)
  } catch (e: any) {
    error.value = e?.message || String(e)
    if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
    else paging.complete?.(false)
  }
}

function reload() {
  error.value = ''
  pagingRef.value?.reload?.()
}

function switchSeg(v: string) {
  activeSeg.value = v
}

function actionLabel(a: string) {
  return a === 'replace' ? '替换' : a === 'flag' ? '送审' : '拒发'
}

function prompt(title: string, placeholder: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      content: initial,
      success: (r: any) => resolve(r.confirm ? String(r.content || '') : null),
      fail: () => resolve(null)
    } as any)
  })
}

async function openCreate() {
  const word = await prompt('新增敏感词', '输入词条（≤50 字）')
  if (word === null) return
  if (!word.trim()) return uni.showToast({ title: '词条不能为空', icon: 'none' })

  const action = await new Promise<string>((resolve) => {
    uni.showActionSheet({
      itemList: ['拒发（block）', '替换（replace）', '送审（flag）'],
      success: (r) => resolve(['block', 'replace', 'flag'][r.tapIndex] || 'block'),
      fail: () => resolve('')
    })
  })
  if (!action) return

  let replacement = ''
  if (action === 'replace') {
    const r = await prompt('替换文本', '命中后显示为（留空用 *）')
    if (r === null) return
    replacement = r
  }

  try {
    await callFunction('word-manage', {
      action: 'create',
      word: word.trim(),
      wordAction: action,
      replacement
    })
    uni.showToast({ title: '已新增', icon: 'success' })
    reload()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '新增失败', icon: 'none' })
  }
}

async function toggleStatus(w: any) {
  try {
    await callFunction('word-manage', {
      action: 'update',
      wordId: w._id,
      status: w.status === 'active' ? 'inactive' : 'active'
    })
    w.status = w.status === 'active' ? 'inactive' : 'active'
    uni.showToast({ title: '已更新', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function removeWord(w: any) {
  const ok: any = await new Promise((resolve) => {
    uni.showModal({
      title: '删除词条',
      content: `确定删除「${w.word}」？`,
      confirmText: '删除',
      success: resolve,
      fail: () => resolve(null)
    })
  })
  if (!ok?.confirm) return
  try {
    await callFunction('word-manage', { action: 'delete', wordId: w._id })
    list.value = list.value.filter((x) => x._id !== w._id)
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.wd-page {
  display: flex;
  flex-direction: column;
  /* #ifdef H5 */
  height: calc(100vh - var(--window-top));
  /* #endif */
  /* #ifndef H5 */
  height: 100vh;
  /* #endif */
  background: var(--bg-page);
  color: var(--text-body);
}
.wd-page > z-paging {
  flex: 1 1 0;
  min-height: 0;
}
.wd-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28rpx 32rpx 12rpx;
}
.wd-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.wd-kicker {
  align-self: flex-start;
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: var(--accent);
  background: var(--bg-card);
  font-weight: var(--fw-title);
}
.wd-title {
  font-size: 40rpx;
}
.wd-sub {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.wd-add {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 28rpx;
  margin: 0;
  font-size: 24rpx;
}
.wd-add::after {
  border: none;
}
.wd-filters {
  display: flex;
  gap: 12rpx;
  padding: 12rpx 32rpx 16rpx;
}
.wd-seg {
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
}
.wd-seg.active {
  color: #0d110e;
  background: var(--accent);
  font-weight: var(--fw-title);
}
.wd-card {
  margin: 16rpx 32rpx;
  padding: 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.wd-card-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.wd-word {
  font-size: 30rpx;
  font-weight: var(--fw-title);
  flex: 1;
  word-break: break-all;
}
.wd-action {
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  font-weight: var(--fw-title);
  background: var(--bg-elevated);
}
.act-block {
  color: var(--danger);
}
.act-replace {
  color: var(--warning);
}
.act-flag {
  color: var(--secondary);
}
.wd-off {
  padding: 4rpx 14rpx;
  font-size: 20rpx;
  color: var(--text-tertiary);
  background: var(--bg-elevated);
}
.wd-replace {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
}
.wd-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}
.wd-btn {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 28rpx;
  margin: 0;
  font-size: 24rpx;
  background: transparent;
  color: var(--text-primary);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
}
.wd-btn::after {
  border: none;
}
.wd-btn-danger {
  color: var(--danger);
  border-color: var(--danger);
}
.wd-state {
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  align-items: center;
}
.wd-error {
  font-size: 24rpx;
  color: var(--danger);
}
.wd-retry {
  padding: 10rpx 30rpx;
  font-size: 24rpx;
}
</style>
