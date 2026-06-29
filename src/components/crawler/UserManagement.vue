<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, EditPen, Lock, Plus, Refresh, User } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, UserAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const users = shallowRef<UserAccount[]>([])
const editDialogOpen = shallowRef(false)
const editingUser = shallowRef<UserAccount | null>(null)
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

const createForm = reactive({
  username: '',
  displayName: '',
  password: '',
  permissions: ['crawler.manage', 'products.manage', 'stores.manage'] as string[],
})

const canManageUsers = computed(() => props.session?.role === 'superadmin')
const permissionOptions = [
  { label: '任务管理', value: 'crawler.manage' },
  { label: '商品管理', value: 'products.manage' },
  { label: '店铺管理', value: 'stores.manage' },
  { label: '系统设置', value: 'settings.manage' },
]

const editForm = reactive({
  displayName: '',
  enabled: true,
  permissions: [] as string[],
})

onMounted(() => {
  if (canManageUsers.value) {
    void loadUsers()
  }
})

async function loadUsers() {
  loading.value = true
  try {
    const result = await api.listUsersPage({ page: currentPage.value, pageSize: pageSize.value })
    users.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载用户失败'))
  } finally {
    loading.value = false
  }
}

async function createUser() {
  if (!createForm.username.trim() || createForm.password.length < 6) {
    ElMessage.warning('请填写用户名和至少 6 位密码')
    return
  }
  saving.value = true
  try {
    await api.createUser({
      username: createForm.username.trim(),
      displayName: createForm.displayName.trim(),
      password: createForm.password,
      permissions: createForm.permissions,
    })
    await loadUsers()
    createForm.username = ''
    createForm.displayName = ''
    createForm.password = ''
    createForm.permissions = ['crawler.manage', 'products.manage', 'stores.manage']
    ElMessage.success('用户已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建用户失败'))
  } finally {
    saving.value = false
  }
}

async function updateEnabled(row: UserAccount, enabled: boolean) {
  try {
    await api.updateUser(row.username, { enabled })
    await loadUsers()
    ElMessage.success(enabled ? '用户已启用' : '用户已停用')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新用户状态失败'))
    await loadUsers()
  }
}

function openEditDialog(row: UserAccount) {
  editingUser.value = row
  editForm.displayName = row.displayName || row.username
  editForm.enabled = row.enabled
  editForm.permissions = [...(row.permissionCodes || [])]
  editDialogOpen.value = true
}

async function saveUserSettings() {
  if (!editingUser.value) {
    return
  }
  saving.value = true
  try {
    await api.updateUser(editingUser.value.username, {
      displayName: editForm.displayName.trim(),
      enabled: editForm.enabled,
      permissions: editForm.permissions,
    })
    await loadUsers()
    editDialogOpen.value = false
    ElMessage.success('用户权限已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存用户失败'))
  } finally {
    saving.value = false
  }
}

async function resetPassword(row: UserAccount) {
  try {
    const value = await ElMessageBox.prompt(`重置 ${row.displayName || row.username} 的密码`, '重置密码', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '至少 6 位',
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码至少 6 位',
    })
    await api.resetPassword(row.username, value.value)
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重置密码失败'))
    }
  }
}

function handlePageSizeChange() {
  resetPage()
  void loadUsers()
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Users</p>
        <h1>用户管理</h1>
      </div>
      <el-button
        :icon="Refresh"
        :loading="loading"
        :disabled="!canManageUsers"
        @click="loadUsers"
      >
        刷新
      </el-button>
    </div>

    <el-alert
      v-if="!canManageUsers"
      type="warning"
      :closable="false"
      show-icon
      title="当前账号没有用户管理权限。"
    />

    <section v-else class="work-panel">
      <div class="panel-head">
        <div>
          <h2>创建子公司用户</h2>
          <p>超级管理员创建用户后，可以为其分配功能权限，并在店铺管理中给该用户添加独立店铺。</p>
        </div>
        <el-tag type="info">店铺独立</el-tag>
      </div>

      <div class="create-row">
        <el-input v-model="createForm.username" :prefix-icon="User" placeholder="用户名" />
        <el-input v-model="createForm.displayName" placeholder="显示名称" />
        <el-input v-model="createForm.password" :prefix-icon="Lock" type="password" show-password placeholder="初始密码" />
        <el-select v-model="createForm.permissions" class="permission-select" multiple collapse-tags collapse-tags-tooltip placeholder="分配权限">
          <el-option v-for="permission in permissionOptions" :key="permission.value" :label="permission.label" :value="permission.value" />
        </el-select>
        <el-button type="primary" :icon="Plus" :loading="saving" @click="createUser">
          创建
        </el-button>
      </div>
    </section>

    <section v-if="canManageUsers" class="work-panel">
      <div class="panel-head">
        <div>
          <h2>账号列表</h2>
          <p>账号启停不影响各用户已保存的独立配置。</p>
        </div>
      </div>
      <el-table v-loading="loading" :data="users" empty-text="暂无用户" height="520">
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column prop="displayName" label="显示名称" min-width="160" />
        <el-table-column label="权限" min-width="260">
          <template #default="{ row }">
            <div class="permission-tags">
              <el-tag v-if="row.role === 'superadmin'" type="warning">全部权限</el-tag>
              <template v-else>
                <el-tag v-for="permission in row.permissionCodes" :key="permission" type="info">
                  {{ permissionOptions.find((item) => item.value === permission)?.label || permission }}
                </el-tag>
              </template>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :disabled="row.role === 'superadmin'"
              active-text="启用"
              inactive-text="停用"
              @change="updateEnabled(row, Boolean($event))"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button :disabled="row.role === 'superadmin'" :icon="EditPen" link type="primary" @click="openEditDialog(row)">
              权限
            </el-button>
            <el-button :icon="CircleCheck" link type="primary" @click="resetPassword(row)">
              重置密码
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
          @current-change="loadUsers"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="editDialogOpen" title="用户权限设置" width="560px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="显示名称">
          <el-input v-model="editForm.displayName" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="editForm.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="功能权限">
          <el-select v-model="editForm.permissions" class="full-control" multiple collapse-tags collapse-tags-tooltip placeholder="分配权限">
            <el-option v-for="permission in permissionOptions" :key="permission.value" :label="permission.label" :value="permission.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUserSettings">保存</el-button>
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
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1,
.panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.panel-head h2 {
  font-size: 17px;
}

.panel-head p {
  margin: 5px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.create-row {
  display: grid;
  margin-top: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr)) max-content;
  gap: 12px;
}

.permission-select,
.full-control {
  width: 100%;
}

.permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 1120px) {
  .create-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .create-row .el-button {
    grid-column: 1 / -1;
    justify-self: flex-end;
  }
}

@media (max-width: 760px) {
  .create-row {
    grid-template-columns: 1fr;
  }

  .create-row .el-button {
    grid-column: auto;
    justify-self: stretch;
  }

  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
