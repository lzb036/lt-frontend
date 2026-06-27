<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { SyncTask } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const tasks = shallowRef<SyncTask[]>([])
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

async function loadTasks() {
  loading.value = true
  try {
    const result = await api.listSyncTasksPage({ page: currentPage.value, pageSize: pageSize.value })
    tasks.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载同步任务失败'))
  } finally {
    loading.value = false
  }
}

async function retryTask(row: SyncTask) {
  loading.value = true
  try {
    await api.retrySyncTask(row.id)
    await loadTasks()
    ElMessage.success('同步任务已重试')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '重试同步任务失败'))
  } finally {
    loading.value = false
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '待执行',
    running: '同步中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
  }
  return labels[status] || status
}

function statusType(status: string) {
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

function handlePageSizeChange() {
  resetPage()
  void loadTasks()
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Sync Jobs</p>
        <h1>同步任务</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadTasks">
        刷新
      </el-button>
    </div>

    <section class="work-panel">
      <el-table v-loading="loading" :data="tasks" empty-text="暂无同步任务" height="650">
        <el-table-column label="任务名称" min-width="230">
          <template #default="{ row }">
            <CopyableTableText :value="row.taskName" />
          </template>
        </el-table-column>
        <el-table-column label="店铺" min-width="150">
          <template #default="{ row }">
            <CopyableTableText :value="row.storeName" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ statusLabel(row.status) }}
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
        <el-table-column label="操作" width="118" fixed="right">
          <template #default="{ row }">
            <el-button :icon="VideoPlay" link type="primary" @click="retryTask(row)">
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
</style>
