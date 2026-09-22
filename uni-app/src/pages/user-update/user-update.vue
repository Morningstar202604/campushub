<template>
  <view class="update-root">
    <view class="form-block sticker">
      <text class="block-label">昵称</text>
      <input v-model="form.nickname" class="input" placeholder="昵称（≤20字）" maxlength="20" />
      <text v-if="renameWarn" class="hint err">{{ renameWarn }}</text>
    </view>

    <view class="form-block sticker">
      <text class="block-label">头像</text>
      <view class="avatar-row">
        <image v-if="previewAvatar" class="avatar" :src="previewAvatar" mode="aspectFill" />
        <view v-else class="avatar avatar--ph"></view>
        <text class="avatar-change" @click="chooseAvatar">更换</text>
      </view>
    </view>

    <view class="form-block sticker">
      <text class="block-label">简介</text>
      <input v-model="form.bio" class="input" placeholder="一句话简介（≤100字）" maxlength="100" />
    </view>

    <view class="form-block sticker">
      <text class="block-label">学院 / 专业 / 年级</text>
      <input v-model="form.college" class="input" placeholder="学院（≤50字）" maxlength="50" />
      <input v-model="form.major" class="input" placeholder="专业（≤50字）" maxlength="50" />
      <input v-model="form.grade" class="input" placeholder="年级（≤20字）" maxlength="20" />
    </view>

    <view class="form-block sticker">
      <text class="block-label">性别</text>
      <view class="gender-row">
        <view v-for="g in genders" :key="g.value" class="gender-chip clip-tag" :class="{ active: form.gender === g.value }" @click="form.gender = g.value">
          <text>{{ g.label }}</text>
        </view>
      </view>
    </view>

    <view class="form-block sticker">
      <text class="block-label">标签</text>
      <input v-model="form.tagsText" class="input" placeholder="用逗号分隔，最多10个" />
    </view>

    <view class="submit-wrap">
      <button class="submit-btn sticker" :disabled="saving" @click="save">
        <text>{{ saving ? '保存中…' : '保存资料' }}</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { callFunction, uploadImage, fileIDToTempUrl } from '@/utils/api'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const genders = [
  { label: '保密', value: 0 },
  { label: '男', value: 1 },
  { label: '女', value: 2 }
]

const form = reactive({
  nickname: '',
  avatar: '',
  bio: '',
  college: '',
  major: '',
  grade: '',
  gender: 0 as number,
  tagsText: ''
})
const previewAvatar = ref('')
const saving = ref(false)
const renameWarn = ref('')

async function hydrate() {
  // 用 user store 里的当前用户资料回填
  const u: any = userStore.userInfo || {}
  form.nickname = u.nickname || ''
  form.avatar = u.avatar || ''
  form.bio = u.bio || ''
  form.college = u.college || ''
  form.major = u.major || ''
  form.grade = u.grade || ''
  form.gender = u.gender ?? 0
  form.tagsText = (u.tags || []).join('，')
  if (form.avatar) {
    previewAvatar.value = await fileIDToTempUrl(form.avatar).catch(() => form.avatar)
  }
}

async function chooseAvatar() {
  try {
    // @ts-ignore
    const r: any = await new Promise((resolve, reject) => {
      // @ts-ignore
      uni.chooseImage({ count: 1, success: resolve, fail: reject })
    })
    const path = r?.tempFilePaths?.[0]
    if (!path) return
    const fileID = await uploadImage(path, 'avatars')
    form.avatar = fileID
    previewAvatar.value = fileID
  } catch (e: any) {
    uni.showToast({ title: '头像上传失败', icon: 'none' })
  }
}

async function save() {
  // 本地前置校验：后端 nickname 非空（提供时）
  if (!form.nickname.trim()) {
    return uni.showToast({ title: '昵称不能为空', icon: 'none' })
  }
  saving.value = true
  renameWarn.value = ''
  try {
    const tags = form.tagsText
      ? form.tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 10)
      : []
    const res: any = await callFunction('user-update', {
      nickname: form.nickname.trim(),
      // 头像仅在已选（cloud:// fileID）时提交；后端要求必须是云存储文件，空串会被拒
      ...(form.avatar ? { avatar: form.avatar } : {}),
      bio: form.bio,
      college: form.college,
      major: form.major,
      grade: form.grade,
      gender: form.gender,
      tags
    })
    // 后端 user-update 返回 ok({ user })，是更新后的完整用户文档（已 strip openid）→ 直接覆盖本地登录态
    const updatedUser = res?.user as any
    if (updatedUser) {
      userStore.setUserInfo(
        userStore.userInfo ? ({ ...userStore.userInfo, ...updatedUser } as any) : updatedUser
      )
    } else {
      // 后端未回传 user 时兜底刷新本地登录态
      await userStore.refresh()
    }
    uni.showToast({ title: '资料已更新', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e: any) {
    const msg = e?.message || String(e)
    // 优先按后端 error code 分支（改名额度用尽），message 文案兜底
    if (e?.code === 'RENAME_LIMITED' || /改名卡|改名次数|RENAME_LIMITED/.test(msg)) {
      renameWarn.value = msg
      uni.showToast({ title: '改名需兑换改名卡（积分商城）', icon: 'none' })
    } else {
      uni.showToast({ title: msg, icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

onMounted(hydrate)
</script>

<style lang="scss">
.update-root { padding: 24rpx 32rpx 80rpx; }
.form-block {
  padding: 24rpx; margin-bottom: 20rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.block-label { display: block; font-size: 26rpx; font-weight: var(--fw-title); color: var(--text-primary); margin-bottom: 16rpx; }
.input {
  width: 100%; font-size: 28rpx; color: var(--text-primary);
  background: var(--bg-elevated); padding: 16rpx; border-radius: var(--radius-sharp);
  border: 1rpx solid var(--border); box-sizing: border-box; margin-bottom: 8rpx;
}
.hint.err { display: block; font-size: 22rpx; color: var(--danger); margin-top: 12rpx; }

.avatar-row { display: flex; align-items: center; gap: 24rpx; }
.avatar {
  width: 120rpx; height: 120rpx; border-radius: var(--radius-sharp); background: var(--bg-elevated);
  &--ph { background: var(--bg-elevated); }
}
.avatar-change { font-size: 24rpx; color: var(--accent); font-weight: var(--fw-title); }

.gender-row { display: flex; gap: 16rpx; }
.gender-chip {
  padding: 8rpx 24rpx; font-size: 24rpx; color: var(--text-secondary);
  background: var(--bg-elevated); border: 1rpx solid var(--border);
  &.active { color: #0D110E; background: var(--accent); font-weight: var(--fw-title); }
}

.submit-wrap { margin-top: 40rpx; }
.submit-btn {
  width: 100%; padding: 24rpx; background: var(--accent);
  color: #0D110E; font-size: 30rpx; font-weight: var(--fw-title);
  border: none; border-radius: var(--radius-sharp);
  &[disabled] { opacity: 0.6; }
}
</style>
