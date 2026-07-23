<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { DeletedProductImageCleanupRecord } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const records = shallowRef<DeletedProductImageCleanupRecord[]>([])
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
  void loadRecords()
})

async function loadRecords() {
  loading.value = true
  try {
    const result = await api.listDeletedProductImageCleanupsPage({
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    records.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载待清理图片记录失败'))
  } finally {
    loading.value = false
  }
}

function refreshRecords() {
  resetPage()
  void loadRecords()
}

function handlePageSizeChange() {
  resetPage()
  void loadRecords()
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待清理',
    queued: '已创建任务',
    failed: '清理失败',
  }
  return labels[status] || status
}

function statusType(status: string) {
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'queued') {
    return 'warning'
  }
  return 'info'
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">System Settings</p>
        <h1>待清理图片记录</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="refreshRecords">
        刷新
      </el-button>
    </div>

    <section class="work-panel">
      <el-table
        v-loading="loading"
        :data="records"
        empty-text="暂无待清理图片记录"
        height="max(650px, calc(100vh - 230px))"
        row-key="id"
      >
        <el-table-column prop="ownerUsername" label="所属用户" min-width="140" />
        <el-table-column prop="storeName" label="店铺" min-width="150" />
        <el-table-column label="原商品" min-width="180">
          <template #default="{ row }">
            <CopyableTableText :value="row.productCode" />
          </template>
        </el-table-column>
        <el-table-column prop="cabinetImageCount" label="R-Cabinet" width="110" />
        <el-table-column prop="localImageCount" label="本地/OSS" width="100" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步任务" min-width="180">
          <template #default="{ row }">
            <CopyableTableText :value="row.syncTaskId" />
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="220">
          <template #default="{ row }">
            <CopyableTableText :value="row.lastError" />
          </template>
        </el-table-column>
        <el-table-column prop="deletedAt" label="商品删除时间" min-width="170" />
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="loadRecords"
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
  align-items: flex-start;
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

@media (max-width: 760px) {
  .page-head {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
