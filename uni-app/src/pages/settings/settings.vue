<template>
  <view class="st-page">
    <!-- 账户 -->
    <view class="st-section">
      <text class="st-section-title">账户</text>
      <view class="st-card sticker">
        <view class="st-row press" @click="goProfile">
          <view class="st-avatar">
            <image v-if="me.avatar" class="st-avatar-img" :src="me.avatar" mode="aspectFill" />
            <text v-else class="st-avatar-ph">{{ (me.nickname || '?').slice(0, 1) }}</text>
          </view>
          <view class="st-row-main">
            <text class="st-row-label">{{ me.nickname || '未登录' }}</text>
            <text class="st-row-sub">{{ me.school || '点击完善资料' }}</text>
          </view>
          <text class="st-arrow">→</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row press" @click="goVerify">
          <text class="st-row-label">校园认证</text>
          <text class="st-row-value">{{ verifyLabel }}</text>
          <text class="st-arrow">→</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row press" @click="goBlocklist">
          <view class="st-row-main">
            <text class="st-row-label">黑名单</text>
            <text class="st-row-sub">被拉黑的人的内容不会出现在你的信息流</text>
          </view>
          <text class="st-arrow">→</text>
        </view>
        <!-- 管理员专属：治理与运营入口（role 是服务端权威字段，只做入口显隐） -->
        <template v-if="isAdmin">
          <view class="st-divider"></view>
          <view class="st-row press" @click="goDashboard">
            <view class="st-row-main">
              <text class="st-row-label">运营仪表盘</text>
              <text class="st-row-sub">待处理队列 / 规模 / 治理指标</text>
            </view>
            <text class="st-arrow">→</text>
          </view>
          <view class="st-divider"></view>
          <view class="st-row press" @click="goWords">
            <view class="st-row-main">
              <text class="st-row-label">敏感词库</text>
              <text class="st-row-sub">拒发 / 替换 / 送审三级词表</text>
            </view>
            <text class="st-arrow">→</text>
          </view>
          <view class="st-divider"></view>
          <view class="st-row press" @click="goRecycle">
            <view class="st-row-main">
              <text class="st-row-label">内容回收站</text>
              <text class="st-row-sub">恢复被删除的帖子 / 商品 / 评论</text>
            </view>
            <text class="st-arrow">→</text>
          </view>
        </template>
      </view>
    </view>

    <!-- 外观 -->
    <view class="st-section">
      <text class="st-section-title">外观</text>
      <view class="st-card sticker">
        <view class="st-row">
          <view class="st-row-main">
            <text class="st-row-label">主题</text>
            <text class="st-row-sub">深色为默认，浅色适合强光环境</text>
            <!-- #ifdef MP -->
            <text class="st-row-sub">小程序端导航栏与 tabBar 会跟随；页面内容仍为深色（WXSS 不支持属性选择器）</text>
            <!-- #endif -->
          </view>
        </view>
        <view class="st-seg">
          <view
            v-for="t in themes"
            :key="t.value"
            class="st-seg-item press"
            :class="{ 'st-seg-on': theme === t.value }"
            @click="setTheme(t.value)"
          >
            <text>{{ t.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 通知 -->
    <view class="st-section">
      <text class="st-section-title">通知</text>
      <view class="st-card sticker">
        <view class="st-row">
          <view class="st-row-main">
            <text class="st-row-label">未读消息</text>
            <text class="st-row-sub">有新评论、点赞、关注时提醒</text>
          </view>
          <text class="st-row-value accent-num">{{ unread }}</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row press" @click="goNotification">
          <text class="st-row-label">查看通知</text>
          <text class="st-arrow">→</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row press" @click="goMessages">
          <view class="st-row-main">
            <text class="st-row-label">查看私信</text>
            <text class="st-row-sub">与同学的私信会话列表</text>
          </view>
          <text class="st-arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 数据与存储 -->
    <view class="st-section">
      <text class="st-section-title">数据与存储</text>
      <view class="st-card sticker">
        <view class="st-row press" @click="clearCache">
          <view class="st-row-main">
            <text class="st-row-label">清理缓存</text>
            <text class="st-row-sub">仅清理临时图片与列表缓存，不影响账号</text>
          </view>
          <text class="st-row-value">{{ cacheSize }}</text>
          <text class="st-arrow">→</text>
        </view>
        <view v-if="isDemo" class="st-divider"></view>
        <view v-if="isDemo" class="st-row press" @click="resetDemo">
          <view class="st-row-main">
            <text class="st-row-label">重置演示数据</text>
            <text class="st-row-sub">恢复为初始种子内容</text>
          </view>
          <text class="st-arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 关于与协议 -->
    <view class="st-section">
      <text class="st-section-title">关于</text>
      <view class="st-card sticker">
        <view class="st-row press" @click="openDoc('agreement')">
          <text class="st-row-label">用户协议</text>
          <text class="st-arrow">→</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row press" @click="openDoc('privacy')">
          <text class="st-row-label">隐私政策</text>
          <text class="st-arrow">→</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row">
          <text class="st-row-label">版本</text>
          <text class="st-row-value tabular-nums">{{ version }}</text>
        </view>
        <view class="st-divider"></view>
        <view class="st-row press" @click="goFeedback">
          <text class="st-row-label">意见反馈</text>
          <text class="st-arrow">→</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <button class="st-logout press" @click="logout">退出登录</button>

    <text class="st-foot">CampusHub · 墨荧 Acid Campus</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useSchoolStore } from '@/stores/school'
import { useTheme } from '@/composables/use-theme'
import { shouldUseDemo } from '@/utils/api'
import { resetDemoData } from '@/utils/demo-data'

const userStore = useUserStore()
const schoolStore = useSchoolStore()
const { theme, setTheme } = useTheme()

const me = computed(() => (userStore.userInfo || {}) as any)
const isAdmin = computed(() => userStore.userInfo?.role === 'admin')
const unread = computed(() => userStore.unreadCount || 0)
const isDemo = computed(() => shouldUseDemo())
const version = ref('1.0.0')

const themes = [
  { label: '深色（默认）', value: 'dark' as const },
  { label: '浅色', value: 'light' as const }
]

const verifyLabel = computed(() => {
  const s = (me.value as any).campusVerifyStatus || 'none'
  const map: Record<string, string> = {
    none: '未认证',
    pending: '审核中',
    approved: '已认证',
    rejected: '已驳回'
  }
  return map[s] || '未认证'
})

const cacheSize = ref('计算中…')

onMounted(async () => {
  try {
    const info = uni.getStorageInfoSync()
    cacheSize.value = `${info.currentSize || 0} KB`
    // 版本号从 manifest 读不到运行时值，用 uni.getSystemInfoSync 的 appVersion 兜底
    const sys: any = uni.getSystemInfoSync()
    if (sys.appVersion) version.value = sys.appVersion
  } catch {
    cacheSize.value = '未知'
  }
  if (userStore.isLoggedIn) userStore.refreshUnreadCount()
})

function goProfile() {
  const id = userStore.userInfo?._id
  uni.navigateTo({
    url: id ? `/pages/user-profile/user-profile?id=${id}` : '/pages/user-update/user-update'
  })
}
function goVerify() {
  uni.navigateTo({ url: '/pages/verify/verify' })
}
function goBlocklist() {
  uni.navigateTo({ url: '/pages/block-list/block-list' })
}
function goMessages() {
  uni.navigateTo({ url: '/pages/message-list/message-list' })
}
function goDashboard() {
  uni.navigateTo({ url: '/pages/admin/dashboard' })
}
function goWords() {
  uni.navigateTo({ url: '/pages/admin/words' })
}
function goRecycle() {
  uni.navigateTo({ url: '/pages/admin/recycle' })
}
function goNotification() {
  uni.navigateTo({ url: '/pages/notification/notification' })
}
function goFeedback() {
  uni.navigateTo({ url: '/pages/feedback/feedback' })
}

function openDoc(kind: 'agreement' | 'privacy') {
  uni.navigateTo({ url: `/pages/legal/legal?type=${kind}` })
}

/** 清理缓存：只清临时项，保留登录态与演示数据 */
async function clearCache() {
  const ok: any = await new Promise((resolve) => {
    uni.showModal({
      title: '清理缓存',
      content: '将清理临时图片缓存，不影响你的账号与内容。',
      confirmText: '清理',
      success: resolve,
      fail: () => resolve(null)
    })
  })
  if (!ok?.confirm) return
  try {
    const info = uni.getStorageInfoSync()
    const keep = new Set(['campushub.user', 'campushub.demo.v1', 'campushub.searchHistory'])
    for (const k of info.keys || []) {
      if (!keep.has(k) && !k.startsWith('campushub.')) {
        // 只删非业务 key，避免误删用户配置
        uni.removeStorageSync(k)
      }
    }
    uni.showToast({ title: '已清理', icon: 'success' })
    const after = uni.getStorageInfoSync()
    cacheSize.value = `${after.currentSize || 0} KB`
  } catch (e: any) {
    uni.showToast({ title: e?.message || '清理失败', icon: 'none' })
  }
}

async function resetDemo() {
  const ok: any = await new Promise((resolve) => {
    uni.showModal({
      title: '重置演示数据',
      content: '将恢复为初始种子内容，你新增的演示帖会被清除。',
      confirmText: '重置',
      success: resolve,
      fail: () => resolve(null)
    })
  })
  if (!ok?.confirm) return
  resetDemoData()
  uni.showToast({ title: '已重置', icon: 'success' })
  setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 600)
}

async function logout() {
  const ok: any = await new Promise((resolve) => {
    uni.showModal({
      title: '退出登录',
      content: '退出后需要重新进入才能继续使用。',
      confirmText: '退出',
      success: resolve,
      fail: () => resolve(null)
    })
  })
  if (!ok?.confirm) return
  userStore.clear()
  uni.showToast({ title: '已退出', icon: 'success' })
  setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 600)
}
</script>

<style lang="scss" scoped>
.st-page {
  min-height: 100vh;
  /* #ifdef H5 */
  min-height: calc(100vh - var(--window-top));
  /* #endif */
  background: var(--bg-page);
  padding: 8rpx 0 60rpx;
}

.st-section {
  margin: 28rpx 32rpx 0;
}
.st-section-title {
  display: block;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: var(--text-tertiary);
  font-weight: var(--fw-title);
  margin: 0 0 12rpx 8rpx;
  text-transform: uppercase;
}

.st-card {
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  overflow: hidden;
}
.st-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx 24rpx;
}
.st-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.st-row-label {
  font-size: 28rpx;
  color: var(--text-primary);
}
.st-row-sub {
  font-size: 22rpx;
  color: var(--text-tertiary);
  line-height: 1.4;
}
.st-row-value {
  font-size: 24rpx;
  color: var(--text-secondary);
}
.st-arrow {
  font-size: 26rpx;
  color: var(--text-tertiary);
}
.st-divider {
  height: 1rpx;
  background: var(--border);
  margin-left: 24rpx;
}

.st-avatar {
  width: 80rpx;
  height: 80rpx;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  border-radius: var(--radius-sharp);
  overflow: hidden;
}
.st-avatar-img {
  width: 80rpx;
  height: 80rpx;
}
.st-avatar-ph {
  font-size: 32rpx;
  font-weight: var(--fw-title);
  color: var(--accent);
}

.st-seg {
  display: flex;
  gap: 12rpx;
  padding: 0 24rpx 24rpx;
}
.st-seg-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border: 2rpx solid var(--border);
  border-radius: var(--radius-sharp);
  font-size: 26rpx;
  color: var(--text-secondary);
}
.st-seg-on {
  background: var(--accent);
  border-color: var(--accent);
  color: #0d110e;
  font-weight: var(--fw-title);
}

.st-logout {
  margin: 48rpx 32rpx 0;
  height: 92rpx;
  line-height: 92rpx;
  background: transparent;
  color: var(--danger);
  border: 2rpx solid var(--danger);
  border-radius: var(--radius-sharp);
  font-size: 28rpx;
  font-weight: var(--fw-title);
}
.st-foot {
  display: block;
  text-align: center;
  margin-top: 40rpx;
  font-size: 20rpx;
  color: var(--text-tertiary);
  letter-spacing: 2rpx;
}
</style>
