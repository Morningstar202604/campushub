<template>
  <view class="vf-page">
    <view class="vf-head">
      <text class="vf-kicker">CAMPUS VERIFY</text>
      <text class="vf-sub">提交学生证 / 校园卡照片，管理员人工审核</text>
    </view>

    <!-- 状态：已通过 -->
    <view v-if="state === 'approved'" class="vf-status sticker">
      <text class="vf-status-kicker">VERIFIED</text>
      <text class="vf-status-title">已完成校园认证</text>
      <text class="vf-status-sub">你的帖子与商品会显示「已认证」标识</text>
    </view>

    <!-- 状态：审核中 -->
    <view v-else-if="state === 'pending'" class="vf-status sticker">
      <text class="vf-status-kicker">PENDING</text>
      <text class="vf-status-title">认证资料审核中</text>
      <text class="vf-status-sub">管理员审核通过后会自动生效，请耐心等待</text>
      <text v-if="submittedAt" class="vf-status-time tabular-nums">提交于 {{ submittedAt }}</text>
    </view>

    <!-- 状态查询失败：不能只留一个空页头（用户会以为页面坏了） -->
    <view v-else-if="state === 'unknown'" class="vf-status vf-status--reject sticker">
      <text class="vf-status-kicker">UNAVAILABLE</text>
      <text class="vf-status-title">认证状态读取失败</text>
      <text class="vf-status-sub">{{ statusError || '请检查网络或稍后重试' }}</text>
      <text class="vf-retry press" @click="loadStatus">重试</text>
    </view>

    <!-- 状态：被驳回 -->
    <view v-else-if="state === 'rejected'" class="vf-status vf-status--reject sticker">
      <text class="vf-status-kicker">REJECTED</text>
      <text class="vf-status-title">上次认证未通过</text>
      <text v-if="rejectReason" class="vf-status-sub">原因：{{ rejectReason }}</text>
      <text class="vf-status-sub">可修改资料后重新提交</text>
    </view>

    <!-- 表单：未认证 / 被驳回 -->
    <template v-if="state === 'none' || state === 'rejected'">
      <view class="vf-form">
        <view class="vf-block">
          <text class="vf-label">学校 <text class="vf-req">*</text></text>
          <input
            v-model="school"
            class="vf-input"
            maxlength="50"
            placeholder="学校全称，如：某某大学"
            placeholder-class="vf-ph"
          />
        </view>

        <view class="vf-block">
          <text class="vf-label">学号 <text class="vf-req">*</text></text>
          <input
            v-model="studentId"
            class="vf-input"
            maxlength="20"
            placeholder="4~20 位字母或数字"
            placeholder-class="vf-ph"
          />
        </view>

        <view class="vf-block">
          <text class="vf-label">证件照片 <text class="vf-req">*</text></text>
          <text class="vf-hint">学生证 / 校园卡正面，需能看清姓名与学号；仅用于人工审核</text>
          <view v-if="imageFileID" class="vf-preview">
            <image :src="imagePreview" mode="aspectFill" class="vf-preview-img" @click="preview" />
            <text class="vf-preview-del press" @click="removeImage">删除</text>
          </view>
          <view v-else class="vf-upload press" @click="chooseImage">
            <text class="vf-upload-plus">+</text>
            <text class="vf-upload-label">上传证件照</text>
          </view>
        </view>
      </view>

      <button
        class="vf-submit press"
        :class="{ 'vf-submit-off': !canSubmit }"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ busy ? '提交中…' : submittingText }}
      </button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, uploadImage, fileIDToTempUrl, shouldUseDemo } from '@/utils/api'

const state = ref<'none' | 'pending' | 'approved' | 'rejected' | 'unknown'>('unknown')
const statusError = ref('')
const rejectReason = ref('')
const submittedAt = ref('')
const school = ref('')
const studentId = ref('')
const imageFileID = ref('')
const imagePreview = ref('')
const busy = ref(false)

const submittingText = computed(() => (state.value === 'rejected' ? '重新提交认证' : '提交认证'))
/** 演示模式（未接云环境）：没有云存储可上传，允许免照片走完流程 */
const demoMode = computed(() => shouldUseDemo())

const canSubmit = computed(
  () =>
    !busy.value &&
    school.value.trim().length > 0 &&
    /^[A-Za-z0-9]{4,20}$/.test(studentId.value.trim()) &&
    (!!imageFileID.value || demoMode.value)
)

function fmtTime(d: any): string {
  if (!d) return ''
  const t = new Date(d)
  if (isNaN(t.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
}

async function loadStatus() {
  statusError.value = ''
  try {
    // 后端契约：verify { action: 'status' } → { campusVerified, status: none|pending|approved|rejected, request }
    const res: any = await callFunction('verify', { action: 'status' })
    if (res?.campusVerified || res?.status === 'approved') {
      state.value = 'approved'
    } else if (res?.status === 'pending') {
      state.value = 'pending'
    } else if (res?.status === 'rejected') {
      state.value = 'rejected'
    } else {
      state.value = 'none'
    }
    rejectReason.value = res?.request?.rejectReason || ''
    submittedAt.value = fmtTime(res?.request?.createdAt)
    // 回填上次填写的学校，减少重填成本
    if (res?.request?.school) school.value = String(res.request.school)
  } catch (e: any) {
    // 未登录/网络失败：保持 unknown，给出可重试的提示而不是假装「未认证」
    state.value = 'unknown'
    statusError.value = e?.message || ''
    uni.showToast({ title: e?.message || '状态查询失败', icon: 'none' })
  }
}

async function chooseImage() {
  try {
    const res: any = await new Promise((resolve, reject) => {
      // #ifdef MP
      // @ts-ignore
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        success: resolve,
        fail: reject
      })
      // #endif
      // #ifndef MP
      uni.chooseImage({ count: 1, sizeType: ['compressed'], success: resolve, fail: reject })
      // #endif
    })
    const path = res?.tempFiles?.[0]?.tempFilePath || res?.tempFilePaths?.[0]
    if (!path) return
    uni.showLoading({ title: '上传中' })
    // 上传前会压到审核上限 1MB 以内；证件照不加方向后缀，保持原图可读
    const fileID = await uploadImage(path, 'campushub/verify')
    imageFileID.value = fileID
    imagePreview.value = await fileIDToTempUrl(fileID).catch(() => path)
  } catch (e: any) {
    // 用户取消选择不算错误
    if (!/cancel/i.test(String(e?.errMsg || e?.message || ''))) {
      uni.showToast({ title: e?.message || '上传失败', icon: 'none' })
    }
  } finally {
    uni.hideLoading()
  }
}

function removeImage() {
  imageFileID.value = ''
  imagePreview.value = ''
}

function preview() {
  if (!imagePreview.value) return
  // @ts-ignore
  uni.previewImage({ urls: [imagePreview.value], current: imagePreview.value })
}

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  try {
    // 后端契约：verify { action: 'submit', school, studentId, imageFileID } → ok({ requestId, message })
    const res: any = await callFunction('verify', {
      action: 'submit',
      school: school.value.trim(),
      studentId: studentId.value.trim(),
      imageFileID: imageFileID.value
    })
    uni.showToast({ title: res?.message || '已提交，等待管理员审核', icon: 'none' })
    // 按真实结果回填：演示模式提交即通过，真实环境提交后是 pending
    state.value = res?.campusVerified ? 'approved' : 'pending'
    submittedAt.value = fmtTime(new Date())
    removeImage()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败，请稍后重试', icon: 'none' })
  } finally {
    busy.value = false
  }
}

// 用 uni-app 页面生命周期 onLoad（与全站其他页面一致）；
// onMounted 在本页实测未触发，页面会一直停在初始 state（空白）。
onLoad(() => {
  loadStatus()
})
</script>

<style lang="scss" scoped>
.vf-page {
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

.vf-head {
  padding: 32rpx 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.vf-kicker {
  font-size: 22rpx;
  letter-spacing: 4rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.vf-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.vf-status {
  margin: 16rpx 32rpx;
  padding: 40rpx 32rpx;
  background: var(--bg-card);
  border: 2rpx solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.vf-status-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--accent);
  font-weight: var(--fw-title);
}
.vf-status--reject .vf-status-kicker {
  color: var(--destructive, #ff6b6b);
}
.vf-status-title {
  font-size: 34rpx;
  font-weight: var(--fw-title);
  color: var(--text-primary);
}
.vf-status-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.6;
}
.vf-status-time {
  font-size: 22rpx;
  color: var(--text-tertiary);
}
.vf-retry {
  align-self: flex-start;
  margin-top: 8rpx;
  padding: 8rpx 32rpx;
  font-size: 24rpx;
  color: var(--text-primary);
  border: 2rpx solid var(--border);
}

.vf-form {
  padding: 8rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}
.vf-block {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.vf-label {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.vf-req {
  color: var(--accent);
}
.vf-hint {
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.5;
}
.vf-input {
  border: 3rpx solid var(--border);
  background: var(--bg-deep);
  padding: 0 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 28rpx;
  color: var(--text-body);
}
.vf-ph {
  color: var(--text-tertiary);
  font-size: 26rpx;
}

.vf-upload {
  height: 240rpx;
  border: 3rpx dashed var(--border);
  background: var(--bg-deep);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.vf-upload-plus {
  font-size: 56rpx;
  color: var(--text-tertiary);
  line-height: 1;
}
.vf-upload-label {
  font-size: 24rpx;
  color: var(--text-tertiary);
}

.vf-preview {
  position: relative;
  width: 320rpx;
  height: 320rpx;
}
.vf-preview-img {
  width: 320rpx;
  height: 320rpx;
  background: var(--bg-elevated);
}
.vf-preview-del {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 6rpx 20rpx;
  font-size: 22rpx;
  color: var(--bg-page);
  background: rgba(0, 0, 0, 0.68);
}

.vf-submit {
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
.vf-submit-off {
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  box-shadow: none;
}
.vf-submit[disabled] {
  opacity: 0.7;
}
</style>
