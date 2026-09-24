<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listCategories, saveCategory, deleteCategory, logAction } from "@/api/biz";

defineOptions({ name: "CategoriesList" });

const loading = ref(false);
const list = ref<any[]>([]);
const dialogVisible = ref(false);
const editing = ref(false);

const form = reactive({ id: "", name: "", icon: "", sort: 0, enabled: true });

async function load() {
  loading.value = true;
  try {
    const res = await listCategories();
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
  Object.assign(form, { id: "", name: "", icon: "", sort: list.value.length + 1, enabled: true });
  dialogVisible.value = true;
}

function openEdit(row: any) {
  editing.value = true;
  Object.assign(form, { id: row.id, name: row.name, icon: row.icon, sort: row.sort, enabled: row.enabled });
  dialogVisible.value = true;
}

async function onSave() {
  if (!form.name.trim()) return ElMessage.warning("请输入分类名称");
  try {
    const { error } = await saveCategory({ ...form });
    if (error) throw new Error(error.message);
    await logAction("category.save", `${editing.value ? "编辑" : "新增"}分类 ${form.name}`);
    ElMessage.success("保存成功");
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  }
}

async function onDelete(row: any) {
  await ElMessageBox.confirm(`确定删除分类「${row.name}」？分类下有内容时请先迁移。`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  try {
    const { error } = await deleteCategory(row.id);
    if (error) throw new Error(error.message);
    await logAction("category.delete", `删除分类 ${row.name}`);
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
        <el-button type="primary" @click="openCreate">新增分类</el-button>
      </div>
      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="icon" label="图标" width="80">
          <template #default="{ row }">{{ row.icon || "—" }}</template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? "启用" : "停用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
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

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑分类' : '新增分类'" width="420px">
      <el-form label-width="70px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：二手闲置、失物招领" maxlength="20" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="emoji 或图标标识，如 🛍️（选填）" maxlength="10" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
          <span class="ml-2 text-xs text-slate-400">数值越小越靠前</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
