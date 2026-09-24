<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { auditProducts, setProductStatus, logAction } from "@/api/biz";

defineOptions({ name: "ContentProducts" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

async function load() {
  loading.value = true;
  try {
    const res = await auditProducts(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(`确定删除商品「${row.title}」？删除后学生端不可见。`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  const { error } = await setProductStatus(row.id, "deleted");
  if (error) return ElMessage.error(error.message);
  await logAction("product.delete", `删除商品 ${row.id}`);
  ElMessage.success("已删除");
  load();
}

async function onForceOff(row: any) {
  await ElMessageBox.confirm(`将商品「${row.title}」下架？（保留详情，仅从市集列表移除）`, "下架确认", {
    type: "warning",
    confirmButtonText: "下架",
    cancelButtonText: "取消"
  });
  const { error } = await setProductStatus(row.id, "off");
  if (error) return ElMessage.error(error.message);
  await logAction("product.off", `下架商品 ${row.id}`);
  ElMessage.success("已下架");
  load();
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="价格" width="100">
          <template #default="{ row }">￥{{ Number(row.price).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'on_sale' ? 'success' : 'info'">
              {{ { on_sale: "在售", sold: "已售", off: "已下架", deleted: "已删除" }[row.status] ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="view_count" label="浏览" width="70" />
        <el-table-column label="发布时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'on_sale'" type="warning" link @click="onForceOff(row)">下架</el-button>
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
