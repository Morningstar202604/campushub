<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import VditorEditor from "@/components/VditorEditor.vue";
import {
  listGuideCats, saveGuideCat, deleteGuideCat,
  listGuides, saveGuide, deleteGuide, logAction
} from "@/api/biz";

defineOptions({ name: "GuidesList" });

const activeTab = ref("guides");
const loading = ref(false);

// ---- 指南分类 ----
const cats = ref<any[]>([]);
const catDialog = ref(false);
const catForm = reactive({ id: "", name: "", icon: "", sort: 0 });

async function loadCats() {
  try {
    const res = await listGuideCats();
    if (res.error) throw new Error(res.error);
    cats.value = res.list;
  } catch (e: any) {
    ElMessage.error(e?.message || "分类加载失败");
  }
}

function openCatCreate() {
  Object.assign(catForm, { id: "", name: "", icon: "", sort: cats.value.length + 1 });
  catDialog.value = true;
}
function openCatEdit(row: any) {
  Object.assign(catForm, { id: row.id, name: row.name, icon: row.icon, sort: row.sort });
  catDialog.value = true;
}
async function onCatSave() {
  if (!catForm.name.trim()) return ElMessage.warning("请输入分类名称");
  try {
    const { error } = await saveGuideCat({ ...catForm });
    if (error) throw new Error(error.message);
    await logAction("guide_cat.save", `${catForm.id ? "编辑" : "新增"}指南分类 ${catForm.name}`);
    ElMessage.success("保存成功");
    catDialog.value = false;
    loadCats();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  }
}
async function onCatDelete(row: any) {
  await ElMessageBox.confirm(`确定删除指南分类「${row.name}」？该分类下指南会一并失去分类。`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  try {
    const { error } = await deleteGuideCat(row.id);
    if (error) throw new Error(error.message);
    await logAction("guide_cat.delete", `删除指南分类 ${row.name}`);
    ElMessage.success("已删除");
    loadCats();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  }
}

// ---- 指南 ----
const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const catFilter = ref("");
const guideDialog = ref(false);
const editing = ref(false);
const guideForm = reactive({ id: "", category_id: "", title: "", summary: "", content: "", tags: "", cover_image: "" });

async function loadGuides() {
  loading.value = true;
  try {
    const res = await listGuides(page.value, pageSize.value, catFilter.value);
    list.value = res.list;
    total.value = res.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function openGuideCreate() {
  editing.value = false;
  Object.assign(guideForm, { id: "", category_id: cats.value[0]?.id ?? "", title: "", summary: "", content: "", tags: "", cover_image: "" });
  guideDialog.value = true;
}
function openGuideEdit(row: any) {
  editing.value = true;
  Object.assign(guideForm, {
    id: row.id,
    category_id: row.category_id,
    title: row.title,
    summary: row.summary,
    content: row.content ?? "",
    tags: (row.tags ?? []).join(","),
    cover_image: row.cover_image ?? ""
  });
  guideDialog.value = true;
}
async function onGuideSave() {
  if (!guideForm.title.trim()) return ElMessage.warning("请输入标题");
  if (!guideForm.content.trim()) return ElMessage.warning("请输入正文内容");
  try {
    const payload = {
      ...guideForm,
      // 保存 Markdown 源（学生端渲染时转 HTML）
      tags: guideForm.tags.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean)
    };
    const { error } = await saveGuide(payload);
    if (error) throw new Error(error.message);
    await logAction("guide.save", `${editing.value ? "编辑" : "发布"}指南 ${guideForm.title}`);
    ElMessage.success("保存成功");
    guideDialog.value = false;
    loadGuides();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  }
}
async function onGuideDelete(row: any) {
  await ElMessageBox.confirm(`确定删除指南「${row.title}」？`, "删除确认", {
    type: "warning",
    confirmButtonText: "删除",
    cancelButtonText: "取消"
  });
  try {
    const { error } = await deleteGuide(row.id);
    if (error) throw new Error(error.message);
    await logAction("guide.delete", `删除指南 ${row.title}`);
    ElMessage.success("已删除");
    loadGuides();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  }
}

onMounted(() => {
  loadCats();
  loadGuides();
});
</script>

<template>
  <div class="app-container">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="指南内容" name="guides">
        <el-card shadow="never">
          <div class="mb-3 flex gap-2">
            <el-button type="primary" @click="openGuideCreate">发布指南</el-button>
            <el-select v-model="catFilter" placeholder="按分类筛选" clearable class="w-44!" @change="page = 1; loadGuides()">
              <el-option v-for="c in cats" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </div>
          <el-table v-loading="loading" :data="list" stripe>
            <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
            <el-table-column label="分类" width="110">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ cats.find(c => c.id === row.category_id)?.name || "—" }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="summary" label="摘要" min-width="220" show-overflow-tooltip />
            <el-table-column prop="view_count" label="浏览" width="70" />
            <el-table-column label="发布时间" width="160">
              <template #default="{ row }">{{ new Date(row.created_at).toLocaleString() }}</template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openGuideEdit(row)">编辑</el-button>
                <el-button type="danger" link @click="onGuideDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            class="mt-3 justify-end"
            @current-change="loadGuides"
          />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="指南分类" name="cats">
        <el-card shadow="never">
          <div class="mb-3">
            <el-button type="primary" @click="openCatCreate">新增分类</el-button>
          </div>
          <el-table :data="cats" stripe>
            <el-table-column prop="icon" label="图标" width="80">
              <template #default="{ row }">{{ row.icon || "—" }}</template>
            </el-table-column>
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column prop="sort" label="排序" width="80" />
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click="openCatEdit(row)">编辑</el-button>
                <el-button type="danger" link @click="onCatDelete(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 指南分类对话框 -->
    <el-dialog v-model="catDialog" :title="catForm.id ? '编辑分类' : '新增分类'" width="420px">
      <el-form label-width="70px">
        <el-form-item label="名称" required>
          <el-input v-model="catForm.name" placeholder="如：新生指南" maxlength="20" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="catForm.icon" placeholder="emoji（选填）" maxlength="10" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="catForm.sort" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="catDialog = false">取消</el-button>
        <el-button type="primary" @click="onCatSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 指南编辑对话框 -->
    <el-dialog v-model="guideDialog" :title="editing ? '编辑指南' : '发布指南'" width="720px" top="6vh">
      <el-form label-width="70px">
        <el-form-item label="标题" required>
          <el-input v-model="guideForm.title" placeholder="指南标题" maxlength="60" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="guideForm.category_id" placeholder="选择分类" class="w-full!">
            <el-option v-for="c in cats" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="摘要">
          <el-input v-model="guideForm.summary" type="textarea" :rows="2" placeholder="列表页展示的一句话摘要" maxlength="120" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="guideForm.tags" placeholder="用逗号分隔，如：报到,宿舍,军训" />
        </el-form-item>
        <el-form-item label="封面图">
          <el-input v-model="guideForm.cover_image" placeholder="图片 URL（选填）" />
        </el-form-item>
        <el-form-item label="正文" required>
          <VditorEditor v-model="guideForm.content" />
          <div class="text-xs text-slate-400 mt-1">支持 Markdown，图片可直接粘贴/上传；学生端按富文本渲染</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="guideDialog = false">取消</el-button>
        <el-button type="primary" @click="onGuideSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
