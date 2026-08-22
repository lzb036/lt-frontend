<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, Delete, Refresh, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { ListingTask } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import { PAGINATION_PREFERENCE_KEYS } from '../../utils/paginationPreferenceKeys'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const tasks = shallowRef<ListingTask[]>([])
const selectedTasks = shallowRef<ListingTask[]>([])
const retryingTaskId = shallowRef<string | null>(null)
let progressTimer: number | undefined
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination(PAGINATION_PREFERENCE_KEYS.listingTasks)

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
    const result = await api.listListingTasksPage({ page: currentPage.value, pageSize: pageSize.value })
    tasks.value = result.items
    setPageResult(result)
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(toApiErrorMessage(error, '加载上架任务失败'))
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

async function retryTask(row: ListingTask) {
  const isGroup = Boolean(row.isGroup)
  const retryProductCount = retryableProductCount(row)
  const retryLabel = isGroup
    ? `总任务「${row.taskName || row.id}」中的 ${retryProductCount || '全部'} 个异常商品`
    : `上架任务「${row.taskName || row.id}」`
  try {
    await ElMessageBox.confirm(
      isGroup
        ? `确认重试${retryLabel}？已成功商品不会重复上架。`
        : `确认重试${retryLabel}？`,
      isGroup ? '重试总任务异常商品' : '重试上架任务',
      {
        confirmButtonText: '重试',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    retryingTaskId.value = row.id
    if (isGroup) {
      const taskIds = row.childTaskIds || []
      const result = await api.retryListingTaskGroup(taskIds)
      await loadTasks({ silent: true })
      ElMessage.success(
        `已提交 ${result.listingTaskGroup.retryTaskCount} 个分任务，共 ${result.listingTaskGroup.retryProductCount} 个商品等待重试`,
      )
    } else {
      await api.retryListingTask(row.id)
      await loadTasks({ silent: true })
      ElMessage.success('上架任务已加入队列等待重试')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重试上架任务失败'))
    }
  } finally {
    retryingTaskId.value = null
  }
}

async function cancelTask(row: ListingTask) {
  try {
    await ElMessageBox.confirm(
      `确认终止上架任务「${row.taskName || row.id}」？已完成上架的商品不会自动回滚。`,
      '终止上架任务',
      {
        confirmButtonText: '终止',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const result = await api.cancelListingTask(row.id)
    tasks.value = tasks.value.map((task) => (task.id === row.id ? result.listingTask : task))
    ElMessage.success('已请求终止任务')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '终止上架任务失败'))
    }
  }
}

function handleSelectionChange(rows: ListingTask[]) {
  selectedTasks.value = rows
}

function selectedTaskIds() {
  return [...new Set(selectedTasks.value.flatMap((task) => task.childTaskIds?.length ? task.childTaskIds : [task.id]))]
}

async function deleteSelectedTasks() {
  if (selectedTasks.value.length < 1) {
    ElMessage.warning('请选择要删除的任务')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedTaskIds().length} 条上架任务记录？总任务会连同其全部分任务一起删除，该操作不会删除商品数据。`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    loading.value = true
    const result = await api.deleteListingTasks(selectedTaskIds())
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '待执行',
    running: '上架中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    cancelled: '已终止',
  }
  return labels[status] || status
}

function statusType(row: ListingTask) {
  const status = row.status
  if (row.cancelRequested) {
    return 'warning'
  }
  if (status === 'success') {
    return 'success'
  }
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'partial') {
    return 'warning'
  }
  return 'info'
}

function groupTaskRetryable(row: ListingTask): boolean {
  const children = row.children || []
  return (
    children.length > 0
    && children.every((child) => !taskInProgress(child))
    && children.some((child) => taskRetryable(child))
  )
}

function taskRetryable(row: ListingTask): boolean {
  return row.isGroup
    ? groupTaskRetryable(row)
    : (row.status === 'failed' || row.status === 'partial' || row.status === 'cancelled')
}

function taskInProgress(row: ListingTask): boolean {
  return row.status === 'queued' || row.status === 'running'
}

function retryableProductCount(row: ListingTask): number {
  if (row.isGroup) {
    return row.children?.reduce((total, child) => total + retryableProductCount(child), 0) || 0
  }
  if (row.status === 'partial' || row.status === 'failed') {
    return row.failedIds?.length || row.failedCount
  }
  if (row.status === 'cancelled') {
    return row.productIds?.length || row.totalCount
  }
  return 0
}

function taskCancelable(row: ListingTask) {
  return !row.isGroup && (row.status === 'queued' || row.status === 'running') && !row.cancelRequested
}

function taskWaitingCancel(row: ListingTask) {
  return !row.isGroup && (row.status === 'queued' || row.status === 'running') && Boolean(row.cancelRequested)
}

function taskRowClassName({ row }: { row: ListingTask }) {
  return row.isGroup ? 'task-group-row' : ''
}

function displayStatusLabel(row: ListingTask) {
  return row.cancelRequested ? '终止中' : statusLabel(row.status)
}

function listingTaskStoreLabel(row: ListingTask) {
  if (row.stores?.length) {
    return row.stores.map((store) => store.aliasName || store.storeName || store.storeCode || `店铺 ${store.storeId}`).join('、')
  }
  return row.aliasName || row.storeName || row.storeCode || (row.storeId ? `店铺 ${row.storeId}` : '-')
}

function listingTaskStoreCopy(row: ListingTask) {
  if (row.stores?.length) {
    return row.stores
      .map((store) => [store.aliasName, store.storeName, store.storeCode].map((item) => item?.trim()).filter(Boolean).join(' / '))
      .filter(Boolean)
      .join('；')
  }
  const parts = [row.aliasName, row.storeName, row.storeCode]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
  const dedupedParts = [...new Set(parts)]
  return dedupedParts.length > 0 ? dedupedParts.join(' / ') : listingTaskStoreLabel(row)
}

function handlePageSizeChange() {
  resetPage()
  void loadTasks()
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Listing Jobs</p>
        <h1>上架任务</h1>
      </div>
      <div class="page-actions">
        <el-button type="danger" :icon="Delete" :disabled="selectedTasks.length < 1" :loading="loading" @click="deleteSelectedTasks">
          批量删除
        </el-button>
        <el-button :icon="Refresh" :loading="refreshing" @click="refreshTasks">
          刷新
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <el-table
        v-loading="loading"
        :data="tasks"
        empty-text="暂无上架任务"
        height="max(650px, calc(100vh - 230px))"
        row-key="id"
        :tree-props="{ children: 'children' }"
        :indent="20"
        :row-class-name="taskRowClassName"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="52" />
        <el-table-column label="任务名称" min-width="220">
          <template #default="{ row }">
            <div class="task-name-cell">
              <el-tag v-if="row.isGroup" size="small" type="primary" effect="plain">总任务</el-tag>
              <span v-else-if="row.taskGroupIndex && row.taskGroupSize" class="task-part-label">
                分任务 {{ row.taskGroupIndex }}/{{ row.taskGroupSize }}
              </span>
              <CopyableTableText :value="row.taskName" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上架店铺" min-width="150">
          <template #default="{ row }">
            <CopyableTableText :value="listingTaskStoreCopy(row)" :display="listingTaskStoreLabel(row)" always />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row)">
              {{ displayStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCount" label="总数量" width="90" />
        <el-table-column prop="successCount" label="成功数量" width="100" />
        <el-table-column prop="failedCount" label="失败数量" width="100" />
        <el-table-column label="处理结果" min-width="220">
          <template #default="{ row }">
            <CopyableTableText :value="row.message" />
          </template>
        </el-table-column>
        <el-table-column label="失败原因" min-width="220">
          <template #default="{ row }">
            <CopyableTableText :value="row.errorDetail" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="startedAt" label="开始执行时间" min-width="170" />
        <el-table-column prop="finishedAt" label="完成时间" min-width="170" />
        <el-table-column class-name="table-action-column" label="操作" width="120" fixed="right">
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
            <el-button
              v-if="taskRetryable(row)"
              :icon="VideoPlay"
              :loading="retryingTaskId === row.id"
              :disabled="Boolean(retryingTaskId)"
              link
              type="primary"
              @click="retryTask(row)"
            >
              {{ row.isGroup ? '重试异常' : '重试' }}
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

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-actions {
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

.task-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.task-part-label {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 12px;
}

:deep(.task-group-row > td.el-table__cell) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

@media (max-width: 760px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
