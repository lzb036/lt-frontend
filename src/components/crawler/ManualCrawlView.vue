<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, Refresh, Search, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useClientPagination } from '../../composables/useClientPagination'
import type { CrawlTask, CreateTaskPayload, SourceType } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const creating = shallowRef(false)
const tasks = shallowRef<CrawlTask[]>([])

const filters = reactive({
  target: '',
  status: '',
  sourceType: '' as SourceType | '',
})

const form = reactive({
  sourceType: 'product_url' as SourceType,
  target: '',
})

const filteredTasks = computed(() => tasks.value.filter((task) => {
  const targetMatched = !filters.target || task.target.includes(filters.target)
  const statusMatched = !filters.status || task.status === filters.status
  const typeMatched = !filters.sourceType || task.sourceType === filters.sourceType
  return targetMatched && statusMatched && typeMatched
}))
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  pagedItems: pagedTasks,
} = useClientPagination(filteredTasks)

const sourceTypeOptions: Array<{ label: string; value: SourceType }> = [
  { label: '乐天搜索', value: 'keyword' },
  { label: '采集店铺', value: 'shop' },
  { label: '排行榜', value: 'ranking' },
  { label: '采集商品地址/ID', value: 'product_url' },
]

onMounted(() => {
  void loadTasks()
})

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = await api.listTasks()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载手动采集任务失败'))
  } finally {
    loading.value = false
  }
}

async function createTask() {
  if (!form.target.trim()) {
    ElMessage.warning('采集内容不能为空')
    return
  }
  creating.value = true
  try {
    const payload: CreateTaskPayload = {
      sourceType: form.sourceType,
      target: form.target.trim(),
      mode: 'manual',
    }
    const result = await api.createTask(payload)
    tasks.value = result.tasks
    form.target = ''
    ElMessage.success('采集任务已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建采集任务失败'))
  } finally {
    creating.value = false
  }
}

async function restartTask(row: CrawlTask) {
  loading.value = true
  try {
    const result = await api.restartTask(row.id)
    tasks.value = result.tasks
    ElMessage.success('任务已重新执行')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '重启任务失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.target = ''
  filters.status = ''
  filters.sourceType = ''
}

function sourceTypeLabel(value: SourceType) {
  return sourceTypeOptions.find((item) => item.value === value)?.label || value
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '待执行',
    running: '采集中',
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
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Manual Jobs</p>
        <h1>手动采集</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadTasks">
        刷新
      </el-button>
    </div>

    <section class="work-panel">
      <div class="panel-head">
        <div>
          <h2>新增采集任务</h2>
          <p>支持乐天搜索、店铺、排行榜和单个商品地址采集，采集完成后进入待审核商品。</p>
        </div>
      </div>
      <div class="create-row">
        <el-select v-model="form.sourceType" placeholder="采集条件">
          <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="form.target" :prefix-icon="Search" placeholder="采集内容：关键词、店铺ID、商品URL或商品ID" @keydown.enter="createTask" />
        <el-button type="primary" :icon="Plus" :loading="creating" @click="createTask">
          新增采集任务
        </el-button>
      </div>
    </section>

    <section class="work-panel">
      <div class="filter-row">
        <el-input v-model="filters.target" :prefix-icon="Search" clearable placeholder="采集内容" />
        <el-select v-model="filters.status" clearable placeholder="采集状态">
          <el-option label="待执行" value="queued" />
          <el-option label="采集中" value="running" />
          <el-option label="成功" value="success" />
          <el-option label="部分成功" value="partial" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-select v-model="filters.sourceType" clearable placeholder="采集条件">
          <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button :icon="Delete" @click="resetFilters">
          重置
        </el-button>
      </div>

      <el-table v-loading="loading" :data="pagedTasks" empty-text="暂无手动采集任务" height="620">
        <el-table-column prop="ownerUsername" label="租户编码" width="140" />
        <el-table-column label="采集内容" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.target }}
          </template>
        </el-table-column>
        <el-table-column label="采集条件" width="140">
          <template #default="{ row }">
            {{ sourceTypeLabel(row.sourceType) }}
          </template>
        </el-table-column>
        <el-table-column label="采集状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCount" label="总数量" width="90" />
        <el-table-column prop="successCount" label="成功数量" width="100" />
        <el-table-column prop="failedCount" label="失败数量" width="100" />
        <el-table-column prop="createdAt" label="任务创建时间" min-width="170" />
        <el-table-column prop="message" label="说明" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="118" fixed="right">
          <template #default="{ row }">
            <el-button :icon="VideoPlay" link type="primary" @click="restartTask(row)">
              重新采集
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
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.panel-head {
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

.page-head h1,
.panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.panel-head h2 {
  font-size: 17px;
}

.panel-head p {
  margin: 5px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.create-row,
.filter-row {
  display: grid;
  gap: 12px;
}

.create-row {
  margin-top: 16px;
  grid-template-columns: 220px minmax(280px, 1fr) auto;
}

.filter-row {
  margin-bottom: 14px;
  grid-template-columns: minmax(240px, 1fr) 170px 190px auto;
}

@media (max-width: 980px) {
  .create-row,
  .filter-row {
    grid-template-columns: 1fr;
  }

  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
