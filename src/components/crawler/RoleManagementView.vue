<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen, Plus, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, RoleDefinition, RolePayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const roles = shallowRef<RoleDefinition[]>([])
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

const canManageRoles = computed(() => props.session?.role === 'superadmin')

const form = reactive<RolePayload>({
  name: '',
  code: '',
  scope: 'own',
  enabled: true,
  permissions: [],
  notes: '',
})

const permissionOptions = [
  { label: '用户管理', value: 'users.manage' },
  { label: '角色管理', value: 'roles.manage' },
  { label: '店铺密钥', value: 'secrets.manage' },
  { label: '任务管理', value: 'crawler.manage' },
  { label: '商品管理', value: 'products.manage' },
  { label: '店铺管理', value: 'stores.manage' },
  { label: 'AI 管理', value: 'ai.manage' },
]

onMounted(() => {
  if (canManageRoles.value) {
    void loadRoles()
  }
})

async function loadRoles() {
  loading.value = true
  try {
    const result = await api.listRolesPage({ page: currentPage.value, pageSize: pageSize.value })
    roles.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载角色失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.code = ''
  form.scope = 'own'
  form.enabled = true
  form.permissions = []
  form.notes = ''
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(row: RoleDefinition) {
  editingId.value = row.id
  form.name = row.name
  form.code = row.code
  form.scope = row.scope
  form.enabled = row.enabled
  form.permissions = [...row.permissions]
  form.notes = row.notes
  dialogOpen.value = true
}

async function saveRole() {
  if (!form.name.trim() || !form.code.trim()) {
    ElMessage.warning('角色名称和角色编码不能为空')
    return
  }
  saving.value = true
  try {
    await api.saveRole({ ...form, name: form.name.trim(), code: form.code.trim() }, editingId.value ?? undefined)
    await loadRoles()
    dialogOpen.value = false
    ElMessage.success('角色已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存角色失败'))
  } finally {
    saving.value = false
  }
}

async function removeRole(row: RoleDefinition) {
  try {
    await ElMessageBox.confirm(`确认删除角色「${row.name}」？`, '删除角色', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.deleteRole(row.id)
    await loadRoles()
    ElMessage.success('角色已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除角色失败'))
    }
  }
}

function scopeLabel(scope: string) {
  const labels: Record<string, string> = {
    all: '全部数据权限',
    own: '仅本人数据权限',
  }
  return labels[scope] || scope
}

function handlePageSizeChange() {
  resetPage()
  void loadRoles()
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Roles</p>
        <h1>角色管理</h1>
      </div>
      <div v-if="canManageRoles" class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadRoles">
          刷新
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增角色
        </el-button>
      </div>
    </div>

    <el-alert v-if="!canManageRoles" type="warning" :closable="false" show-icon title="当前账号没有角色管理权限。" />

    <section v-else class="work-panel">
      <el-table v-loading="loading" :data="roles" empty-text="暂无角色" height="max(650px, calc(100vh - 230px))">
        <el-table-column prop="id" label="角色编号" width="100" />
        <el-table-column prop="name" label="角色名称" min-width="160" />
        <el-table-column prop="code" label="权限字符" min-width="160" />
        <el-table-column label="数据权限" min-width="150">
          <template #default="{ row }">
            {{ scopeLabel(row.scope) }}
          </template>
        </el-table-column>
        <el-table-column label="权限" min-width="280">
          <template #default="{ row }">
            <el-tag v-for="permission in row.permissions" :key="permission" class="permission-tag" type="info">
              {{ permission }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column class-name="table-action-column" label="操作" width="76" fixed="right">
          <template #default="{ row }">
            <el-button :icon="EditPen" link type="primary" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button :disabled="['superadmin', 'operator'].includes(row.code)" :icon="Delete" link type="danger" @click="removeRole(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="loadRoles"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑角色' : '新增角色'" width="620px">
      <div class="dialog-form">
        <el-input v-model="form.name" placeholder="角色名称" />
        <el-input v-model="form.code" placeholder="权限字符，例如 operator" />
        <el-select v-model="form.scope" placeholder="数据权限">
          <el-option label="全部数据权限" value="all" />
          <el-option label="仅本人数据权限" value="own" />
        </el-select>
        <el-switch v-model="form.enabled" active-text="正常" inactive-text="停用" />
        <el-select v-model="form.permissions" class="full-row" multiple collapse-tags placeholder="菜单权限">
          <el-option v-for="permission in permissionOptions" :key="permission.value" :label="permission.label" :value="permission.value" />
        </el-select>
        <el-input v-model="form.notes" class="full-row" type="textarea" :rows="3" placeholder="备注" />
      </div>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.head-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 26px;
  font-weight: 800;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.permission-tag {
  margin: 2px 4px 2px 0;
}

.dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-row {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .dialog-form {
    grid-template-columns: 1fr;
  }
}
</style>
