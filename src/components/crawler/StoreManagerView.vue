<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection, Delete, EditPen, Plus, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, AvailabilityStatus, UserAccount } from '../../types/crawler'
import type { StoreAccount, StorePayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const verifying = shallowRef(false)
const stores = shallowRef<StoreAccount[]>([])
const users = shallowRef<UserAccount[]>([])
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const selectedOwnerUsername = ref('')
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

const form = reactive<StorePayload>({
  ownerUsername: '',
  aliasName: '',
  platform: 'rakuten',
  enabled: true,
  description: '',
  rakutenServiceSecret: '',
  rakutenLicenseKey: '',
})
const isSuperadmin = computed(() => props.session?.role === 'superadmin')
const childUsers = computed(() => users.value.filter((user) => user.role !== 'superadmin'))
const hasSelectedOwner = computed(() => !isSuperadmin.value || Boolean(selectedOwnerUsername.value))

onMounted(async () => {
  if (isSuperadmin.value) {
    await loadUsers()
  }
  void loadStores()
})

async function loadUsers() {
  try {
    users.value = await api.listUsers()
    if (!selectedOwnerUsername.value) {
      selectedOwnerUsername.value = childUsers.value[0]?.username || ''
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载用户失败'))
  }
}

async function loadStores() {
  if (isSuperadmin.value && !selectedOwnerUsername.value) {
    stores.value = []
    setPageResult({ total: 0, page: 1, pageSize: pageSize.value })
    return
  }
  loading.value = true
  try {
    const result = await api.listStoresPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      ownerUsername: isSuperadmin.value ? selectedOwnerUsername.value : undefined,
    })
    stores.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载店铺失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.ownerUsername = isSuperadmin.value ? selectedOwnerUsername.value : undefined
  form.aliasName = ''
  form.platform = 'rakuten'
  form.enabled = true
  form.description = ''
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
}

function openCreateDialog() {
  if (isSuperadmin.value && !selectedOwnerUsername.value) {
    ElMessage.warning('请先创建并选择子公司用户')
    return
  }
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(row: StoreAccount) {
  editingId.value = row.id
  form.ownerUsername = row.ownerUsername
  form.aliasName = row.aliasName
  form.platform = row.platform
  form.enabled = row.enabled
  form.description = row.description
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
  dialogOpen.value = true
}

async function saveStore() {
  if (isSuperadmin.value && !form.ownerUsername) {
    ElMessage.warning('请选择店铺所属用户')
    return
  }
  if (!editingId.value && (!form.rakutenServiceSecret?.trim() || !form.rakutenLicenseKey?.trim())) {
    ElMessage.warning('新增店铺时必须填写乐天 Secret 和乐天 Key')
    return
  }
  saving.value = true
  try {
    await api.saveStore({ ...form }, editingId.value ?? undefined)
    await loadStores()
    dialogOpen.value = false
    ElMessage.success('店铺已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存店铺失败'))
  } finally {
    saving.value = false
  }
}

async function syncStore(row: StoreAccount) {
  loading.value = true
  try {
    const result = await api.syncStore(row.id, isSuperadmin.value ? row.ownerUsername : undefined)
    await loadStores()
    if (result.store.lastError) {
      ElMessage.warning(result.store.lastError)
    } else {
      ElMessage.success(`同步任务已完成，同步 ${result.syncedCount} 条`)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '商品同步失败'))
  } finally {
    loading.value = false
  }
}

async function checkStoreKeys() {
  if (isSuperadmin.value && !selectedOwnerUsername.value) {
    ElMessage.warning('请先选择子公司用户')
    return
  }
  verifying.value = true
  try {
    const result = await api.verifyStores(isSuperadmin.value ? selectedOwnerUsername.value : undefined)
    await loadStores()
    if (result.summary.error > 0) {
      ElMessage.warning(`密钥检测完成，异常店铺 ${result.summary.error} 个`)
    } else {
      ElMessage.success('密钥检测完成，全部店铺可用')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '密钥检测失败'))
  } finally {
    verifying.value = false
  }
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

async function removeStore(row: StoreAccount) {
  try {
    await ElMessageBox.confirm(`确认删除店铺「${row.storeName}」？`, '删除店铺', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.deleteStore(row.id, isSuperadmin.value ? row.ownerUsername : undefined)
    await loadStores()
    ElMessage.success('店铺已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除店铺失败'))
    }
  }
}

function handlePageSizeChange() {
  resetPage()
  void loadStores()
}

function handleOwnerChange() {
  resetPage()
  void loadStores()
}

function userDisplayName(username: string) {
  const user = users.value.find((item) => item.username === username)
  return user ? `${user.displayName || user.username}（${user.username}）` : username
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Stores</p>
        <h1>店铺信息</h1>
      </div>
      <div class="head-actions">
        <el-select
          v-if="isSuperadmin"
          v-model="selectedOwnerUsername"
          class="owner-select"
          filterable
          placeholder="选择子公司用户"
          @change="handleOwnerChange"
        >
          <el-option
            v-for="user in childUsers"
            :key="user.username"
            :label="user.displayName || user.username"
            :value="user.username"
          />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" :disabled="!hasSelectedOwner" @click="loadStores">
          刷新
        </el-button>
        <el-button :icon="Connection" :loading="verifying" :disabled="!hasSelectedOwner" @click="checkStoreKeys">
          密钥检测
        </el-button>
        <el-button type="primary" :icon="Plus" :disabled="!hasSelectedOwner" @click="openCreateDialog">
          新增店铺
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <el-table v-loading="loading" :data="stores" empty-text="暂无店铺" height="650">
        <el-table-column v-if="isSuperadmin" label="所属用户" min-width="160">
          <template #default="{ row }">
            {{ userDisplayName(row.ownerUsername) }}
          </template>
        </el-table-column>
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
        <el-table-column prop="lastSyncedAt" label="同步时间" min-width="170" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button :icon="Connection" link type="primary" @click="syncStore(row)">
              商品同步
            </el-button>
            <el-button :icon="EditPen" link type="primary" @click="openEditDialog(row)">
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
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="loadStores"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑店铺信息' : '新增店铺信息'" width="760px">
      <div class="dialog-form">
        <el-select v-if="isSuperadmin" v-model="form.ownerUsername" class="full-row" filterable placeholder="选择店铺所属用户" :disabled="Boolean(editingId)">
          <el-option
            v-for="user in childUsers"
            :key="user.username"
            :label="user.displayName || user.username"
            :value="user.username"
          />
        </el-select>
        <el-input v-model="form.aliasName" placeholder="店铺别称" />
        <el-input v-model="form.rakutenServiceSecret" type="password" show-password placeholder="乐天 Secret，留空则不修改" />
        <el-input v-model="form.rakutenLicenseKey" type="password" show-password placeholder="乐天 Key，留空则不修改" />
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        <el-input v-model="form.description" class="full-row" type="textarea" :rows="3" placeholder="店铺介绍" />
      </div>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveStore">保存</el-button>
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
  flex-wrap: wrap;
}

.owner-select {
  width: 220px;
}

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
