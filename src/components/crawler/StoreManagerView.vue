<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection, Delete, EditPen, Plus, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useClientPagination } from '../../composables/useClientPagination'
import type { AvailabilityStatus } from '../../types/crawler'
import type { StoreAccount, StorePayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const stores = shallowRef<StoreAccount[]>([])
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  pagedItems: pagedStores,
} = useClientPagination(stores)

const form = reactive<StorePayload>({
  aliasName: '',
  platform: 'rakuten',
  enabled: true,
  description: '',
  rakutenServiceSecret: '',
  rakutenLicenseKey: '',
})

onMounted(() => {
  void loadStores()
})

async function loadStores() {
  loading.value = true
  try {
    stores.value = await api.listStores()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载店铺失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.aliasName = ''
  form.platform = 'rakuten'
  form.enabled = true
  form.description = ''
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(row: StoreAccount) {
  editingId.value = row.id
  form.aliasName = row.aliasName
  form.platform = row.platform
  form.enabled = row.enabled
  form.description = row.description
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
  dialogOpen.value = true
}

async function saveStore() {
  if (!editingId.value && (!form.rakutenServiceSecret?.trim() || !form.rakutenLicenseKey?.trim())) {
    ElMessage.warning('新增店铺时必须填写乐天 Secret 和乐天 Key')
    return
  }
  saving.value = true
  try {
    const result = await api.saveStore({ ...form }, editingId.value ?? undefined)
    stores.value = result.stores
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
    const result = await api.syncStore(row.id)
    stores.value = result.stores
    if (result.store.lastError) {
      ElMessage.warning(result.store.lastError)
    } else {
      ElMessage.success(`商品已更新，同步 ${result.syncedCount} 条`)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新商品失败'))
  } finally {
    loading.value = false
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

async function removeStore(row: StoreAccount) {
  try {
    await ElMessageBox.confirm(`确认删除店铺「${row.storeName}」？`, '删除店铺', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    stores.value = await api.deleteStore(row.id)
    ElMessage.success('店铺已删除')
  } catch (error) {
    if (error !== 'cancel') {
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
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增店铺
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <el-table v-loading="loading" :data="pagedStores" empty-text="暂无店铺" height="650">
        <el-table-column prop="storeCode" label="店铺编号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="storeName" label="店铺名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="aliasName" label="店铺别称" min-width="150" show-overflow-tooltip />
        <el-table-column label="可用性状态" width="120">
          <template #default="{ row }">
            <el-tag :type="availabilityTagType(row.availabilityStatus)" :title="row.lastError || ''">
              {{ availabilityLabel(row.availabilityStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="启用状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastSyncedAt" label="更新时间" min-width="170" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button :icon="Connection" link type="primary" @click="syncStore(row)">
              更新商品
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
        />
      </div>
    </section>

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑店铺信息' : '新增店铺信息'" width="760px">
      <div class="dialog-form">
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
