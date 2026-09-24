<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listAnnouncements, saveAnnouncement, deleteAnnouncement, logAction } from "@/api/biz";

defineOptions({ name: "AnnouncementsList" });

const loading = ref(false);
const list = ref<any[]>([]);
const dialogVisible = ref(false);
const editing = ref(false);

const form = reactive({ id: "", title: "", content: "", is_active: true });

async function load() {
  loading.value = true;
  try {
    const res = await listAnnouncements();
    if (res.error) throw new Error(res.error);
    list.value = res.list;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = false;
  Object.assign(form, { id: "", title: "", content: "", is_active: true });
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  Object.assign(form, { id: row.id, title: row.title, content: row.content, is_active: row.is_active });
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.title.trim()) return ElMessage.warning("请输入公告标题");
  if (!form.content.trim()) return ElMessage.warning("请输入公告内容");
  try {
    const { error } = await saveAnnouncement({ ...form });
    if (error) throw new Error(error.message);
    await logAction("announcement.save", `${editing.value ? "编辑" : "发布"}公告 ${form.title}`);
    ElMessage.success("保存成功");
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(`确定删除公告「${row.title}」？`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  try {
    const { error } = await deleteAnnouncement(row.id);
    if (error) throw new Error(error.message);
    await logAction("announcement.delete", `删除公告 ${row.title}`);
    ElMessage.success("已删除");
    load();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  }
}

onMounted(load);
</script>

<template>
  <div class="app-container">
    <el-card shadow="never">
      <div class="mb-3">
        <el-button type="primary" @click="openCreate">发布公告</el-button>
        <span class="ml-2 text-xs text-slate-400">启用中的公告会展示在学生端首页公告栏</span>
      </div>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.is_active ? 'success' : 'info'">{{ row.is_active ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="160">
          <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑公告' : '发布公告'" width="560px">
      <el-form label-width="70px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="公告标题" maxlength="50" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="公告正文" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
