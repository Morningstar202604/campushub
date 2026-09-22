<template>
  <view class="fb-page">
    <view class="fb-head">
      <text class="fb-kicker">FEEDBACK</text>
      <text class="fb-sub">你的建议会被认真读完</text>
    </view>

    <!-- 类型选择 -->
    <view class="fb-types">
      <view
        v-for="t in TYPES"
        :key="t.value"
        class="fb-type"
        :class="{ 'fb-type-on': form.type === t.value }"
        @click="form.type = t.value"
      >
        <text class="fb-type-label">{{ t.label }}</text>
      </view>
    </view>

    <!-- 内容 -->
    <view class="fb-body">
      <textarea
        class="fb-textarea"
        v-model="form.content"
        maxlength="500"
        placeholder="说说你遇到的问题、建议或想法（最多 500 字）"
        placeholder-class="fb-ph"
      />
      <view class="fb-count">{{ form.content.length }}/500</view>

      <view class="fb-contact-label">联系方式（选填）</view>
      <input
        class="fb-input"
        v-model="form.contact"
        maxlength="50"
        placeholder="微信 / 邮箱 / 手机号"
        placeholder-class="fb-ph"
      />
    </view>

    <!-- 提交 -->
    <button
      class="fb-submit"
      :class="{ 'fb-submit-off': !canSubmit }"
      :disabled="!canSubmit"
      @click="submit"
    >
      {{ busy ? '提交中…' : '提交反馈' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { callFunction } from '@/utils/api'

const TYPES = [
  { value: 'suggest', label: '建议' },
  { value: 'bug', label: 'Bug' },
  { value: 'other', label: '其他' }
] as const

const form = reactive({
  type: 'suggest' as string,
  content: '',
  contact: ''
})
const busy = ref(false)
const done = ref(false)

const canSubmit = computed(() => form.content.trim().length > 0 && !busy.value && !done.value)

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  try {
    // 后端 feedback-create 契约：{ content(≤500), contact?(≤50), type('suggest'|'bug'|'other') } → ok({message})
    const res: any = await callFunction('feedback-create', {
      content: form.content.trim(),
      contact: form.contact.trim(),
      type: form.type
    })
    done.value = true
    // 用后端返回的中文文案 toast，并返回上一页
    uni.showToast({ title: res?.message || '感谢反馈，我们已经收到', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败，请稍后重试', icon: 'none' })
  } finally {
    busy.value = false
  }
}
</script>

<style lang="scss" scoped>
.fb-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 60rpx;
  position: relative;
}

.fb-head {
  padding: 32rpx 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.fb-kicker {
  font-size: 22rpx;
  letter-spacing: 4rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.fb-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.fb-types {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 32rpx;
}
.fb-type {
  flex: 1;
  text-align: center;
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 20rpx 0;
}
.fb-type-on {
  border-color: var(--border);
  background: var(--bg-elevated);
}
.fb-type-label {
  font-size: 28rpx;
  font-weight: var(--fw-title);
  color: var(--text-body);
}
.fb-type-on .fb-type-label {
  color: var(--text-body);
}

.fb-body {
  padding: 16rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.fb-textarea {
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 24rpx;
  height: 320rpx;
  font-size: 28rpx;
  color: var(--text-body);
  line-height: 1.6;
  box-sizing: border-box;
}
.fb-count {
  text-align: right;
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.fb-contact-label {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 400;
}
.fb-input {
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 0 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 28rpx;
  color: var(--text-body);
}
.fb-ph {
  color: var(--text-tertiary);
  font-size: 26rpx;
}

.fb-submit {
  margin: 40rpx 32rpx 0;
  background: var(--accent);
  color: var(--bg-page);
  font-size: 30rpx;
  font-weight: var(--fw-title);
  border: none;
  height: 92rpx;
  line-height: 92rpx;
  box-shadow: 0 4rpx 0 rgba(0, 0, 0, 0.6);
}
.fb-submit-off {
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  box-shadow: none;
}
.fb-submit[disabled] {
  opacity: 0.7;
}
</style>
