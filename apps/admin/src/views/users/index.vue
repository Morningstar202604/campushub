<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listUsers, setUserBan, setUserAdmin, logAction } from "@/api/biz";

defineOptions({ name: "UsersList" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref("");

async function load() {
  loading.value = true;
  try {
    const res = await listUsers(page.value, pageSize.value, keyword.value.trim());
    if (res.error) throw new Error(res.error);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function onToggleBan(row: any) {
  const next = !row.is_banned;
  await ElMessageBox.confirm(
    next ? `封禁用户「${row.nickname}」？封禁后该用户无法登录与发言。` : `解除用户「${row.nickname}」的封禁？`,
    next ? "封禁确认" : "解封确认",
    { type: "warning", confirmButtonText: "确定", cancelButtonText: "取消" }
  );
  const { error } = await setUserBan(row.id, next);
  if (error) return ElMessage.error(error.message);
  await logAction("user.ban", `${next ? "封禁" : "解封"}用户 ${row.nickname}(${row.id})`);
  ElMessage.success("已更新");
  load();
}

async function onToggleAdmin(row: any) {
  const next = !row.is_admin;
  await ElMessageBox.confirm(
    next ? `将「${row.nickname}」设为管理员？` : `取消「${row.nickname}」的管理员身份？`,
    "权限变更",
    { type: "warning", confirmButtonText: "确定", cancelButtonText: "取消" }
  );
  const { error } = await setUserAdmin(row.id, next);
  if (error) return ElMessage.error(error.message);
  await logAction("user.admin", `${next ? "设为管理员" : "取消管理员"} ${row.nickname}(${row.id})`);
  ElMessage.success("已更新");
  load();
}

function onSearch() {
  page.value = 1;
  load();
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <div class="mb-3 flex gap-2">
        <el-input v-model="keyword" placeholder="按昵称搜索用户" clearable class="max-w-60!" @keyup.enter="onSearch" @clear="onSearch" />
        <el-button type="primary" @click="onSearch">搜索</el-button>
      </div>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="nickname" label="昵称" min-width="120" show-overflow-tooltip />
        <el-table-column prop="college" label="学校" min-width="120" show-overflow-tooltip />
        <el-table-column prop="major" label="专业" min-width="120" show-overflow-tooltip />
        <el-table-column prop="points" label="积分" width="70" />
        <el-table-column prop="checkin_streak" label="签到" width="70" />
        <el-table-column label="身份" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_admin ? 'danger' : 'info'">
              {{ row.is_admin ? "管理员" : "同学" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_banned ? 'danger' : 'success'">
              {{ row.is_banned ? "已封禁" : "正常" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button :type="row.is_banned ? 'success' : 'danger'" link @click="onToggleBan(row)">
              {{ row.is_banned ? "解封" : "封禁" }}
            </el-button>
            <el-button type="warning" link @click="onToggleAdmin(row)">
              {{ row.is_admin ? "取消管理员" : "设为管理员" }}
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
