<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { listFeedbacks, setFeedbackDone, logAction } from "@/api/biz";

defineOptions({ name: "FeedbacksList" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

async function load() {
  loading.value = true;
  try {
    const res = await listFeedbacks(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onToggle(row: any) {
  const done = row.status !== "done";
  const { error } = await setFeedbackDone(row.id, done);
  if (error) return ElMessage.error(error.message);
  await logAction("feedback.handle", `${done ? "标记已处理" : "重开"}反馈 ${row.id}`);
  ElMessage.success("已更新");
  load();
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="content" label="反馈内容" min-width="280" show-overflow-tooltip />
        <el-table-column prop="contact" label="联系方式" min-width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'done' ? 'success' : 'warning'">
              {{ row.status === "done" ? "已处理" : "待处理" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button :type="row.status === 'done' ? 'info' : 'success'" link @click="onToggle(row)">
              {{ row.status === "done" ? "重开" : "标记已处理" }}
            </el-button>
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
