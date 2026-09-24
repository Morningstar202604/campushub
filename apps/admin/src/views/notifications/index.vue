<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { listNotifications, createNotification, listUsers, logAction } from "@/api/biz";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({ name: "NotificationsList" });

const loading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

// 发送表单
const dialogVisible = ref(false);
const form = reactive({ scope: "all", userKeyword: "", userId: "", content: "" });
const userOptions = ref<any[]>([]);

const typeLabel = (t: string) =>
  ({ like: "点赞", comment: "评论", follow: "关注", system: "系统", report_result: "处理结果" }[t] ?? t);

async function load() {
  loading.value = true;
  try {
    const res = await listNotifications(page.value, pageSize.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function searchUsers() {
  if (!form.userKeyword.trim()) return;
  const res = await listUsers(1, 10, form.userKeyword.trim());
  if (res.error) return ElMessage.error(res.error);
  userOptions.value = res.list;
}

async function onSend() {
  if (!form.content.trim()) return ElMessage.warning("请输入通知内容");
  try {
    if (form.scope === "all") {
      // 全站通知：给每个用户写一条（简单实现；量大可后续改通知表全局模式）
      const res = await listUsers(1, 500);
      if (res.error) throw new Error(res.error);
      if (!res.list.length) return ElMessage.warning("暂无用户，无法发送");
      const rows = res.list.map(u => ({
        user_id: u.id,
        type: "system",
        content: form.content.trim()
      }));
      const { error } = await supabaseInsertMany(rows);
      if (error) throw new Error(error.message);
    } else {
      if (!form.userId) return ElMessage.warning("请先搜索并选择用户");
      const { error } = await createNotification({
        user_id: form.userId,
        type: "system",
        content: form.content.trim()
      });
      if (error) throw new Error(error.message);
    }
    await logAction("notification.send", `${form.scope === "all" ? "全站" : "指定用户"}发送通知`);
    ElMessage.success("发送成功");
    dialogVisible.value = false;
    form.content = "";
    load();
  } catch (e: any) {
    ElMessage.error(e?.message || "发送失败");
  }
}

/** 批量插入（Supabase JS 单次 insert 数组） */
function supabaseInsertMany(rows: any[]) {
  // 通过动态 import 避免循环依赖
  return import("@/api/supabase").then(({ supabase }) =>
    supabase.from("notifications").insert(rows)
  );
}

function openSend() {
  Object.assign(form, { scope: "all", userKeyword: "", userId: "", content: "" });
  userOptions.value = [];
  dialogVisible.value = true;
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <div class="mb-3">
        <el-button type="primary" @click="openSend">发送通知</el-button>
        <span class="ml-2 text-xs text-slate-400">系统通知会出现在学生端「消息」页顶部</span>
      </div>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
        <el-table-column label="收件人" width="120">
          <template #default="{ row }">{{ row.user_id ? row.user_id.slice(0, 8) + "…" : "—" }}</template>
        </el-table-column>
        <el-table-column label="已读" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_read ? 'info' : 'success'">{{ row.is_read ? "已读" : "未读" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
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

    <el-dialog v-model="dialogVisible" title="发送系统通知" width="520px">
      <el-form label-width="90px">
        <el-form-item label="发送范围" required>
          <el-radio-group v-model="form.scope">
            <el-radio value="all">全站用户</el-radio>
            <el-radio value="one">指定用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.scope === 'one'" label="选择用户">
          <div class="flex gap-2 w-full!">
            <el-input v-model="form.userKeyword" placeholder="输入昵称搜索" @keyup.enter="searchUsers" />
            <el-button @click="searchUsers">搜索</el-button>
          </div>
          <el-select v-model="form.userId" placeholder="选择用户" class="w-full! mt-2" filterable>
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="`${u.nickname}（${u.college || '未填学校'}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="通知内容" required>
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="例如：本周六 19:00 操场有社团招新活动，欢迎参加！" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSend">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>
