<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listReports, handleReport, logAction } from "@/api/biz";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({ name: "ReportsList" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const targetLabel = (t: string) => ({ post: "帖子", product: "商品", comment: "评论", user: "用户" }[t] ?? t);

async function load() {
  loading.value = true;
  try {
    const res = await listReports(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onHandle(row: any, status: "approved" | "rejected") {
  const note = await ElMessageBox.prompt(
    status === "approved" ? "处理方式：同意举报（删除内容）/ 备注处理说明" : "驳回举报，请填写驳回原因",
    status === "approved" ? "通过举报" : "驳回举报",
    { confirmButtonText: "确定", cancelButtonText: "取消", inputPlaceholder: "处理备注（选填）" }
  ).catch(() => null);
  if (!note) return;
  const res = await handleReport(row.id, status, note.value || "", useUserStoreHook().username);
  if (res.error) return ElMessage.error(res.error);
  await logAction("report.handle", `${status === "approved" ? "通过" : "驳回"}举报 ${row.id}`);
  ElMessage.success("已处理");
  load();
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-alert
        title="举报处理流程：先查看详情判断是否违规 → 通过（同时建议去对应内容处删除）或驳回。"
        type="info"
        :closable="false"
        class="mb-3"
      />
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="举报对象" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ targetLabel(row.target_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="举报原因" min-width="140" />
        <el-table-column prop="detail" label="详情" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'pending' ? 'warning' : row.status === 'approved' ? 'danger' : 'info'">
              {{ { pending: "待处理", approved: "已通过", rejected: "已驳回" }[row.status] ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="举报时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="handler_note" label="处理备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button type="danger" link @click="onHandle(row, 'approved')">通过</el-button>
              <el-button type="info" link @click="onHandle(row, 'rejected')">驳回</el-button>
            </template>
            <span v-else class="text-slate-400 text-xs">已处理</span>
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
