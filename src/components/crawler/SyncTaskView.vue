<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, Delete, Refresh, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { SyncTask } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import { PAGINATION_PREFERENCE_KEYS } from '../../utils/paginationPreferenceKeys'
import CopyableTableText from './CopyableTableText.vue'

type TaskGroup = 'sync' | 'title_optimization' | 'image_cleanup' | 'listing_image_upload'

const props = withDefaults(defineProps<{
  taskGroup?: TaskGroup
  title?: string
  eyebrow?: string
  emptyText?: string
  actionLabel?: string
}>(), {
  taskGroup: 'sync',
  title: '同步任务',
  eyebrow: 'Sync Jobs',
  emptyText: '暂无同步任务',
  actionLabel: '同步',
})

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const tasks = shallowRef<SyncTask[]>([])
const selectedTasks = shallowRef<SyncTask[]>([])
let progressTimer: number | undefined
let loadRequestId = 0
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination(
  () => ({
    sync: PAGINATION_PREFERENCE_KEYS.syncTasks,
    title_optimization: PAGINATION_PREFERENCE_KEYS.titleOptimizationTasks,
    image_cleanup: PAGINATION_PREFERENCE_KEYS.imageCleanupTasks,
    listing_image_upload: PAGINATION_PREFERENCE_KEYS.listingImageUploadTasks,
  })[props.taskGroup],
)

onMounted(() => {
  void loadTasks()
})

onBeforeUnmount(() => {
  stopProgressPolling()
})

watch(tasks, syncProgressPolling)
watch(
  () => props.taskGroup,
  () => {
    loadRequestId += 1
    stopProgressPolling()
    tasks.value = []
    selectedTasks.value = []
    resetPage()
    void loadTasks()
  },
)

async function loadTasks(options: { silent?: boolean } = {}) {
  const requestId = ++loadRequestId
  const taskGroup = props.taskGroup
  if (!options.silent) {
    loading.value = true
  }
  try {
    const result = await api.listSyncTasksPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      taskGroup,
    })
    if (requestId !== loadRequestId || taskGroup !== props.taskGroup) {
      return
    }
    tasks.value = result.items
    setPageResult(result)
  } catch (error) {
    if (!options.silent && requestId === loadRequestId) {
      ElMessage.error(toApiErrorMessage(error, `加载${props.title}失败`))
    }
  } finally {
    if (!options.silent && requestId === loadRequestId) {
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

function handleSelectionChange(rows: SyncTask[]) {
  selectedTasks.value = rows
}

function selectedTaskIds() {
  return [...new Set(selectedTasks.value.flatMap((task) => task.childTaskIds?.length ? task.childTaskIds : [task.id]))]
}

async function cancelTask(row: SyncTask) {
  try {
    await ElMessageBox.confirm(
      `确认终止${props.actionLabel}任务「${row.taskName || row.id}」？已完成的数据不会回滚。`,
      `终止${props.actionLabel}任务`,
      {
        confirmButtonText: '终止',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const result = await api.cancelSyncTask(row.id)
    tasks.value = tasks.value.map((task) => (task.id === row.id ? result.syncTask : task))
    ElMessage.success('已请求终止任务')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, `终止${props.actionLabel}任务失败`))
    }
  }
}

async function retryTask(row: SyncTask) {
  try {
    await ElMessageBox.confirm(
      `确认重试${props.actionLabel}任务「${row.taskName || row.id}」？`,
      `重试${props.actionLabel}任务`,
      {
        confirmButtonText: '重试',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const result = await api.retrySyncTask(row.id)
    tasks.value = tasks.value.map((task) => (task.id === row.id ? result.syncTask : task))
    ElMessage.success(`${props.actionLabel}任务已加入队列等待重试`)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, `重试${props.actionLabel}任务失败`))
    }
  }
}

async function deleteSelectedTasks() {
  if (selectedTasks.value.length < 1) {
    ElMessage.warning('请选择要删除的任务')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedTaskIds().length} 条${props.actionLabel}任务记录？总任务会连同其全部分任务一起删除，该操作不会删除业务数据。`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    loading.value = true
    const result = await api.deleteSyncTasks(selectedTaskIds())
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
    running: `${props.actionLabel}中`,
    success: '成功',
    partial: '部分成功',
    failed: '失败',
    cancelled: '已终止',
  }
  return labels[status] || status
}

function statusType(row: SyncTask) {
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

function displayStatusLabel(row: SyncTask) {
  return row.cancelRequested ? '终止中' : statusLabel(row.status)
}

function taskCancelable(row: SyncTask) {
  return !row.isGroup && (row.status === 'queued' || row.status === 'running') && !row.cancelRequested
}

function taskWaitingCancel(row: SyncTask) {
  return !row.isGroup && (row.status === 'queued' || row.status === 'running') && Boolean(row.cancelRequested)
}

function taskRetryable(row: SyncTask) {
  return !row.isGroup && ['failed', 'partial', 'cancelled'].includes(row.status)
}

function taskRowClassName({ row }: { row: SyncTask }) {
  return row.isGroup ? 'task-group-row' : ''
}

function taskTypeLabel(task: SyncTask) {
  if (task.taskType === 'title_optimization') {
    return '批量标题优化'
  }
  if (task.taskType === 'listing_status') {
    if (task.taskName.includes('全部上架')) {
      return '全部上架'
    }
    if (task.taskName.includes('全部下架')) {
      return '全部下架'
    }
    return '上下架同步'
  }
  if (task.taskType === 'product_listing_status') {
    if (task.taskName.includes('批量上架')) {
      return '批量上架'
    }
    if (task.taskName.includes('批量下架')) {
      return '批量下架'
    }
    return '批量上下架'
  }
  if (task.taskType === 'product_delete') {
    return '批量删除'
  }
  if (task.taskType === 'deleted_product_image_cleanup') {
    return '删除商品图片'
  }
  if (task.taskType === 'listing_image_upload') {
    return '上架商品图片上传'
  }
  if (task.taskType === 'product_replace') {
    return '商品替换'
  }
  return '商品同步'
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
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
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
        :empty-text="emptyText"
        height="max(650px, calc(100vh - 230px))"
        row-key="id"
        :tree-props="{ children: 'children' }"
        :indent="20"
        :row-class-name="taskRowClassName"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="52" />
        <el-table-column label="任务名称" min-width="230">
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
        <el-table-column v-if="taskGroup === 'sync'" label="任务类型" width="120">
          <template #default="{ row }">
            {{ taskTypeLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column label="店铺" min-width="150">
          <template #default="{ row }">
            <CopyableTableText :value="row.storeName" />
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
        <el-table-column label="失败原因" min-width="220">
          <template #default="{ row }">
            <CopyableTableText :value="row.errorDetail" />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="startedAt" label="开始执行时间" min-width="170" />
        <el-table-column prop="finishedAt" label="完成时间" min-width="170" />
        <el-table-column class-name="table-action-column" label="操作" width="88" fixed="right">
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
            <el-button v-if="taskRetryable(row)" :icon="VideoPlay" link type="primary" @click="retryTask(row)">
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
  padding: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
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
</style>
