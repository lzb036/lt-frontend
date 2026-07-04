<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, Delete, Refresh, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { ListingTask } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const tasks = shallowRef<ListingTask[]>([])
const selectedTasks = shallowRef<ListingTask[]>([])
let progressTimer: number | undefined
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
  try {
    await ElMessageBox.confirm(
      `确认重试上架任务「${row.taskName || row.id}」？`,
      '重试上架任务',
      {
        confirmButtonText: '重试',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const result = await api.retryListingTask(row.id)
    tasks.value = tasks.value.map((task) => (task.id === row.id ? result.listingTask : task))
    ElMessage.success('上架任务已提交后台重试')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重试上架任务失败'))
    }
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

async function deleteSelectedTasks() {
  if (selectedTasks.value.length < 1) {
    ElMessage.warning('请选择要删除的任务')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedTasks.value.length} 条上架任务？该操作只删除任务记录，不会删除商品数据。`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    loading.value = true
    const result = await api.deleteListingTasks(selectedTasks.value.map((task) => task.id))
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

function taskFinished(row: ListingTask) {
  return row.status !== 'queued' && row.status !== 'running'
}

function taskCancelable(row: ListingTask) {
  return (row.status === 'queued' || row.status === 'running') && !row.cancelRequested
}

function taskWaitingCancel(row: ListingTask) {
  return (row.status === 'queued' || row.status === 'running') && Boolean(row.cancelRequested)
}

function displayStatusLabel(row: ListingTask) {
  return row.cancelRequested ? '终止中' : statusLabel(row.status)
}

function listingTaskStoreLabel(row: ListingTask) {
  return row.aliasName || row.storeName || row.storeCode || (row.storeId ? `店铺 ${row.storeId}` : '-')
}

function listingTaskStoreCopy(row: ListingTask) {
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
        height="650"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="52" />
        <el-table-column label="任务名称" min-width="220">
          <template #default="{ row }">
            <CopyableTableText :value="row.taskName" />
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
        <el-table-column label="错误信息" min-width="180">
          <template #default="{ row }">
            <CopyableTableText :value="row.errorDetail" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="finishedAt" label="完成时间" min-width="170" />
        <el-table-column label="操作" width="128" fixed="right">
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
            <el-button v-if="taskFinished(row)" :icon="VideoPlay" link type="primary" @click="retryTask(row)">
              重试
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

@media (max-width: 760px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
