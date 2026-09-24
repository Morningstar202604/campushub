<template>
  <div class="page">
    <van-nav-bar title="编辑资料" fixed placeholder left-arrow @click-left="router.back()" />

    <van-form @submit="onSave" class="form">
      <van-cell-group inset>
        <van-field label="头像">
          <template #input>
            <van-uploader v-model="avatarFiles" :max-count="1" :after-read="onAvatar" />
          </template>
        </van-field>
        <van-field v-model="form.nickname" label="昵称" maxlength="20" placeholder="给自己起个名字" />
        <van-field v-model="form.college" label="学校" maxlength="30" placeholder="所在学校" />
        <van-field v-model="form.major" label="专业" maxlength="30" placeholder="专业 / 学院" />
        <van-field v-model="form.grade" label="年级" maxlength="10" placeholder="如：2025级" />
        <van-field label="性别">
          <template #input>
            <select v-model="form.gender" class="plain-select">
              <option :value="0">保密</option>
              <option :value="1">男</option>
              <option :value="2">女</option>
            </select>
          </template>
        </van-field>
        <van-field v-model="form.bio" label="简介" type="textarea" rows="3" maxlength="100" placeholder="一句话介绍自己" show-word-limit />
      </van-cell-group>

      <div style="padding: 16px 12px">
        <van-button type="primary" block round native-type="submit" :loading="saving">保存</van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useAuthStore } from '@/stores/auth'
import { uploadImages, ensureBucket } from '@/lib/upload'

const router = useRouter()
const auth = useAuthStore()

const form = ref({ nickname: '', college: '', major: '', grade: '', gender: 0, bio: '' })
const avatarFiles = ref<{ file: File }[]>([])
const saving = ref(false)

onMounted(() => {
  const p = auth.profile
  if (!p) return
  form.value = { nickname: p.nickname, college: p.college, major: p.major, grade: p.grade, gender: p.gender, bio: p.bio }
})

async function onAvatar(item: any) {
  try {
    await ensureBucket()
    const urls = await uploadImages([item.file], 'avatar')
    await auth.updateProfile({ avatar: urls[0] })
    showSuccessToast('头像已更新')
  } catch (e: any) {
    showFailToast(e?.message || '头像上传失败')
  }
}

async function onSave() {
  if (!form.value.nickname.trim()) { showFailToast('昵称不能为空'); return }
  saving.value = true
  try {
    await auth.updateProfile({ ...form.value, nickname: form.value.nickname.trim() })
    showSuccessToast('保存成功')
    setTimeout(() => router.back(), 600)
  } catch (e: any) {
    showFailToast(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form { margin-top: 8px; }
.plain-select { border: none; outline: none; background: transparent; font-size: 14px; color: #1c2330; width: 100%; }
</style>
