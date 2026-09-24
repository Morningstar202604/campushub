<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { auditPosts, setPostStatus, setPostPin, setPostEssence, logAction } from "@/api/biz";

defineOptions({ name: "ContentPosts" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const kindLabel = (k: string) =>
  ({ post: "普通", task: "任务", lost: "寻物", found: "失物招领", confession: "表白" }[k] ?? k);

async function load() {
  loading.value = true;
  try {
    const res = await auditPosts(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(`确定删除帖子「${row.title}」？删除后学生端不可见。`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  const { error } = await setPostStatus(row.id, "deleted");
  if (error) return ElMessage.error(error.message);
  await logAction("post.delete", `删除帖子 ${row.id}`, row.id);
  ElMessage.success("已删除");
  load();
}

async function onTogglePin(row: any) {
  const { error } = await setPostPin(row.id, !row.is_pinned);
  if (error) return ElMessage.error(error.message);
  await logAction("post.pin", `${row.is_pinned ? "取消置顶" : "置顶"} ${row.id}`);
  ElMessage.success("已更新");
  load();
}

async function onToggleEssence(row: any) {
  const { error } = await setPostEssence(row.id, !row.is_essence);
  if (error) return ElMessage.error(error.message);
  await logAction("post.essence", `${row.is_essence ? "取消精华" : "设为精华"} ${row.id}`);
  ElMessage.success("已更新");
  load();
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ kindLabel(row.kind) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'normal' ? 'success' : 'danger'">
              {{ row.status === "normal" ? "正常" : row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="置顶" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.is_pinned" @change="onTogglePin(row)" />
          </template>
        </el-table-column>
        <el-table-column label="精华" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.is_essence" @change="onToggleEssence(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="view_count" label="浏览" width="70" />
        <el-table-column prop="comment_count" label="评论" width="70" />
        <el-table-column label="发布时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" link @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="mt-3 justify-end"
        @current-change="load"
      />
    </el-card>
  </div>
</template>
