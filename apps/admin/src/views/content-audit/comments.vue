<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { auditComments, setCommentStatus, logAction } from "@/api/biz";

defineOptions({ name: "ContentComments" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

async function load() {
  loading.value = true;
  try {
    const res = await auditComments(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm("确定删除这条评论？删除后学生端不可见。", "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  const { error } = await setCommentStatus(row.id, "deleted");
  if (error) return ElMessage.error(error.message);
  await logAction("comment.delete", `删除评论 ${row.id}`);
  ElMessage.success("已删除");
  load();
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="content" label="评论内容" min-width="240" show-overflow-tooltip />
        <el-table-column label="所属" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.target_type === "post" ? "帖子" : "商品" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'normal' ? 'success' : 'danger'">
              {{ row.status === "normal" ? "正常" : "已删除" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="like_count" label="点赞" width="70" />
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
