<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Connection, DataAnalysis, Delete, EditPen, Lock, Plus, Refresh, Shop, User } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, AvailabilityStatus, StoreAccount, StorePayload, UserAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { confirmStoreDeletion } from '../../utils/confirmStoreDeletion'
import CopyableTableText from './CopyableTableText.vue'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const users = shallowRef<UserAccount[]>([])
const createDialogOpen = shallowRef(false)
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
const {
  currentPage: storeCurrentPage,
  pageSize: storePageSize,
  pageSizes: storePageSizes,
  paginationLayout: storePaginationLayout,
  total: storeTotal,
  resetPage: resetStorePage,
  setPageResult: setStorePageResult,
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

const storeDialogOpen = shallowRef(false)
const storeFormDialogOpen = shallowRef(false)
const storeLoading = shallowRef(false)
const storeSaving = shallowRef(false)
const storeVerifying = shallowRef(false)
const storeCountFetching = shallowRef(false)
const storeSyncingId = shallowRef<number | null>(null)
const managedStoreUser = shallowRef<UserAccount | null>(null)
const userStores = shallowRef<StoreAccount[]>([])
const storeEditingId = shallowRef<number | null>(null)
const storeForm = reactive<StorePayload>({
  ownerUsername: '',
  aliasName: '',
  platform: 'rakuten',
  enabled: true,
  description: '',
  rakutenServiceSecret: '',
  rakutenLicenseKey: '',
})
const managedStoreTitle = computed(() => {
  const user = managedStoreUser.value
  return user ? `${user.displayName || user.username}（${user.username}）` : ''
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
    createDialogOpen.value = false
    ElMessage.success('用户已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建用户失败'))
  } finally {
    saving.value = false
  }
}

function openCreateDialog() {
  createForm.username = ''
  createForm.displayName = ''
  createForm.password = ''
  createForm.permissions = ['crawler.manage', 'products.manage', 'stores.manage']
  createDialogOpen.value = true
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

function openStoreDialog(row: UserAccount) {
  if (row.role === 'superadmin') {
    return
  }
  managedStoreUser.value = row
  storeDialogOpen.value = true
  resetStorePage()
  void loadUserStores()
}

async function loadUserStores() {
  if (!managedStoreUser.value) {
    return
  }
  storeLoading.value = true
  try {
    const result = await api.listStoresPage({
      page: storeCurrentPage.value,
      pageSize: storePageSize.value,
      ownerUsername: managedStoreUser.value.username,
    })
    userStores.value = result.items
    setStorePageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载用户店铺失败'))
  } finally {
    storeLoading.value = false
  }
}

function resetStoreForm() {
  storeEditingId.value = null
  storeForm.ownerUsername = managedStoreUser.value?.username || ''
  storeForm.aliasName = ''
  storeForm.platform = 'rakuten'
  storeForm.enabled = true
  storeForm.description = ''
  storeForm.rakutenServiceSecret = ''
  storeForm.rakutenLicenseKey = ''
}

function openStoreCreateDialog() {
  if (!managedStoreUser.value) {
    return
  }
  resetStoreForm()
  storeFormDialogOpen.value = true
}

function openStoreEditDialog(row: StoreAccount) {
  storeEditingId.value = row.id
  storeForm.ownerUsername = row.ownerUsername
  storeForm.aliasName = row.aliasName
  storeForm.platform = row.platform
  storeForm.enabled = row.enabled
  storeForm.description = row.description
  storeForm.rakutenServiceSecret = ''
  storeForm.rakutenLicenseKey = ''
  storeFormDialogOpen.value = true
}

async function saveStore() {
  if (!managedStoreUser.value) {
    return
  }
  const ownerUsername = managedStoreUser.value.username
  if (!storeEditingId.value && (!storeForm.rakutenServiceSecret?.trim() || !storeForm.rakutenLicenseKey?.trim())) {
    ElMessage.warning('新增店铺时必须填写乐天 Secret 和乐天 Key')
    return
  }
  storeSaving.value = true
  try {
    await api.saveStore({ ...storeForm, ownerUsername }, storeEditingId.value ?? undefined)
    await loadUserStores()
    storeFormDialogOpen.value = false
    ElMessage.success('店铺已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存店铺失败'))
  } finally {
    storeSaving.value = false
  }
}

async function syncStore(row: StoreAccount) {
  if (!managedStoreUser.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认为店铺「${row.aliasName || row.storeName || row.storeCode}」创建商品同步任务？`,
      '商品同步确认',
      {
        type: 'warning',
        confirmButtonText: '确认同步',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  storeSyncingId.value = row.id
  try {
    const result = await api.syncStore(row.id, managedStoreUser.value.username)
    await loadUserStores()
    if (result.store.lastError) {
      ElMessage.warning(result.store.lastError)
    } else {
      ElMessage.success('同步任务已创建并加入队列。')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '商品同步失败'))
  } finally {
    storeSyncingId.value = null
  }
}

async function checkStoreKeys() {
  if (!managedStoreUser.value) {
    return
  }
  storeVerifying.value = true
  try {
    const result = await api.verifyStores(managedStoreUser.value.username)
    await loadUserStores()
    if (result.summary.error > 0) {
      ElMessage.warning(`密钥检测完成，异常店铺 ${result.summary.error} 个`)
    } else {
      ElMessage.success('密钥检测完成，全部店铺可用')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '密钥检测失败'))
  } finally {
    storeVerifying.value = false
  }
}

async function refreshStoreCounts() {
  if (!managedStoreUser.value) {
    return
  }
  storeCountFetching.value = true
  try {
    const result = await api.refreshStoreCounts(managedStoreUser.value.username)
    await loadUserStores()
    if (result.summary.error > 0) {
      ElMessage.warning(`数量获取完成，异常店铺 ${result.summary.error} 个`)
    } else {
      ElMessage.success('数量获取完成')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '数量获取失败'))
  } finally {
    storeCountFetching.value = false
  }
}

async function removeStore(row: StoreAccount) {
  if (!managedStoreUser.value) {
    return
  }
  try {
    await confirmStoreDeletion({
      storeName: row.storeName || row.aliasName || row.storeCode,
      ownerLabel: managedStoreTitle.value,
    })
    await api.deleteStore(row.id, managedStoreUser.value.username)
    await loadUserStores()
    ElMessage.success('店铺已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(toApiErrorMessage(error, '删除店铺失败'))
    }
  }
}

function handleStorePageSizeChange() {
  resetStorePage()
  void loadUserStores()
}

function availabilityLabel(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, string> = {
    available: '可用',
    error: '异常',
    unchecked: '未检测',
  }
  return labels[status] ?? '未检测'
}

function availabilityTagType(status: AvailabilityStatus) {
  const tagTypes: Record<AvailabilityStatus, 'success' | 'danger' | 'info'> = {
    available: 'success',
    error: 'danger',
    unchecked: 'info',
  }
  return tagTypes[status] ?? 'info'
}

function countText(value?: number | null) {
  return value == null ? '-' : value.toLocaleString()
}

function timeText(value?: string | null) {
  return value || '-'
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Users</p>
        <h1>用户管理</h1>
      </div>
      <div class="head-actions">
        <el-button
          :icon="Refresh"
          :loading="loading"
          :disabled="!canManageUsers"
          @click="loadUsers"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          :disabled="!canManageUsers"
          @click="openCreateDialog"
        >
          新增用户
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="!canManageUsers"
      type="warning"
      :closable="false"
      show-icon
      title="当前账号没有用户管理权限。"
    />

    <section v-if="canManageUsers" class="work-panel">
      <el-table v-loading="loading" :data="users" empty-text="暂无用户" height="max(520px, calc(100vh - 230px))">
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
        <el-table-column class-name="table-action-column" label="操作" width="290" fixed="right">
          <template #default="{ row }">
            <el-button :disabled="row.role === 'superadmin'" :icon="Shop" link type="primary" @click="openStoreDialog(row)">
              店铺
            </el-button>
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

    <el-dialog v-model="createDialogOpen" title="新增用户" width="620px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" :prefix-icon="User" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="createForm.displayName" placeholder="请输入显示名称" />
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="createForm.password" :prefix-icon="Lock" type="password" show-password placeholder="请输入至少 6 位初始密码" />
        </el-form-item>
        <el-form-item label="功能权限">
          <el-select v-model="createForm.permissions" class="full-control" multiple collapse-tags collapse-tags-tooltip placeholder="分配权限">
            <el-option v-for="permission in permissionOptions" :key="permission.value" :label="permission.label" :value="permission.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createUser">创建</el-button>
      </template>
    </el-dialog>

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

    <el-dialog
      v-model="storeDialogOpen"
      :title="`用户店铺管理 - ${managedStoreTitle}`"
      width="1180px"
      destroy-on-close
    >
      <div class="store-dialog-stack">
        <div class="store-dialog-head">
          <div class="head-actions">
            <el-button :icon="Refresh" :loading="storeLoading" @click="loadUserStores">
              刷新
            </el-button>
            <el-button :icon="Connection" :loading="storeVerifying" @click="checkStoreKeys">
              密钥检测
            </el-button>
            <el-button :icon="DataAnalysis" :loading="storeCountFetching" @click="refreshStoreCounts">
              数量获取
            </el-button>
            <el-button type="primary" :icon="Plus" @click="openStoreCreateDialog">
              新增店铺
            </el-button>
          </div>
        </div>

        <el-table v-loading="storeLoading" :data="userStores" empty-text="暂无店铺" height="460">
          <el-table-column label="店铺编号" min-width="140">
            <template #default="{ row }">
              <CopyableTableText :value="row.storeCode" />
            </template>
          </el-table-column>
          <el-table-column label="店铺名称" min-width="170">
            <template #default="{ row }">
              <CopyableTableText :value="row.storeName" />
            </template>
          </el-table-column>
          <el-table-column label="店铺别称" min-width="150">
            <template #default="{ row }">
              <CopyableTableText :value="row.aliasName" />
            </template>
          </el-table-column>
          <el-table-column label="已用文件夹数" width="130" align="left">
            <template #default="{ row }">
              {{ countText(row.cabinetUsedFolderCount) }}
            </template>
          </el-table-column>
          <el-table-column label="剩余文件夹数" width="130" align="left">
            <template #default="{ row }">
              {{ countText(row.cabinetRemainingFolderCount) }}
            </template>
          </el-table-column>
          <el-table-column label="乐天商品数" min-width="170">
            <template #default="{ row }">
              <div class="store-counts">
                <span>
                  总数：{{ countText(row.rakutenProductTotalCount) }}
                  <span v-if="row.rakutenProductTotalExceedsLimit" class="count-limit-warning">商品数大于10000</span>
                </span>
                <span>已上架：{{ countText(row.rakutenProductListedCount) }}</span>
                <span>未上架：{{ countText(row.rakutenProductUnlistedCount) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="可用性状态" width="120">
            <template #default="{ row }">
              <CopyableTableText :value="row.lastError || ''" :display="availabilityLabel(row.availabilityStatus)" :always="Boolean(row.lastError)">
                <el-tag :type="availabilityTagType(row.availabilityStatus)">
                  {{ availabilityLabel(row.availabilityStatus) }}
                </el-tag>
              </CopyableTableText>
            </template>
          </el-table-column>
          <el-table-column label="启用状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">
                {{ row.enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="检测时间" min-width="170">
            <template #default="{ row }">
              {{ timeText(row.lastCheckedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="商品同步时间" min-width="170">
            <template #default="{ row }">
              {{ timeText(row.lastProductSyncedAt || row.lastSyncedAt) }}
            </template>
          </el-table-column>
          <el-table-column class-name="table-action-column" label="操作" width="230" fixed="right">
            <template #default="{ row }">
              <el-button
                :icon="Connection"
                :loading="storeSyncingId === row.id"
                link
                type="primary"
                @click="syncStore(row)"
              >
                商品同步
              </el-button>
              <el-button :icon="EditPen" link type="primary" @click="openStoreEditDialog(row)">
                编辑
              </el-button>
              <el-button :icon="Delete" link type="danger" @click="removeStore(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-row">
          <el-pagination
            v-model:current-page="storeCurrentPage"
            v-model:page-size="storePageSize"
            :page-sizes="storePageSizes"
            :total="storeTotal"
            :layout="storePaginationLayout"
            @current-change="loadUserStores"
            @size-change="handleStorePageSizeChange"
          />
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="storeFormDialogOpen"
      :title="storeEditingId ? '编辑店铺信息' : '新增店铺信息'"
      width="760px"
      append-to-body
      destroy-on-close
    >
      <div class="dialog-form">
        <el-input v-model="storeForm.aliasName" placeholder="店铺别称" />
        <el-switch v-model="storeForm.enabled" active-text="启用" inactive-text="停用" />
        <el-input v-model="storeForm.rakutenServiceSecret" type="password" show-password placeholder="乐天 Secret，留空则不修改" />
        <el-input v-model="storeForm.rakutenLicenseKey" type="password" show-password placeholder="乐天 Key，留空则不修改" />
        <el-input v-model="storeForm.description" class="full-row" type="textarea" :rows="3" placeholder="店铺介绍" />
      </div>
      <template #footer>
        <el-button @click="storeFormDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="storeSaving" @click="saveStore">保存</el-button>
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
.store-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
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
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.store-dialog-stack {
  display: grid;
  gap: 14px;
}

.store-counts {
  display: grid;
  gap: 2px;
  color: var(--text-main);
  font-size: 12px;
  line-height: 1.45;
}

.count-limit-warning {
  margin-left: 6px;
  color: var(--el-color-danger);
  font-weight: 600;
}

.dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-row,
.full-control {
  width: 100%;
}

.full-row {
  grid-column: 1 / -1;
}

.permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 760px) {
  .page-head,
  .store-dialog-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-actions {
    justify-content: flex-start;
  }

  .dialog-form {
    grid-template-columns: 1fr;
  }
}
</style>
