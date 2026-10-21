<template>
  <view>
    <view class="cn-row" :style="{ paddingLeft: indent }">
      <text class="cn-branch" v-if="node.level > 1">└</text>
      <text v-if="node.emoji" class="cn-emoji">{{ node.emoji }}</text>
      <text class="cn-name" :class="{ 'cn-name-root': node.level === 1 }">{{ node.name }}</text>
      <text class="cn-kind">{{ kindLabel }}</text>
      <view class="cn-actions">
        <text v-if="node.level < 3" class="cn-act cn-act-add press" @click.stop="$emit('add', node)">+子级</text>
        <text class="cn-act cn-act-edit press" @click.stop="$emit('edit', node)">编辑</text>
        <text
          class="cn-act cn-act-del press"
          :class="{ disabled: hasChildren }"
          @click.stop="$emit('del', node)"
        >
          删除
        </text>
      </view>
    </view>
    <!-- 递归渲染子节点（Vue 3 SFC 可按文件名自引用，最多 3 级与后端 MAX_LEVEL 对齐） -->
    <cat-node
      v-for="child in node.children"
      :key="child._id"
      :node="child"
      @add="$emit('add', $event)"
      @edit="$emit('edit', $event)"
      @del="$emit('del', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 类目树节点（递归组件）。
 * 事件冒泡：add / edit / del 统一上抛给页面处理，组件自身不发请求、不弹窗。
 * children 非空时删除按钮置灰提示（后端会拒绝带子分类的删除，前端预判减少无效请求）。
 */
const props = defineProps<{ node: any }>()
// 显式命名：小程序端递归自引用必须依赖组件名注册（H5 端按文件名隐式自引用即可）
defineOptions({ name: 'CatNode' })
defineEmits(['add', 'edit', 'del'])

const indent = computed(() => `${((props.node.level || 1) - 1) * 32}rpx`)
const hasChildren = computed(() => Array.isArray(props.node.children) && props.node.children.length > 0)

const KIND_LABELS: Record<string, string> = { zone: '分区', forum: '版块', board: '栏目' }
const kindLabel = computed(() => KIND_LABELS[props.node.kind] || props.node.kind)
</script>

<style lang="scss" scoped>
.cn-row {
  display: flex; align-items: center; gap: 10rpx; min-height: 72rpx;
  border-bottom: 1rpx solid var(--border); padding-right: 8rpx;
}
.cn-branch { color: var(--text-tertiary); font-size: 24rpx; flex-shrink: 0; }
.cn-emoji { font-size: 28rpx; flex-shrink: 0; }
.cn-name {
  font-size: 26rpx; color: var(--text-body); flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cn-name-root { font-weight: var(--fw-title); color: var(--text-primary); font-size: 28rpx; }
.cn-kind {
  font-size: 18rpx; color: var(--text-tertiary); background: var(--bg-elevated);
  padding: 2rpx 10rpx; flex-shrink: 0;
}
.cn-actions { display: flex; gap: 18rpx; flex-shrink: 0; }
.cn-act { font-size: 22rpx; padding: 4rpx 6rpx; }
.cn-act-add { color: var(--accent); }
.cn-act-edit { color: var(--secondary); }
.cn-act-del { color: var(--danger);
  &.disabled { color: var(--text-tertiary); opacity: 0.6; }
}
</style>
