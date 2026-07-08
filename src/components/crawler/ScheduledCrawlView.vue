<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, Delete, Refresh, Search, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlTask } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const tasks = shallowRef<CrawlTask[]>([])
const selectedTasks = shallowRef<CrawlTask[]>([])
let progressTimer: number | undefined

const filters = reactive({
  target: '',
  status: '',
  createdAtRange: [] as string[] | null,
})

const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

onMounted(() => {
  void loadTasks()
})

onBeforeUnmount(() => {
  stopProgressPolling()
})

watch(tasks, syncProgressPolling)

async function loadTasks(options: { silent?: boolean } = {}) {
  if (!options.silent) {
    loading.value = true
  }
  try {
    const result = await api.listTasksPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      target: filters.target.trim(),
      status: filters.status,
      sourceType: 'shop',
      mode: 'scheduled',
      createdAtFrom: createdAtFromValue(),
      createdAtTo: createdAtToValue(),
    })
    tasks.value = result.items
    setPageResult(result)
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(toApiErrorMessage(error, '加载定时采集记录失败'))
    }
  } finally {
    if (!options.silent) {
      loading.value = false
    }
  }
}

function hasRunningTask() {
  return tasks.value.some((task) => task.status === 'queued' || task.status === 'running')
}

function syncProgressPolling() {
  if (hasRunningTask()) {
    startProgressPolling()
  } else {
    stopProgressPolling()
  }
}

function startProgressPolling() {
  if (progressTimer) {
    return
  }
  progressTimer = window.setInterval(() => {
    void loadTasks({ silent: true })
  }, 2000)
}

function stopProgressPolling() {
  if (!progressTimer) {
    return
  }
  window.clearInterval(progressTimer)
  progressTimer = undefined
}

async function refreshTasks() {
  refreshing.value = true
  try {
    await withMinimumDelay(loadTasks())
  } finally {
    refreshing.value = false
  }
}

async function restartTask(row: CrawlTask) {
  try {
    await ElMessageBox.confirm(
      `确认重新采集「${row.target || '该任务'}」？`,
      '重新采集',
      {
        confirmButtonText: '重新采集',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const result = await api.restartTask(row.id)
    tasks.value = tasks.value.map((task) => (task.id === row.id ? result.task : task))
    ElMessage.success('重新采集任务已加入队列')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重启任务失败'))
    }
  }
}

async function cancelTask(row: CrawlTask) {
  try {
    await ElMessageBox.confirm(
      `确认终止采集任务「${row.target || '该任务'}」？已处理的数据不会回滚。`,
      '终止采集任务',
      {
        confirmButtonText: '终止',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const result = await api.cancelTask(row.id)
    tasks.value = tasks.value.map((task) => (task.id === row.id ? result.task : task))
    ElMessage.success('已请求终止任务')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '终止任务失败'))
    }
  }
}

function handleSelectionChange(rows: CrawlTask[]) {
  selectedTasks.value = rows
}

async function deleteSelectedTasks() {
  if (selectedTasks.value.length < 1) {
    ElMessage.warning('请选择要删除的任务')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedTasks.value.length} 条定时采集记录？该操作只删除任务记录，不会删除定时计划和商品数据。`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    loading.value = true
    const result = await api.deleteTasks(selectedTasks.value.map((task) => task.id))
    selectedTasks.value = []
    await loadTasks()
    if (result.failedIds.length > 0) {
      ElMessage.warning(`已删除 ${result.deletedCount} 条，${result.failedIds.length} 条删除失败`)
    } else {
      ElMessage.success(`已删除 ${result.deletedCount} 条任务`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '批量删除任务失败'))
    }
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.target = ''
  filters.status = ''
  filters.createdAtRange = []
  resetPage()
  void loadTasks()
}

function searchTasks() {
  resetPage()
  void loadTasks()
}

function createdAtFromValue() {
  const value = filters.createdAtRange?.[0] || ''
  return value ? `${value}T00:00:00` : ''
}

function createdAtToValue() {
  const value = filters.createdAtRange?.[1] || ''
  return value ? `${value}T23:59:59` : ''
}

function taskResultText(row: CrawlTask) {
  const pending = row.status === 'queued' || row.status === 'running'
  return `总 ${taskTotalText(row, pending)} / 成功 ${row.successCount || 0} / 失败 ${row.failedCount || 0} / 警告 ${row.warningCount || 0}`
}

function taskTotalText(row: CrawlTask, pending = false) {
  const total = Number(row.totalCount || 0)
  return total > 0 ? String(total) : pending ? '待获取' : '0'
}

function effectiveTaskStatus(row: CrawlTask) {
  const status = row.status
  if (status === 'queued' || status === 'running' || status === 'cancelled') {
    return status
  }
  const total = Math.max(0, Number(row.totalCount || 0))
  const success = Math.max(0, Number(row.successCount || 0))
  const failed = Math.max(0, Number(row.failedCount || 0))
  if (total > 0 && failed >= total && success === 0) {
    return 'failed'
  }
  if (success > 0 && failed > 0) {
    return 'partial'
  }
  if (failed > 0 && success === 0) {
    return 'failed'
  }
  if (success > 0 && failed === 0) {
    return 'success'
  }
  return status
}

function taskFinished(row: CrawlTask) {
  return row.status !== 'queued' && row.status !== 'running'
}

function taskCancelable(row: CrawlTask) {
  return (row.status === 'queued' || row.status === 'running') && !row.cancelRequested
}

function taskWaitingCancel(row: CrawlTask) {
  return (row.status === 'queued' || row.status === 'running') && Boolean(row.cancelRequested)
}

function statusLabel(row: CrawlTask) {
  if (row.cancelRequested) {
    return '终止中'
  }
  const status = effectiveTaskStatus(row)
  const labels: Record<string, string> = {
    queued: '待执行',
    running: '采集中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    cancelled: '已终止',
  }
  return labels[status] || status
}

function statusType(row: CrawlTask) {
  if (row.cancelRequested) {
    return 'warning'
  }
  const status = effectiveTaskStatus(row)
  if (status === 'success') {
    return 'success'
  }
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'partial') {
    return 'warning'
  }
  if (status === 'cancelled') {
    return 'info'
  }
  return 'info'
}

function handlePageSizeChange() {
  resetPage()
  void loadTasks()
}
</script>

<template>
  <section class="page-stack">
    <div class="head-actions">
      <el-button type="danger" :icon="Delete" :disabled="selectedTasks.length < 1" :loading="loading" @click="deleteSelectedTasks">
        批量删除
      </el-button>
      <el-button :icon="Refresh" :loading="refreshing" @click="refreshTasks">
        刷新
      </el-button>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-input v-model="filters.target" :prefix-icon="Search" clearable placeholder="采集内容" @keydown.enter="searchTasks" />
        <el-select v-model="filters.status" clearable placeholder="采集状态" @change="searchTasks">
          <el-option label="待执行" value="queued" />
          <el-option label="采集中" value="running" />
          <el-option label="成功" value="success" />
          <el-option label="部分成功" value="partial" />
          <el-option label="失败" value="failed" />
          <el-option label="已终止" value="cancelled" />
        </el-select>
        <div class="filter-date-field">
          <el-date-picker
            v-model="filters.createdAtRange"
            class="full-control"
            type="daterange"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="创建开始日期"
            end-placeholder="创建结束日期"
            @change="searchTasks"
          />
        </div>
        <div class="filter-actions">
          <el-button type="primary" :icon="Search" @click="searchTasks">
            搜索
          </el-button>
          <el-button :icon="Delete" @click="resetFilters">
            重置
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="tasks"
        empty-text="暂无定时采集记录"
        height="max(620px, calc(100vh - 300px))"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="52" />
        <el-table-column label="采集内容" min-width="280">
          <template #default="{ row }">
            <CopyableTableText :value="row.target" />
          </template>
        </el-table-column>
        <el-table-column label="采集方式" width="140">
          <template #default>店铺采集</template>
        </el-table-column>
        <el-table-column label="采集状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row)">
              {{ statusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="采集结果" min-width="180">
          <template #default="{ row }">
            {{ taskResultText(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="startedAt" label="开始执行时间" min-width="170" />
        <el-table-column prop="finishedAt" label="完成时间" min-width="170" />
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="taskCancelable(row) || taskWaitingCancel(row)"
              :icon="CircleClose"
              :disabled="taskWaitingCancel(row)"
              link
              type="danger"
              @click="cancelTask(row)"
            >
              {{ taskWaitingCancel(row) ? '终止中' : '终止' }}
            </el-button>
            <el-button v-if="taskFinished(row)" :icon="VideoPlay" link type="primary" @click="restartTask(row)">
              重新采集
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="280">
          <template #default="{ row }">
            <CopyableTableText :value="row.errorDetail" />
          </template>
        </el-table-column>
        <el-table-column label="警告信息" min-width="280">
          <template #default="{ row }">
            <CopyableTableText :value="row.warningDetail" />
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
          @current-change="loadTasks"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.filter-row {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(140px, 160px) minmax(260px, 320px) max-content;
  margin-bottom: 14px;
}

.filter-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.filter-date-field {
  min-width: 0;
}

.filter-date-field :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
}

.full-control {
  width: 100%;
}

@media (max-width: 1120px) {
  .filter-row {
    grid-template-columns: minmax(0, 1fr) minmax(140px, 160px);
  }

  .filter-actions {
    grid-column: 1 / -1;
    justify-self: flex-end;
  }
}

@media (max-width: 760px) {
  .head-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    grid-column: auto;
    justify-self: stretch;
  }

  .filter-actions .el-button {
    flex: 1;
  }
}
</style>
