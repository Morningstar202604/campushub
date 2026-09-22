<template>
  <view class="rp-page">
    <view class="rp-head">
      <text class="rp-kicker">REPORT</text>
      <text class="rp-sub">举报理由将进入人工审核队列</text>
    </view>

    <!-- 目标信息（从参数透传） -->
    <view v-if="targetLabel" class="rp-target">
      <text class="rp-target-label">TARGET</text>
      <text class="rp-target-value">{{ targetLabel }}</text>
    </view>

    <!-- 理由选择 -->
    <view class="rp-reasons">
      <view
        v-for="r in REASONS"
        :key="r"
        class="rp-reason"
        :class="{ 'rp-reason-on': form.reason === r }"
        @click="form.reason = r"
      >
        <text class="rp-reason-label">{{ r }}</text>
      </view>
    </view>

    <!-- 补充说明 -->
    <view class="rp-body">
      <textarea
        class="rp-textarea"
        v-model="form.description"
        maxlength="500"
        placeholder="补充说明（选填，最多 500 字）"
        placeholder-class="rp-ph"
      />
      <view class="rp-count">{{ form.description.length }}/500</view>
    </view>

    <button
      class="rp-submit"
      :class="{ 'rp-submit-off': !canSubmit }"
      :disabled="!canSubmit"
      @click="submit"
    >
      {{ busy ? '提交中…' : '提交举报' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'

const REASONS = [
  '广告/营销',
  '违法违规',
  '诈骗/虚假信息',
  '人身攻击',
  '隐私泄露',
  '内容质量差',
  '其他'
]

const form = reactive({
  reason: '',
  description: ''
})
const busy = ref(false)
const done = ref(false)

const targetId = ref('')
const targetType = ref<'post' | 'product' | 'comment'>('post')
const targetLabel = ref('')

const canSubmit = computed(() => Boolean(form.reason) && !busy.value && !done.value)

onLoad((opts) => {
  // onLoad 拿不到 id 时不能崩：提示并返回上一页
  const id = (opts && (opts.id || opts.targetId)) || ''
  targetId.value = String(id)
  const t = (opts && (opts.targetType || opts.type)) || 'post'
  targetType.value = t === 'product' || t === 'comment' ? t : 'post'
  targetLabel.value = opts && opts.title
    ? String(opts.title).slice(0, 30)
    : t === 'product'
      ? '商品'
      : t === 'comment'
        ? '评论'
        : '帖子'
  if (!targetId.value) {
    uni.showToast({ title: '缺少举报对象，请从内容页进入', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
  }
})

async function submit() {
  if (!targetId.value) {
    uni.showToast({ title: '缺少举报对象，请从内容页进入', icon: 'none' })
    return
  }
  if (!form.reason) {
    uni.showToast({ title: '请选择举报理由', icon: 'none' })
    return
  }
  if (busy.value) return
  busy.value = true
  try {
    // 后端 report 契约：{ targetId, targetType('post'|'product'|'comment'), reason(≤100), description?(≤500) }
    const res: any = await callFunction('report', {
      targetId: targetId.value,
      targetType: targetType.value,
      reason: form.reason,
      description: form.description.trim()
    })
    done.value = true
    uni.showToast({ title: res?.message || '举报已提交，我们会尽快处理', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e: any) {
    if (e?.code === 'ALREADY') {
      uni.showToast({ title: '您已举报过该内容，请等待处理', icon: 'none' })
    } else {
      uni.showToast({ title: e?.message || '提交失败，请稍后重试', icon: 'none' })
    }
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
.rp-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 60rpx;
  position: relative;
}

.rp-head {
  padding: 32rpx 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.rp-kicker {
  font-size: 22rpx;
  letter-spacing: 4rpx;
  color: var(--danger);
  font-weight: var(--fw-title);
}
.rp-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.rp-target {
  margin: 8rpx 32rpx 16rpx;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 20rpx 24rpx;
}
.rp-target-label {
  font-size: 18rpx;
  letter-spacing: 2rpx;
  color: var(--text-tertiary);
  font-weight: var(--fw-title);
}
.rp-target-value {
  display: block;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: var(--text-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rp-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 16rpx 32rpx;
}
.rp-reason {
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 18rpx 24rpx;
}
.rp-reason-on {
  border-color: var(--danger);
  background: var(--bg-deep);
}
.rp-reason-label {
  font-size: 26rpx;
  color: var(--text-body);
  font-weight: var(--fw-title);
}
.rp-reason-on .rp-reason-label {
  color: var(--danger);
}

.rp-body {
  padding: 16rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.rp-textarea {
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx;
  height: 240rpx;
  font-size: 28rpx;
  color: var(--text-body);
  line-height: 1.6;
  box-sizing: border-box;
}
.rp-count {
  text-align: right;
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.rp-ph {
  color: var(--text-tertiary);
  font-size: 26rpx;
}

.rp-submit {
  margin: 40rpx 32rpx 0;
  background: var(--danger);
  color: var(--bg-page);
  font-size: 30rpx;
  font-weight: var(--fw-title);
  border: none;
  height: 92rpx;
  line-height: 92rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.rp-submit-off {
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  box-shadow: none;
}
.rp-submit[disabled] {
  opacity: 0.7;
}
</style>
