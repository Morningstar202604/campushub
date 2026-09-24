<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { vditorUploadHandler } from "@/utils/upload";

/**
 * vditor Markdown 编辑器封装（指南正文）
 * - v-model 绑定 Markdown 源（用于编辑回显）
 * - getHTML() 返回渲染后的 HTML（用于保存，学生端按富文本渲染）
 */
defineOptions({ name: "VditorEditor" });

const props = defineProps<{ modelValue?: string; height?: number }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const container = ref<HTMLDivElement>();
let vditor: Vditor | null = null;

onMounted(() => {
  if (!container.value) return;
  vditor = new Vditor(container.value, {
    height: props.height ?? 420,
    mode: "ir",
    cache: { enable: false },
    toolbarConfig: { pin: true },
    input: value => emit("update:modelValue", value),
    upload: {
      accept: "image/*",
      handler: vditorUploadHandler
    },
    after: () => {
      vditor?.setValue(props.modelValue || "");
    }
  });
});

watch(
  () => props.modelValue,
  val => {
    if (vditor && val !== vditor.getValue()) vditor.setValue(val || "");
  }
);

onBeforeUnmount(() => {
  vditor?.destroy();
  vditor = null;
});

defineExpose({
  /** 渲染后的 HTML（保存时使用） */
  getHTML: () => vditor?.getHTML() ?? ""
});
</script>

<template>
  <div ref="container" class="vditor-editor" />
</template>

<style scoped>
.vditor-editor { width: 100%; }
</style>
