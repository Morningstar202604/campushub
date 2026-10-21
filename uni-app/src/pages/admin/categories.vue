<template>
  <view class="cat-page">
    <!-- 顶栏 -->
    <view class="cat-top">
      <view class="cat-heading">
        <text class="cat-kicker clip-tag">CATEGORIES</text>
        <text class="cat-sub">三级目录树 · 软删除保留历史引用</text>
      </view>
      <button class="btn-ghost cat-refresh press" @click="loadTree">刷新</button>
    </view>

    <!-- 错误 / 空态 -->
    <view v-if="error" class="cat-state">
      <view class="empty-state">
        <view class="empty-shape"></view>
        <text class="empty-kicker">ERROR</text>
        <text class="empty-title">{{ error }}</text>
      </view>
      <button class="cat-retry press" @click="loadTree">重试</button>
    </view>
    <view v-else-if="loading" class="cat-state">
      <text class="cat-loading">加载中…</text>
    </view>
    <view v-else-if="!tree.length" class="empty-state">
      <view class="empty-shape"></view>
      <text class="empty-kicker">CATEGORIES</text>
      <text class="empty-title">还没有分类</text>
      <text class="empty-sub">点击下方按钮创建一级分区</text>
    </view>

    <!-- 树（cat-node 递归渲染） -->
    <view v-else class="cat-tree sticker">
      <cat-node :node="root" @add="onAdd" @edit="onEdit" @del="onDel" v-for="root in tree" :key="root._id" />
    </view>

    <!-- 新建根分类 -->
    <button class="btn-primary cat-new press" @click="onAdd(null)">+ 新建一级分类</button>

    <!-- 编辑弹层：create / update 共用 -->
    <view v-if="showEditor" class="mask" @click="closeEditor">
      <view class="editor sticker" @click.stop>
        <text class="editor-title title-900">{{ editId ? '编辑分类' : '新建分类' }}</text>

        <text class="editor-label">名称</text>
        <input v-model="editor.name" class="cat-input" :maxlength="30" placeholder="分类名称（30 字内）" />

        <text class="editor-label">Emoji（选填）</text>
        <input v-model="editor.emoji" class="cat-input" :maxlength="4" placeholder="如 🎓" />

        <text class="editor-label">类型</text>
        <view class="kind-row">
          <view
            v-for="k in kinds"
            :key="k.value"
            class="kind-seg clip-tag press"
            :class="{ active: editor.kind === k.value }"
            @click="editor.kind = k.value"
          >
            <text>{{ k.label }}</text>
          </view>
        </view>

        <text class="editor-label">排序（数字越小越靠前）</text>
        <input v-model="editor.order" class="cat-input" type="number" placeholder="默认 99" />

        <text v-if="editParentName" class="editor-hint">父级：{{ editParentName }}（层级自动继承）</text>

        <view class="editor-foot">
          <button class="btn-ghost editor-cancel press" @click="closeEditor">取消</button>
          <button class="btn-primary editor-save press" :disabled="saving" @click="onSave">
            {{ editId ? '保存' : '创建' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callFunction } from '@/utils/api'
import { ensureAdmin } from '@/composables/use-admin-guard'
import CatNode from './cat-node.vue'

/**
 * 类目管理：category-manage 的 create / update / delete 全接入。
 * 数据源：category-list 一次拉全量（≤1000 节点，无分页语义）→ 前端本地建树。
 * 防环由后端 collectDescendants 强制；前端只做「不能选自身/后代做父级」的编辑器禁用提示，
 * 父级变更入口 = 「+子级」/ 新建时挂到对应节点，不提供裸改 parentId，减少出错面。
 */

const tree = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)

// 编辑器状态
const showEditor = ref(false)
const editId = ref('')
const editParent = ref<any>(null)
const editor = reactive({ name: '', emoji: '', kind: 'forum', order: '99' })
const kinds = [
  { label: '分区', value: 'zone' },
  { label: '版块', value: 'forum' },
  { label: '栏目', value: 'board' }
]

const editParentName = computed(() => {
  if (editId.value) return '' // 编辑时不改父级（防环入口收敛）
  return editParent.value ? editParent.value.name : '（一级分类）'
})

onLoad(async () => {
  // 共享守卫：先等登录态刷新再判定 role（role 不进本地持久化，冷启动时这里恒为 undefined）
  if (!(await ensureAdmin())) return
  loadTree()
})

async function loadTree() {
  loading.value = true
  error.value = ''
  try {
    const res: any = await callFunction('category-list')
    tree.value = buildTree(res?.list ?? [])
  } catch (e: any) {
    error.value = String(e?.message || e)
    console.error('[categories] list 失败', error.value)
  } finally {
    loading.value = false
  }
}

/** 平铺 → 树（后端按 level/order 排好序；孤儿节点挂为一级兜底，不丢数据） */
function buildTree(flat: any[]): any[] {
  const map = new Map<string, any>()
  const roots: any[] = []
  for (const n of flat) {
    map.set(n._id, { ...n, children: [] })
  }
  for (const n of map.values()) {
    const parent = n.parentId ? map.get(n.parentId) : null
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  return roots
}

function resetEditor() {
  editor.name = ''
  editor.emoji = ''
  editor.kind = 'forum'
  editor.order = '99'
  editId.value = ''
  editParent.value = null
}

function closeEditor() {
  showEditor.value = false
  resetEditor()
}

/** 新建：parent 为 null 时建一级；否则挂为该节点子级 */
function onAdd(parent: any) {
  resetEditor()
  editParent.value = parent
  showEditor.value = true
}

/** 编辑：只改名/emoji/kind/order，父级不变（防环入口收敛为「+子级」） */
function onEdit(node: any) {
  resetEditor()
  editId.value = node._id
  editor.name = node.name || ''
  editor.emoji = node.emoji || ''
  editor.kind = node.kind || 'forum'
  editor.order = String(node.order ?? 99)
  showEditor.value = true
}

async function onSave() {
  const name = editor.name.trim()
  if (!name) {
    uni.showToast({ title: '请输入分类名称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    if (editId.value) {
      await callFunction('category-manage', {
        action: 'update',
        id: editId.value,
        name,
        emoji: editor.emoji.trim(),
        kind: editor.kind,
        order: Number(editor.order) || 99
      })
    } else {
      await callFunction('category-manage', {
        action: 'create',
        name,
        emoji: editor.emoji.trim(),
        kind: editor.kind,
        parentId: editParent.value ? editParent.value._id : null,
        order: Number(editor.order) || 99
      })
    }
    uni.showToast({ title: editId.value ? '已保存' : '已创建', icon: 'success' })
    closeEditor()
    loadTree()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

async function onDel(node: any) {
  if (node.children && node.children.length) {
    uni.showToast({ title: '该分类下还有子分类，请先删除子分类', icon: 'none' })
    return
  }
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除分类',
      content: `确定删除「${node.name}」？历史帖子的分类引用仍会保留（软删除）`,
      confirmText: '删除',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return
  try {
    await callFunction('category-manage', { action: 'delete', id: node._id })
    uni.showToast({ title: '已删除', icon: 'success' })
    loadTree()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '删除失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.cat-page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text-body);
  padding-bottom: 60rpx;
}

/* 顶栏 */
.cat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
}
.cat-heading { display: flex; flex-direction: column; gap: 8rpx; }
.cat-kicker { font-size: 20rpx; letter-spacing: 4rpx; color: var(--text-secondary); font-weight: var(--fw-title); }
.cat-sub { font-size: 24rpx; color: var(--text-tertiary); }
.cat-refresh { font-size: 22rpx; height: 56rpx; line-height: 56rpx; padding: 0 24rpx; margin: 0; }

/* 树容器 */
.cat-tree {
  margin: 0 32rpx 24rpx; padding: 8rpx 20rpx;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}

/* 新建按钮 */
.cat-new {
  display: block; margin: 0 32rpx; height: 80rpx; line-height: 80rpx; font-size: 28rpx;
}

/* 状态 */
.cat-state { padding: 60rpx 32rpx; text-align: center; }
.cat-loading { font-size: 24rpx; color: var(--text-tertiary); }
.cat-retry {
  margin: 20rpx auto 0; background: var(--bg-elevated); color: var(--text-body);
  font-size: 24rpx; font-weight: var(--fw-title); border: 2rpx solid var(--border);
  padding: 0 40rpx; height: 64rpx; line-height: 64rpx; border-radius: var(--radius-sharp);
}

/* 编辑弹层 */
.mask {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 999;
  display: flex; align-items: center; justify-content: center; padding: 32rpx;
}
.editor {
  width: 100%; max-width: 640rpx; max-height: 80vh; overflow-y: auto;
  background: var(--bg-card); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
  padding: 32rpx; display: flex; flex-direction: column; gap: 12rpx;
}
.editor-title { font-size: 30rpx; color: var(--text-primary); margin-bottom: 8rpx; }
.editor-label { font-size: 22rpx; color: var(--text-tertiary); margin-top: 8rpx; }
.editor-hint { font-size: 22rpx; color: var(--accent); margin-top: 8rpx; }
.cat-input {
  height: 72rpx; padding: 0 20rpx; font-size: 26rpx; color: var(--text-body);
  background: var(--bg-deep); border: 1rpx solid var(--border); border-radius: var(--radius-sharp);
}
.kind-row { display: flex; gap: 12rpx; }
.kind-seg {
  padding: 8rpx 24rpx; font-size: 24rpx; color: var(--text-secondary);
  background: var(--bg-deep); border: 1rpx solid var(--border);
  &.active { color: #0d110e; background: var(--accent); font-weight: var(--fw-title); }
}
.editor-foot { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 16rpx; }
.editor-cancel, .editor-save { font-size: 26rpx; height: 68rpx; line-height: 68rpx; padding: 0 36rpx; margin: 0; }
</style>
