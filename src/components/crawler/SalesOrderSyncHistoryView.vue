<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { Delete, Refresh, RefreshRight, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  canDeleteSalesOrderSyncRun,
  canRetrySalesOrderSyncRun,
  salesOrderSyncRunNeedsPolling,
  salesOrderSyncStatusLabel,
  salesOrderSyncTaskName,
  salesOrderSyncTriggerLabel,
} from '../../composables/salesOrderSyncHistoryState'
import {
  formatSalesAnalysisDateTime,
  useCollectorApi,
} from '../../composables/useCollectorApi'
import type {
  SalesAnalysisStore,
  SalesOrderSyncGlobalSettings,
  SalesOrderSyncRun,
  SalesOrderSyncRunListParams,
  SalesOrderSyncRunStatus,
  SalesOrderSyncTriggerType,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const POLL_INTERVAL_MS = 2_000
const DEFAULT_SETTINGS: SalesOrderSyncGlobalSettings = {
  enabled: true,
  intervalMinutes: 30,
  successRetentionDays: 30,
}

const api = useCollectorApi()
const route = useRoute()
const runs = shallowRef<SalesOrderSyncRun[]>([])
const stores = shallowRef<SalesAnalysisStore[]>([])
const settings = shallowRef<SalesOrderSyncGlobalSettings>(DEFAULT_SETTINGS)
const loading = shallowRef(false)
const settingsLoading = shallowRef(false)
const retryingRunId = shallowRef('')
const deleting = shallowRef(false)
const selectedRuns = shallowRef<SalesOrderSyncRun[]>([])
const total = shallowRef(0)
const lastRefreshedAt = shallowRef<string | null>(null)
const filters = reactive({
  storeId: initialStoreId(),
  triggerType: '' as SalesOrderSyncTriggerType | '',
  status: '' as SalesOrderSyncRunStatus | '',
  createdAtRange: [] as string[],
  page: 1,
  pageSize: 30,
})

let pollTimer: number | null = null

const hasActiveRuns = computed(() => runs.value.some(salesOrderSyncRunNeedsPolling))
const currentSelectedRuns = computed(() => {
  const selectedIds = new Set(selectedRuns.value.map((run) => run.id))
  return runs.value.filter((run) => selectedIds.has(run.id))
})
const selectedDeletableRuns = computed(() => (
  currentSelectedRuns.value.filter(canDeleteSalesOrderSyncRun)
))

onMounted(async () => {
  await Promise.all([loadSettings(), loadStores(), loadRuns()])
  pollTimer = window.setInterval(() => {
    if (hasActiveRuns.value) {
      void loadRuns(true)
    }
  }, POLL_INTERVAL_MS)
})

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
  }
})

function initialStoreId() {
  const value = Number(route.query.storeId)
  return Number.isInteger(value) && value > 0 ? value : undefined
}

function requestParams(): SalesOrderSyncRunListParams {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(filters.storeId ? { storeId: filters.storeId } : {}),
    ...(filters.triggerType ? { triggerType: filters.triggerType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.createdAtRange[0]
      ? { createdAtFrom: filters.createdAtRange[0] }
      : {}),
    ...(filters.createdAtRange[1]
      ? { createdAtTo: filters.createdAtRange[1] }
      : {}),
  }
}

async function loadSettings() {
  settingsLoading.value = true
  try {
    settings.value = await api.getSalesOrderSyncGlobalSettings()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载订单同步设置失败'))
  } finally {
    settingsLoading.value = false
  }
}

async function loadStores() {
  try {
    const result = await api.listSalesAnalysisStores()
    stores.value = result.stores
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载店铺列表失败'))
  }
}

async function loadRuns(silent = false) {
  if (!silent) {
    loading.value = true
  }
  try {
    const page = await api.listSalesOrderSyncRuns(requestParams())
    runs.value = page.items
    total.value = page.total
    filters.page = page.page
    filters.pageSize = page.pageSize
    lastRefreshedAt.value = new Date().toISOString()
  } catch (error) {
    if (!silent) {
      ElMessage.error(toApiErrorMessage(error, '加载订单获取记录失败'))
    }
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

function applyFilters() {
  filters.page = 1
  void loadRuns()
}

function resetFilters() {
  filters.storeId = undefined
  filters.triggerType = ''
  filters.status = ''
  filters.createdAtRange = []
  filters.page = 1
  void loadRuns()
}

function handleSelectionChange(selection: SalesOrderSyncRun[]) {
  selectedRuns.value = selection
}

async function retryRun(run: SalesOrderSyncRun) {
  if (!canRetrySalesOrderSyncRun(run)) {
    return
  }
  retryingRunId.value = run.id
  try {
    await api.retrySalesOrderSyncRun(run.id)
    ElMessage.success('已创建重试任务')
    await loadRuns(true)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '重试订单同步失败'))
  } finally {
    retryingRunId.value = ''
  }
}

async function deleteSelectedRuns() {
  const deletableRuns = selectedDeletableRuns.value
  if (
    !deletableRuns.length
    || deletableRuns.length !== currentSelectedRuns.value.length
    || currentSelectedRuns.value.length !== selectedRuns.value.length
  ) {
    ElMessage.warning('请选择非运行中的订单获取记录')
    return
  }
  const challenge = `删除 ${deletableRuns.length} 条`
  try {
    await ElMessageBox.prompt(
      `删除历史记录不会删除订单、销量数据或店铺同步状态。请输入“${challenge}”确认。`,
      '删除订单获取记录',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        inputValidator: (value) => value === challenge || `请输入“${challenge}”`,
        type: 'warning',
      },
    )
  } catch {
    return
  }

  deleting.value = true
  try {
    const result = await api.deleteSalesOrderSyncRuns(
      deletableRuns.map((run) => run.id),
    )
    ElMessage.success(`已删除 ${result.deletedCount} 条记录`)
    selectedRuns.value = []
    if (runs.value.length === result.deletedCount && filters.page > 1) {
      filters.page -= 1
    }
    await loadRuns(true)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '删除订单获取记录失败'))
  } finally {
    deleting.value = false
  }
}

function handlePageChange(page: number) {
  filters.page = page
  void loadRuns()
}

function handlePageSizeChange(pageSize: number) {
  filters.pageSize = pageSize
  filters.page = 1
  void loadRuns()
}

function statusType(status: SalesOrderSyncRunStatus) {
  if (status === 'success') return 'success'
  if (status === 'partial') return 'warning'
  if (status === 'failed' || status === 'cancelled') return 'danger'
  if (status === 'running') return 'primary'
  return 'info'
}

function formatDateTime(value?: string | null) {
  return value ? formatSalesAnalysisDateTime(value) : '-'
}

</script>

<template>
  <section class="history-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Task Management</p>
        <h1>订单获取记录</h1>
      </div>
      <div class="head-actions">
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="loadRuns()"
        >
          刷新
        </el-button>
        <el-button
          type="danger"
          plain
          :icon="Delete"
          :loading="deleting"
          :disabled="!selectedDeletableRuns.length"
          @click="deleteSelectedRuns"
        >
          删除所选
        </el-button>
      </div>
    </header>

    <el-descriptions
      v-loading="settingsLoading"
      class="settings-summary"
      :column="4"
      border
    >
      <el-descriptions-item label="自动同步">
        <el-tag :type="settings.enabled ? 'success' : 'info'">
          {{ settings.enabled ? '已启用' : '已停用' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="同步间隔">
        {{ settings.intervalMinutes }} 分钟
      </el-descriptions-item>
      <el-descriptions-item label="成功记录保留">
        {{ settings.successRetentionDays }} 天
      </el-descriptions-item>
      <el-descriptions-item label="最近刷新">
        {{ formatDateTime(lastRefreshedAt) }}
      </el-descriptions-item>
    </el-descriptions>

    <section class="history-workspace">
      <el-form class="filter-bar" inline>
        <el-form-item label="店铺">
          <el-select
            v-model="filters.storeId"
            clearable
            filterable
            placeholder="全部店铺"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="`${store.name}（${store.code}）`"
              :value="store.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="触发方式">
          <el-select v-model="filters.triggerType" clearable placeholder="全部方式">
            <el-option label="自动" value="automatic" />
            <el-option label="手动" value="manual" />
            <el-option label="重试" value="retry" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态">
            <el-option label="排队中" value="queued" />
            <el-option label="运行中" value="running" />
            <el-option label="成功" value="success" />
            <el-option label="部分成功" value="partial" />
            <el-option label="失败" value="failed" />
            <el-option label="已终止" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="filters.createdAtRange"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
          <el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        v-loading="loading"
        :data="runs"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column
          type="selection"
          width="46"
          :selectable="canDeleteSalesOrderSyncRun"
        />
        <el-table-column label="任务名称" min-width="250">
          <template #default="{ row }">
            {{ salesOrderSyncTaskName(row) }}
          </template>
        </el-table-column>
        <el-table-column label="店铺别称" min-width="150">
          <template #default="{ row }">
            {{ row.storeAliasName || row.storeName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="触发方式" width="90">
          <template #default="{ row }">
            {{ salesOrderSyncTriggerLabel(row.triggerType) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="105">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ salesOrderSyncStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalOrderCount" label="订单总数" width="95" />
        <el-table-column prop="newOrderCount" label="新增" width="80" />
        <el-table-column label="错误信息" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.errorDetail || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="155">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="80">
          <template #default="{ row }">
            <el-button
              v-if="canRetrySalesOrderSyncRun(row)"
              link
              type="primary"
              :loading="retryingRunId === row.id"
              @click="retryRun(row)"
            >
              重试
            </el-button>
            <span v-else class="operation-placeholder">-</span>
          </template>
        </el-table-column>
      </el-table>

      <footer class="table-footer">
        <span v-if="hasActiveRuns" class="polling-status">运行中记录每 2 秒自动刷新</span>
        <span v-else />
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :current-page="filters.page"
          :page-size="filters.pageSize"
          :page-sizes="[20, 30, 50, 100]"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </footer>
    </section>
  </section>
</template>

<style scoped>
.history-page {
  display: grid;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
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
}

.head-actions {
  display: flex;
  gap: 10px;
}

.settings-summary,
.history-workspace {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
}

.history-workspace {
  min-width: 0;
  padding: 16px;
}

.filter-bar {
  margin-bottom: 4px;
}

.filter-bar :deep(.el-select) {
  width: 180px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
}

.polling-status,
.operation-placeholder {
  color: var(--text-muted);
  font-size: 12px;
}

@media (max-width: 900px) {
  .page-head,
  .table-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .head-actions {
    flex-wrap: wrap;
  }
}
</style>
