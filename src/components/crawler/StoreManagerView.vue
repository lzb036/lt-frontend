<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection, DataAnalysis, Delete, EditPen, Plus, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, AvailabilityStatus, StoreAccount, StorePayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { confirmStoreDeletion } from '../../utils/confirmStoreDeletion'
import CopyableTableText from './CopyableTableText.vue'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const verifying = shallowRef(false)
const verifyingId = shallowRef<number | null>(null)
const countFetching = shallowRef(false)
const countFetchingId = shallowRef<number | null>(null)
const syncingId = shallowRef<number | null>(null)
const stores = shallowRef<StoreAccount[]>([])
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
const operationColumnWidth = computed(() => (isSuperadmin.value ? 450 : 320))

onMounted(() => {
  void loadStores()
})

async function loadStores() {
  loading.value = true
  try {
    const result = await api.listStoresPage({
      page: currentPage.value,
      pageSize: pageSize.value,
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
  form.ownerUsername = undefined
  form.aliasName = ''
  form.platform = 'rakuten'
  form.enabled = true
  form.description = ''
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
}

function openCreateDialog() {
  if (!isSuperadmin.value) {
    return
  }
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(row: StoreAccount) {
  if (!isSuperadmin.value) {
    return
  }
  editingId.value = row.id
  form.ownerUsername = undefined
  form.aliasName = row.aliasName
  form.platform = row.platform
  form.enabled = row.enabled
  form.description = row.description
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
  dialogOpen.value = true
}

async function saveStore() {
  if (!isSuperadmin.value) {
    return
  }
  if (!editingId.value && (!form.rakutenServiceSecret?.trim() || !form.rakutenLicenseKey?.trim())) {
    ElMessage.warning('新增店铺时必须填写乐天 Secret 和乐天 Key')
    return
  }
  saving.value = true
  try {
    await api.saveStore({ ...form, ownerUsername: undefined }, editingId.value ?? undefined)
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
  syncingId.value = row.id
  try {
    const result = await api.syncStore(row.id)
    await loadStores()
    if (result.store.lastError) {
      ElMessage.warning(result.store.lastError)
    } else {
      ElMessage.success('同步任务已创建并加入队列。')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '商品同步失败'))
  } finally {
    syncingId.value = null
  }
}

async function checkStoreKeys() {
  verifying.value = true
  try {
    const result = await api.verifyStores()
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

async function refreshStoreCounts() {
  countFetching.value = true
  try {
    const result = await api.refreshStoreCounts()
    await loadStores()
    if (result.summary.error > 0) {
      ElMessage.warning(`数量获取完成，异常店铺 ${result.summary.error} 个`)
    } else {
      ElMessage.success('数量获取完成')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '数量获取失败'))
  } finally {
    countFetching.value = false
  }
}

async function checkSingleStoreKeys(row: StoreAccount) {
  verifyingId.value = row.id
  try {
    const result = await api.verifyStore(row.id)
    stores.value = stores.value.map((store) => (store.id === result.id ? result : store))
    if (result.lastError) {
      ElMessage.warning(`店铺「${result.aliasName || result.storeName || result.storeCode}」密钥检测异常`)
    } else {
      ElMessage.success(`店铺「${result.aliasName || result.storeName || result.storeCode}」密钥检测完成`)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '店铺密钥检测失败'))
  } finally {
    verifyingId.value = null
  }
}

async function refreshSingleStoreCounts(row: StoreAccount) {
  countFetchingId.value = row.id
  try {
    const result = await api.refreshStoreCount(row.id)
    stores.value = stores.value.map((store) => (store.id === result.id ? result : store))
    if (result.lastError) {
      ElMessage.warning(`店铺「${result.aliasName || result.storeName || result.storeCode}」数量获取异常`)
    } else {
      ElMessage.success(`店铺「${result.aliasName || result.storeName || result.storeCode}」数量获取完成`)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '店铺数量获取失败'))
  } finally {
    countFetchingId.value = null
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

function timeText(value?: string | null) {
  return value || '-'
}

function handlePageSizeChange() {
  resetPage()
  void loadStores()
}

async function removeStore(row: StoreAccount) {
  if (!isSuperadmin.value) {
    return
  }
  try {
    await confirmStoreDeletion({
      storeName: row.storeName || row.aliasName || row.storeCode,
    })
    await api.deleteStore(row.id)
    await loadStores()
    ElMessage.success('店铺已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(toApiErrorMessage(error, '删除店铺失败'))
    }
  }
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
        <el-button :icon="Refresh" :loading="loading" @click="loadStores">
          刷新
        </el-button>
        <el-button :icon="Connection" :loading="verifying" @click="checkStoreKeys">
          密钥检测
        </el-button>
        <el-button :icon="DataAnalysis" :loading="countFetching" @click="refreshStoreCounts">
          数量获取
        </el-button>
        <el-button v-if="isSuperadmin" type="primary" :icon="Plus" @click="openCreateDialog">
          新增店铺
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <el-table v-loading="loading" :data="stores" empty-text="暂无店铺" height="max(650px, calc(100vh - 230px))">
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
        <el-table-column class-name="table-action-column" label="操作" :width="operationColumnWidth" fixed="right">
          <template #default="{ row }">
            <el-button
              :icon="Connection"
              :loading="verifyingId === row.id"
              link
              type="primary"
              @click="checkSingleStoreKeys(row)"
            >
              密钥检测
            </el-button>
            <el-button
              :icon="DataAnalysis"
              :loading="countFetchingId === row.id"
              link
              type="primary"
              @click="refreshSingleStoreCounts(row)"
            >
              数量获取
            </el-button>
            <el-button
              :icon="Connection"
              :loading="syncingId === row.id"
              link
              type="primary"
              @click="syncStore(row)"
            >
              商品同步
            </el-button>
            <template v-if="isSuperadmin">
              <el-button :icon="EditPen" link type="primary" @click="openEditDialog(row)">
                编辑
              </el-button>
              <el-button :icon="Delete" link type="danger" @click="removeStore(row)">
                删除
              </el-button>
            </template>
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
        <el-input v-model="form.aliasName" placeholder="店铺别称" />
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        <el-input v-model="form.rakutenServiceSecret" type="password" show-password placeholder="乐天 Secret，留空则不修改" />
        <el-input v-model="form.rakutenLicenseKey" type="password" show-password placeholder="乐天 Key，留空则不修改" />
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

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-left: auto;
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

.full-row {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: flex-start;
    flex-direction: column;
    margin-left: 0;
  }

  .dialog-form {
    grid-template-columns: 1fr;
  }
}
</style>
