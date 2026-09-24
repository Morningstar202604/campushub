<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { listAdminLogs } from "@/api/biz";

defineOptions({ name: "AdminLogsList" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const actionLabel = (a: string) =>
  ({
    "post.delete": "删除帖子",
    "post.pin": "置顶管理",
    "post.essence": "精华管理",
    "product.delete": "删除商品",
    "product.off": "商品下架",
    "comment.delete": "删除评论",
    "report.handle": "处理举报",
    "user.ban": "封禁/解封",
    "user.admin": "管理员变更",
    "category.save": "分类维护",
    "category.delete": "删除分类",
    "announcement.save": "公告维护",
    "announcement.delete": "删除公告",
    "guide.save": "指南维护",
    "guide.delete": "删除指南",
    "guide_cat.save": "指南分类维护",
    "guide_cat.delete": "删除指南分类",
    "feedback.handle": "反馈处理",
    "notification.send": "发送通知"
  }[a] ?? a);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const res = await listAdminLogs(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-alert title="管理员在后台的关键操作会自动记录于此，用于安全审计与责任追溯。" type="info" :closable="false" class="mb-3" />
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ actionLabel(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作人" width="120">
          <template #default="{ row }">{{ row.admin_id ? row.admin_id.slice(0, 8) + "…" : "—" }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
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
