<template>
  <div class="login-page">
    <div class="logo-area">
      <div class="logo">🏫</div>
      <div class="logo-title">{{ appStore.siteName }}</div>
      <div class="logo-sub">同学自己的交流社区</div>
    </div>

    <van-tabs v-model:active="mode" centered>
      <van-tab title="登录" name="login" />
      <van-tab title="注册" name="register" />
    </van-tabs>

    <van-form @submit="onSubmit" class="form">
      <van-cell-group inset>
        <van-field v-model="email" name="email" type="email" label="邮箱" placeholder="请输入邮箱" :rules="[{ required: true, message: '请输入邮箱' }]" />
        <van-field v-model="password" name="password" type="password" label="密码" placeholder="至少 6 位" :rules="[{ required: true, message: '请输入密码' }]" />
        <van-field v-if="mode === 'register'" v-model="nickname" label="昵称" placeholder="给自己起个名字" />
      </van-cell-group>

      <div style="padding: 16px 12px">
        <van-button type="primary" block round native-type="submit" :loading="submitting">
          {{ mode === 'login' ? '登录' : '注册并登录' }}
        </van-button>
      </div>
    </van-form>

    <div class="tip">登录即代表同意友善发言，共同维护社区环境</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showSuccessToast, showFailToast } from 'vant'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const auth = useAuthStore()
const appStore = useAppStore()
const route = useRoute()
const router = useRouter()

const mode = ref('login')
const email = ref('')
const password = ref('')
const nickname = ref('')
const submitting = ref(false)

async function onSubmit() {
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(email.value.trim(), password.value)
    } else {
      await auth.register(email.value.trim(), password.value, nickname.value.trim() || '同学')
    }
    showSuccessToast(mode.value === 'login' ? '欢迎回来' : '注册成功')
    const redirect = String(route.query.redirect || '/')
    setTimeout(() => router.replace(redirect), 600)
  } catch (e: any) {
    showFailToast(e?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login-page { min-height: 100vh; background: #fff; }
.logo-area { text-align: center; padding: 60px 0 32px; }
.logo { font-size: 56px; }
.logo-title { font-size: 22px; font-weight: 800; margin-top: 8px; }
.logo-sub { font-size: 13px; color: #9aa3b2; margin-top: 6px; }
.form { margin-top: 12px; }
.tip { text-align: center; font-size: 12px; color: #c2c9d2; padding: 20px 0; }
</style>
