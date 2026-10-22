<template>
  <view class="adm-page">
    <!-- 顶栏：标题 + 姊妹页入口（公告 / 类目） -->
    <view class="adm-top">
      <view class="adm-heading">
        <text class="adm-kicker clip-tag">ADMIN CONSOLE</text>
        <text class="adm-sub">举报 / 用户 / 认证 / 反馈 / 日志</text>
      </view>
      <view class="adm-links">
        <button class="btn-ghost adm-link press" @click="go('/pages/admin/announcements')">
          公告
        </button>
        <button class="btn-ghost adm-link press" @click="go('/pages/admin/categories')">
          类目
        </button>
      </view>
    </view>

    <!-- Tab 分区（my-list 模式） -->
    <view class="tab-row">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="adm-tab clip-tag press"
        :class="{ active: t.value === tab }"
        @click="switchTab(t.value)"
      >
        <text>{{ t.label }}</text>
      </view>
    </view>

    <!-- 用户管理：昵称搜索 -->
    <view v-if="tab === 'list-users'" class="adm-search">
      <input
        v-model="keyword"
        class="adm-input"
        :maxlength="20"
        placeholder="按昵称搜索"
        confirm-type="search"
        @confirm="reload"
      />
      <button class="btn-ghost adm-search-btn press" @click="reload">搜索</button>
    </view>

    <!-- 认证审核：状态筛选 -->
    <view v-if="tab === 'list-verifies'" class="seg-row">
      <view
        v-for="s in verifySegs"
        :key="s.value"
        class="seg clip-tag press"
        :class="{ active: verifyStatus === s.value }"
        @click="switchVerifyStatus(s.value)"
      >
        <text>{{ s.label }}</text>
      </view>
    </view>

    <!-- z-paging：五 tab 共用一个列表容器，切 tab 时 reload（notification 模式） -->
    <z-paging
      ref="pagingRef"
      v-model="list"
      :auto="isAdmin"
      :fixed="false"
      :default-page-size="20"
      safe-area-inset-bottom
      @query="queryList"
    >
      <!-- 错误态 -->
      <view v-if="error" class="adm-state">
        <view class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">ERROR</text>
          <text class="empty-title">{{ error }}</text>
        </view>
        <button class="adm-retry press" @click="reload">重试</button>
      </view>

      <!-- ① 举报审核：list-reports + resolve / delete -->
      <view v-if="!error && tab === 'list-reports'" class="adm-list">
        <view v-for="r in list" :key="r.reportId" class="card">
          <view class="card-head">
            <text class="badge badge-danger">{{ typeLabel(r.targetType) }}举报</text>
            <text class="time tabular-nums">{{ fmt(r.createdAt) }}</text>
          </view>
          <text class="card-reason">理由：{{ r.reason || '未填写' }}</text>
          <text v-if="r.description" class="card-desc">说明：{{ r.description }}</text>
          <text class="card-snippet">
            内容：{{ r.target && r.target.snippet ? r.target.snippet : '(已删除)' }}
          </text>
          <view class="card-actions">
            <button class="act act-accent press" @click.stop="goTarget(r)">查看</button>
            <button class="act act-danger press" @click.stop="onDeleteTarget(r)">删除内容</button>
            <button class="act act-ghost press" @click.stop="onResolve(r)">忽略</button>
          </view>
        </view>
      </view>

      <!-- ② 用户管理：list-users + ban / unban -->
      <view v-if="!error && tab === 'list-users'" class="adm-list">
        <view v-for="u in list" :key="u._id" class="card">
          <view class="card-head">
            <text class="card-title title-900">{{ u.nickname || '(未设置昵称)' }}</text>
            <text class="badge" :class="u.verifyStatus === 'banned' ? 'badge-danger' : 'badge-ok'">
              {{ u.verifyStatus === 'banned' ? '已封禁' : '正常' }}
            </text>
          </view>
          <text class="card-meta">
            {{ u.school || '未填学校' }} · 帖 {{ u.postCount ?? 0 }} · 物 {{ u.productCount ?? 0 }}
          </text>
          <view class="card-actions">
            <button class="act act-accent press" @click.stop="goUser(u)">主页</button>
            <button
              v-if="u.verifyStatus !== 'banned'"
              class="act act-danger press"
              @click.stop="onBan(u)"
            >
              封禁
            </button>
            <button v-else class="act act-ok press" @click.stop="onUnban(u)">解封</button>
          </view>
        </view>
      </view>

      <!-- ③ 认证审核：list-verifies + verify-review -->
      <view v-if="!error && tab === 'list-verifies'" class="adm-list">
        <view v-for="v in list" :key="v._id" class="card">
          <view class="card-head">
            <text class="card-title title-900"
              >{{ v.school || '未知学校' }} · {{ v.studentId || '-' }}</text
            >
            <text class="badge" :class="verifyBadgeClass(v.status)">{{
              verifyLabel(v.status)
            }}</text>
          </view>
          <image
            v-if="v._img"
            :src="v._img"
            class="verify-img"
            mode="aspectFill"
            @click.stop="preview(v._img)"
          />
          <text v-else class="card-meta">证件图加载中或缺失</text>
          <text v-if="v.status === 'rejected'" class="card-reply"
            >驳回理由：{{ v.rejectReason || '-' }}</text
          >
          <view v-if="v.status === 'pending'" class="card-actions">
            <button class="act act-ok press" @click.stop="onVerifyReview(v, true)">通过</button>
            <button class="act act-danger press" @click.stop="onVerifyReview(v, false)">
              驳回
            </button>
          </view>
        </view>
      </view>

      <!-- ④ 反馈处理：list-feedbacks + resolve-feedback -->
      <view v-if="!error && tab === 'list-feedbacks'" class="adm-list">
        <view v-for="f in list" :key="f._id" class="card">
          <view class="card-head">
            <text class="badge">{{ fbTypeLabel(f.type) }}</text>
            <text class="time tabular-nums">{{ fmt(f.createdAt) }}</text>
          </view>
          <text class="card-body-text">{{ f.content }}</text>
          <text v-if="f.contact" class="card-meta">联系方式：{{ f.contact }}</text>
          <text v-if="f.status === 'resolved'" class="card-reply"
            >已回复：{{ f.adminReply || '-' }}</text
          >
          <view v-if="f.status !== 'resolved'" class="card-actions">
            <button class="act act-ok press" @click.stop="onResolveFeedback(f)">回复并处理</button>
          </view>
        </view>
      </view>

      <!-- ⑤ 审计日志：list-logs 只读 -->
      <view v-if="!error && tab === 'list-logs'" class="adm-list">
        <view v-for="l in list" :key="l._id" class="card log-card">
          <view class="card-head">
            <text class="badge">{{ logLabel(l.action) }}</text>
            <text class="time tabular-nums">{{ fmt(l.createdAt) }}</text>
          </view>
          <text class="card-meta">{{ logDetail(l) }}</text>
        </view>
      </view>

      <!-- ⑥ 内容运营：pin/unpin/essence/unessence/delete
           后端这 5 个动作早就实现了，但一直没有前端入口，加精数据写了没人能看见 -->
      <view v-if="!error && tab === 'list-posts'" class="adm-list">
        <view v-for="p in list" :key="p._id" class="card">
          <view class="card-head">
            <text class="badge">{{ p.isPinned ? '置顶' : p.isEssence ? '精华' : '普通' }}</text>
            <text class="time tabular-nums">{{ fmt(p.createdAt) }}</text>
          </view>
          <text class="card-title">{{ p.title || p.content }}</text>
          <text class="card-meta"
            >{{ p.userNickname }} · 赞 {{ p.likeCount || 0 }} · 评 {{ p.commentCount || 0 }}</text
          >
          <view class="act-row">
            <button class="act" @click.stop="onPin(p)">
              {{ p.isPinned ? '取消置顶' : '置顶' }}
            </button>
            <button class="act" @click.stop="onEssence(p)">
              {{ p.isEssence ? '取消精华' : '加精' }}
            </button>
            <button class="act act-danger" @click.stop="onDeleteContent(p)">删除</button>
          </view>
        </view>
      </view>

      <template #empty="{ isLoadFailed }">
        <view v-if="!isLoadFailed" class="empty-state">
          <view class="empty-shape"></view>
          <text class="empty-kicker">{{ emptyMeta[0] }}</text>
          <text class="empty-title">{{ emptyMeta[1] }}</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction, fileIDToTempUrl } from '@/utils/api'
import { ensureAdmin } from '@/composables/use-admin-guard'

/**
 * 管理台主页：admin 云函数 16 个 action 中，pin / unpin / essence / unessence（内容运营动作）
 * 与 check（内部校验）共 5 个暂无前端入口 —— 前端当前接入其余 11 个：五个 tab 的
 * list-reports / list-users / list-verifies / list-feedbacks / list-logs 加上
 * resolve / delete / ban / unban / verify-review / resolve-feedback。
 * 置顶/加精等运营动作的后端能力已就绪，入口留待后续迭代。
 *
 * 结构：五个 tab 共用一个 z-paging（切 tab 即 reload），
 * 渲染分支按 tab 切换，避免 5 个 z-paging 实例的内存开销。
 * 守卫：ensureAdmin()（先等一次登录态刷新再判定 role；服务端 checkAdmin 本就强制，
 * 这里只做体验层拦截）。
 */

const isAdmin = ref(false)

onLoad(async () => {
  // role 是服务端权威字段且 persist 时被 omit，冷启动时 restore() 尚未完成 → 交给共享守卫
  // （它会先等一次 restore 再判定），否则真管理员也会被误踢。
  isAdmin.value = await ensureAdmin()
})

function go(url: string) {
  uni.navigateTo({ url })
}

const tabs = [
  { label: '举报', value: 'list-reports' },
  { label: '用户', value: 'list-users' },
  { label: '认证', value: 'list-verifies' },
  { label: '反馈', value: 'list-feedbacks' },
  { label: '内容', value: 'list-posts' },
  { label: '日志', value: 'list-logs' }
]
const tab = ref('list-reports')

const pagingRef = ref<any>(null)
// 绑给 <z-paging v-model="list">，由 z-paging 负责累积写入
const list = ref<any[]>([])
const error = ref('')
const loading = ref(false)
const keyword = ref('')
const verifyStatus = ref('pending')
const verifySegs = [
  { label: '待审', value: 'pending' },
  { label: '已过', value: 'approved' },
  { label: '驳回', value: 'rejected' },
  { label: '全部', value: 'all' }
]

const emptyMap: Record<string, [string, string]> = {
  'list-reports': ['REPORTS', '暂无待处理举报'],
  'list-users': ['USERS', '没有找到用户'],
  'list-verifies': ['VERIFIES', '暂无认证申请'],
  'list-feedbacks': ['FEEDBACKS', '暂无用户反馈'],
  'list-logs': ['AUDIT LOGS', '暂无审计日志']
}
const emptyMeta = computed(() => emptyMap[tab.value] || ['ADMIN', '暂无数据'])

function switchTab(v: string) {
  if (v === tab.value) return
  tab.value = v
  keyword.value = ''
  if (v === 'list-verifies') verifyStatus.value = 'pending'
  reload()
}

function switchVerifyStatus(v: string) {
  if (v === verifyStatus.value) return
  verifyStatus.value = v
  reload()
}

function reload() {
  error.value = ''
  pagingRef.value?.reload?.()
}

// 分页契约：admin 各 list-* 返回 ok({ list, total, page, pageSize })，无 hasMore 字段 ——
// 按「本页不足 pageSize 条」判定没有更多（与后端 skip/limit 分页语义一致）。
async function queryList(page: number, size: number) {
  const paging = pagingRef.value
  if (!paging || loading.value) return
  loading.value = true
  error.value = ''
  try {
    let rows: any[] = []
    if (tab.value === 'list-posts') {
      // 内容运营 Tab 用普通 post-list 拉数据。
      // ⚠️ 必须先判断再决定是否调 admin：admin 云函数没有 list-posts 动作，
      // 先发 admin 请求会直接抛「未知管理操作」，后面的 post-list 分支根本到不了。
      const pr: any = await callFunction('post-list', { tab: 'latest', page, pageSize: size })
      rows = pr?.list ?? []
    } else {
      const payload: Record<string, any> = { action: tab.value, page, pageSize: size }
      const kw = keyword.value.trim()
      if (tab.value === 'list-users' && kw) payload.keyword = kw.slice(0, 20)
      if (tab.value === 'list-verifies') payload.status = verifyStatus.value
      const res: any = await callFunction('admin', payload)
      rows = res?.list ?? []
    }
    // 认证证件图：cloud:// fileID 异步转临时 URL（失败静默，行内显示占位文案）
    if (tab.value === 'list-verifies') {
      for (const row of rows) {
        if (row.imageFileID && !row._img) {
          fileIDToTempUrl(row.imageFileID)
            .then((u: string) => {
              row._img = u
            })
            .catch(() => {})
        }
      }
    }
    paging.completeByNoMore(rows, rows.length < size)
  } catch (e: any) {
    error.value = String(e?.message || e)
    console.error('[admin] query 失败', error.value)
    if (typeof paging.completeByError === 'function') paging.completeByError(error.value)
    else paging.complete?.(false)
  } finally {
    loading.value = false
  }
}

// ---- 通用工具 ----

function confirmModal(title: string, content: string, confirmText = '确定'): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false)
    })
  })
}

/** 带输入框的弹窗（editable 微信/H5 均支持）；取消返回 null */
function promptModal(title: string, placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      success: (r: any) => resolve(r.confirm ? String(r.content || '') : null),
      fail: () => resolve(null)
    } as any)
  })
}

async function run(fn: () => Promise<any>, okMsg: string) {
  try {
    await fn()
    uni.showToast({ title: okMsg, icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

/** z-paging 由 v-model 维护 list，本地移除已处理行即刷新视图 */
function removeRow(id: string) {
  list.value = list.value.filter((x: any) => x._id !== id && x.reportId !== id)
}

// ---- 内容运营（pin / essence / delete）----

async function onPin(p: any, prevTab?: string) {
  void prevTab
  const action = p.isPinned ? 'unpin' : 'pin'
  try {
    await callFunction('admin', { action, postId: p._id })
    p.isPinned = !p.isPinned
    uni.showToast({ title: p.isPinned ? '已置顶' : '已取消置顶', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function onEssence(p: any) {
  const action = p.isEssence ? 'unessence' : 'essence'
  try {
    await callFunction('admin', { action, postId: p._id })
    p.isEssence = !p.isEssence
    uni.showToast({ title: p.isEssence ? '已加精' : '已取消精华', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function onDeleteContent(p: any) {
  const ok = await confirmModal('删除内容', '删除后用户在信息流中不可见，确定继续？', '删除')
  if (!ok) return
  try {
    await callFunction('admin', { action: 'delete', targetType: 'post', targetId: p._id })
    removeRow(p._id)
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
  }
}

// ---- 展示映射 ----

function typeLabel(t: string): string {
  const m: Record<string, string> = { post: '帖子', product: '商品', comment: '评论' }
  return m[t] || '内容'
}
function verifyLabel(s: string): string {
  const m: Record<string, string> = { pending: '待审', approved: '已通过', rejected: '已驳回' }
  return m[s] || s
}
function verifyBadgeClass(s: string): string {
  if (s === 'approved') return 'badge-ok'
  if (s === 'rejected') return 'badge-danger'
  return 'badge-pin'
}
function fbTypeLabel(t: string): string {
  const m: Record<string, string> = { bug: '缺陷', suggest: '建议', other: '其他' }
  return m[t] || '反馈'
}
const LOG_LABELS: Record<string, string> = {
  ban: '封禁',
  unban: '解封',
  delete: '删除内容',
  resolve: '处理举报',
  'resolve-feedback': '回复反馈',
  'verify-review': '认证审核',
  pin: '置顶',
  unpin: '取消置顶',
  essence: '加精',
  unessence: '取消加精'
}
function logLabel(a: string): string {
  return LOG_LABELS[a] || a
}
function logDetail(l: any): string {
  if (!l?.detail) return ''
  const d = typeof l.detail === 'string' ? l.detail : JSON.stringify(l.detail)
  return d.length > 60 ? d.slice(0, 60) + '…' : d
}
function fmt(t: any): string {
  if (!t) return ''
  const d = new Date(t)
  if (isNaN(d.getTime())) return String(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ---- 举报审核 ----

// 评论无独立详情页（后端也未提供锚点），仅帖子/商品可跳转
function goTarget(r: any) {
  const map: Record<string, string> = { post: 'post-detail', product: 'product-detail' }
  const page = map[r.targetType]
  if (page && r.targetId) {
    uni.navigateTo({ url: `/pages/${page}/${page}?id=${r.targetId}` })
  }
}

async function onDeleteTarget(r: any) {
  if (
    !(await confirmModal(
      '删除内容',
      `确定删除被举报的${typeLabel(r.targetType)}？删除后不可恢复。`,
      '删除'
    ))
  )
    return
  await run(
    () =>
      callFunction('admin', { action: 'delete', targetType: r.targetType, targetId: r.targetId }),
    '已删除'
  )
  removeRow(r.reportId)
}

async function onResolve(r: any) {
  if (!(await confirmModal('忽略举报', '标记该举报为已处理？内容本身不会被删除。', '忽略'))) return
  await run(() => callFunction('admin', { action: 'resolve', reportId: r.reportId }), '已忽略')
  removeRow(r.reportId)
}

// ---- 用户管理 ----

function goUser(u: any) {
  uni.navigateTo({ url: `/pages/user-profile/user-profile?id=${u._id}` })
}

async function onBan(u: any) {
  if (
    !(await confirmModal(
      '封禁用户',
      `确定封禁「${u.nickname || u._id}」？封禁后无法发帖/交易。`,
      '封禁'
    ))
  )
    return
  await run(() => callFunction('admin', { action: 'ban', targetUserId: u._id }), '已封禁')
  removeRow(u._id)
}

async function onUnban(u: any) {
  if (!(await confirmModal('解封用户', `确定解封「${u.nickname || u._id}」？`, '解封'))) return
  await run(() => callFunction('admin', { action: 'unban', targetUserId: u._id }), '已解封')
  removeRow(u._id)
}

// ---- 认证审核 ----

async function onVerifyReview(v: any, approve: boolean) {
  let reason = ''
  if (!approve) {
    const input = await promptModal('驳回认证', '填写驳回理由（留空用默认文案）')
    if (input === null) return
    reason = input.slice(0, 100)
  }
  // verify-review 契约：approve 为 falsy 即驳回，必须显式传布尔
  await run(
    () => callFunction('admin', { action: 'verify-review', requestId: v._id, approve, reason }),
    approve ? '已通过' : '已驳回'
  )
  removeRow(v._id)
}

function preview(url: string) {
  uni.previewImage({ urls: [url] })
}

// ---- 反馈处理 ----

async function onResolveFeedback(f: any) {
  const reply = await promptModal('回复反馈', '管理回复（选填，≤500 字，展示给用户）')
  if (reply === null) return
  await run(
    () =>
      callFunction('admin', {
        action: 'resolve-feedback',
        feedbackId: f._id,
        reply: reply.slice(0, 500)
      }),
    '已处理'
  )
  removeRow(f._id)
}
</script>

<style lang="scss" scoped>
/* 顶栏 + Tab 固定，列表区滚动：z-paging 根节点是 height:100%，
   父级必须是有确定高度的 flex 容器，只用 min-height 会被裁成 0 高度。 */
.adm-page {
  display: flex;
  flex-direction: column;
  /* H5：--window-top 是导航栏高度，必须扣掉，否则 100vh 会多出一截并产生滚动条。
     小程序/App：没有该变量，100vh 已是可视区（导航栏由原生层占位）。 */
  /* #ifdef H5 */
  height: calc(100vh - var(--window-top));
  /* #endif */
  /* #ifndef H5 */
  height: 100vh;
  /* #endif */
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 40rpx;
}
.adm-page > z-paging,
.adm-page > .z-paging-content {
  flex: 1 1 0;
  min-height: 0;
}

/* 顶栏 */
.adm-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
}
.adm-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.adm-kicker {
  font-size: 20rpx;
  letter-spacing: 4rpx;
  color: var(--text-secondary);
  font-weight: var(--fw-title);
}
.adm-sub {
  font-size: 24rpx;
  color: var(--text-tertiary);
}
.adm-links {
  display: flex;
  gap: 12rpx;
}
.adm-link {
  font-size: 22rpx;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  margin: 0;
}

/* Tab（my-list 模式） */
.tab-row {
  display: flex;
  padding: 0 32rpx 16rpx;
  gap: 12rpx;
  /* 6 个 tab 在 390px 屏放下不：改横向滚动而不是把它挤出屏幕外。
     flex-shrink:0 + nowrap 保证每个 tab 不被压扁，overflow-x:auto 提供滚动。 */
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}
.adm-tab {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 10rpx 24rpx;
  font-size: 26rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  &.active {
    color: #0d110e;
    background: var(--accent);
    font-weight: var(--fw-title);
  }
}

/* 搜索 / 筛选 */
.adm-search {
  display: flex;
  gap: 12rpx;
  padding: 0 32rpx 16rpx;
}
.adm-input {
  flex: 1;
  height: 64rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  padding: 0 20rpx;
  font-size: 26rpx;
  color: var(--text-body);
}
.adm-search-btn {
  font-size: 24rpx;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 28rpx;
  margin: 0;
}

.seg-row {
  display: flex;
  padding: 0 32rpx 16rpx;
  gap: 12rpx;
}
.seg {
  padding: 8rpx 24rpx;
  font-size: 24rpx;
  color: var(--text-secondary);
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  &.active {
    color: #0d110e;
    background: var(--accent);
    font-weight: var(--fw-title);
  }
}

/* 列表卡片 */
.adm-list {
  padding: 0 24rpx 40rpx;
}
.card {
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  border-radius: var(--radius-sharp);
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.log-card {
  opacity: 0.9;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.card-title {
  font-size: 28rpx;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-reason,
.card-desc,
.card-snippet,
.card-meta,
.card-body-text {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-top: 6rpx;
}
.card-snippet {
  color: var(--text-tertiary);
}
.card-reply {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--secondary);
  line-height: 1.6;
}
.time {
  margin-left: auto;
  font-size: 20rpx;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* 徽标 */
.badge {
  font-size: 18rpx;
  padding: 4rpx 12rpx;
  font-weight: var(--fw-title);
  letter-spacing: 2rpx;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  flex-shrink: 0;
}
.badge-danger {
  color: var(--danger);
  background: var(--bg-elevated);
}
.badge-ok {
  color: var(--success);
  background: var(--bg-elevated);
}
.badge-pin {
  color: #0d110e;
  background: var(--accent);
}

/* 操作按钮 */
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
}
/* 内容运营行：与 card-actions 同构，保留独立类名以便后续单独调布局 */
.act-row {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
  flex-wrap: wrap;
}
.act {
  font-size: 22rpx;
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  margin: 0;
  border-radius: var(--radius-sharp);
}
.act-ghost {
  background: transparent;
  color: var(--text-body);
  border: 2rpx solid var(--border);
}
.act-danger {
  background: var(--danger);
  color: #14100e;
  border: none;
  font-weight: var(--fw-title);
}
.act-ok {
  background: var(--accent);
  color: #0d110e;
  border: none;
  font-weight: var(--fw-title);
}
.act-accent {
  background: transparent;
  color: var(--accent);
  border: 2rpx solid var(--accent-dim);
}

.verify-img {
  width: 320rpx;
  height: 220rpx;
  border-radius: var(--radius-sharp);
  border: 1rpx solid var(--border);
  margin-top: 12rpx;
  background: var(--bg-deep);
}

/* 状态 */
.adm-state {
  padding: 60rpx 32rpx;
  text-align: center;
}
.adm-retry {
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
