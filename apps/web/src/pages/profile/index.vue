<template>
  <div class="page">
    <van-nav-bar title="我的" fixed placeholder />

    <!-- 未登录 -->
    <div v-if="!auth.isLoggedIn" class="login-box">
      <div class="avatar-placeholder"><van-icon name="user-o" size="40" color="#c2c9d2" /></div>
      <div class="login-title">登录后开启校园社区</div>
      <van-button type="primary" round block @click="router.push('/login')">登录 / 注册</van-button>
    </div>

    <!-- 已登录 -->
    <template v-else>
      <div class="user-card">
        <van-image round width="56" height="56" :src="auth.profile?.avatar || fallbackAvatar" fit="cover" />
        <div class="user-info">
          <div class="user-name">{{ auth.profile?.nickname || '同学' }}</div>
          <div class="user-meta">
            <span>{{ auth.profile?.college || '未填写学校' }}</span> ·
            <span>{{ auth.profile?.major || '未填写专业' }}</span>
          </div>
        </div>
        <van-icon name="arrow" color="#c2c9d2" @click="router.push('/user-update')" />
      </div>

      <div class="stat-row">
        <div class="stat" @click="router.push('/checkin')">
          <div class="stat-num">{{ auth.profile?.checkin_streak ?? 0 }}</div>
          <div class="stat-label">连续签到</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ auth.profile?.points ?? 0 }}</div>
          <div class="stat-label">积分</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ auth.profile?.is_admin ? '管理员' : '同学' }}</div>
          <div class="stat-label">身份</div>
        </div>
      </div>

      <van-cell-group inset title="我的内容">
        <van-cell title="我的帖子" icon="notes-o" is-link @click="router.push('/my-list?tab=posts')" />
        <van-cell title="我的商品" icon="shopping-cart-o" is-link @click="router.push('/my-list?tab=products')" />
        <van-cell title="我的收藏" icon="star-o" is-link @click="router.push('/my-list?tab=collects')" />
      </van-cell-group>

      <van-cell-group inset title="更多">
        <van-cell title="校园指南" icon="bookmark-o" is-link @click="router.push('/guide')" />
        <van-cell title="签到打卡" icon="medal-o" is-link @click="router.push('/checkin')" />
        <van-cell title="编辑资料" icon="edit" is-link @click="router.push('/user-update')" />
        <van-cell title="意见反馈" icon="service-o" is-link @click="onFeedback" />
        <van-cell v-if="auth.profile?.is_admin" title="管理后台" icon="setting-o" is-link @click="onAdmin" />
        <van-cell title="退出登录" icon="revoke" is-link @click="onLogout" />
      </van-cell-group>
    </template>

    <!-- 意见反馈弹层 -->
    <van-dialog
      v-model:show="feedbackShow"
      title="意见反馈"
      show-cancel-button
      confirm-button-text="提交"
      :before-close="onFeedbackBeforeClose"
    >
      <div class="feedback-body">
        <van-field
          v-model="feedbackText"
          type="textarea"
          rows="4"
          maxlength="500"
          show-word-limit
          placeholder="请描述你遇到的问题或建议（500字内）"
        />
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showSuccessToast, showFailToast, showDialog } from 'vant'
import { useAuthStore } from '@/stores/auth'
import { submitFeedback } from '@/api/misc'

const router = useRouter()
const auth = useAuthStore()
const feedbackShow = ref(false)
const feedbackText = ref('')
const fallbackAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112"><rect width="112" height="112" rx="56" fill="#dbe4f0"/><text x="56" y="72" font-size="44" text-anchor="middle" fill="#8ba3c0">🙂</text></svg>')

async function onFeedback() {
  feedbackShow.value = true
}

async function onFeedbackBeforeClose(action: string) {
  if (action !== 'confirm') return true
  const content = feedbackText.value.trim()
  if (!content) {
    showFailToast('请先填写内容')
    return false
  }
  try {
    await submitFeedback(content)
    feedbackText.value = ''
    showSuccessToast('感谢反馈！')
    return true
  } catch (e: any) {
    showFailToast(e?.message || '提交失败')
    return false
  }
}

function onAdmin() {
  // 管理后台为独立站点，部署后填入地址
  showDialog({ title: '管理后台', message: '管理后台地址在部署文档 docs/ADMIN.md 中配置，当前版本需自行部署。', showCancelButton: false })
}

async function onLogout() {
  try {
    await showConfirmDialog({ title: '提示', message: '确定退出登录吗？' })
  } catch { return }
  await auth.logout()
  showSuccessToast('已退出')
}
</script>

<style scoped>
.login-box { padding: 80px 40px; text-align: center; }
.avatar-placeholder { width: 80px; height: 80px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.login-title { font-size: 16px; color: #66707f; margin-bottom: 24px; }

.user-card { display: flex; align-items: center; gap: 14px; background: #fff; margin: 12px; border-radius: 12px; padding: 18px; }
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 18px; font-weight: 700; }
.user-meta { font-size: 12px; color: #9aa3b2; margin-top: 4px; }

.stat-row { display: flex; background: #fff; margin: 0 12px 12px; border-radius: 12px; padding: 14px 0; }
.stat { flex: 1; text-align: center; cursor: pointer; }
.stat-num { font-size: 18px; font-weight: 700; color: #1c2330; }
.stat-label { font-size: 12px; color: #9aa3b2; margin-top: 2px; }
.feedback-body { padding: 12px 16px 20px; }
</style>
