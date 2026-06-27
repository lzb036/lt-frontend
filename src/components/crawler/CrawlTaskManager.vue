<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlSource, CrawlTask, CreateTaskPayload, SourceType } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const creating = shallowRef(false)
const sources = shallowRef<CrawlSource[]>([])
const tasks = shallowRef<CrawlTask[]>([])
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

const form = reactive({
  sourceId: null as number | null,
  sourceType: 'keyword' as SourceType,
  target: '',
  mode: 'manual',
})

const selectedSource = computed(() => {
  if (!form.sourceId) {
    return null
  }
  return sources.value.find((source) => source.id === form.sourceId) ?? null
})

const sourceTypeOptions: Array<{ label: string; value: SourceType }> = [
  { label: '关键词', value: 'keyword' },
  { label: '店铺', value: 'shop' },
  { label: '排名', value: 'ranking' },
  { label: '商品 URL', value: 'product_url' },
]

onMounted(() => {
  void refreshAll()
})

async function refreshAll(options: { loadSources?: boolean } = {}) {
  const loadSources = options.loadSources ?? true
  loading.value = true
  try {
    const taskRequest = api.listTasksPage({ page: currentPage.value, pageSize: pageSize.value })
    const [sourceValues, taskValues] = await Promise.all([
      loadSources ? api.listSources() : Promise.resolve(sources.value),
      taskRequest,
    ])
    if (loadSources) {
      sources.value = sourceValues
    }
    tasks.value = taskValues.items
    setPageResult(taskValues)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载任务失败'))
  } finally {
    loading.value = false
  }
}

function handleSourceChange() {
  const source = selectedSource.value
  if (!source) {
    return
  }
  form.sourceType = source.sourceType
  form.target = source.target
}

async function createTask() {
  const payload: CreateTaskPayload = { mode: form.mode }
  if (form.sourceId) {
    payload.sourceId = form.sourceId
  } else {
    if (!form.target.trim()) {
      ElMessage.warning('请选择采集源或填写临时采集目标')
      return
    }
    payload.sourceType = form.sourceType
    payload.target = form.target.trim()
  }
  creating.value = true
  try {
    await api.createTask(payload)
    await refreshAll()
    ElMessage.success('采集任务已创建并执行')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建采集任务失败'))
  } finally {
    creating.value = false
  }
}

function sourceTypeLabel(value: SourceType) {
  return sourceTypeOptions.find((item) => item.value === value)?.label || value
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
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
  void refreshAll({ loadSources: false })
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Tasks</p>
        <h1>采集任务</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="refreshAll">
        刷新
      </el-button>
    </div>

    <section class="work-panel">
      <div class="panel-head">
        <div>
          <h2>创建采集任务</h2>
          <p>可以从已保存采集源执行，也可以临时输入一个采集目标。</p>
        </div>
      </div>

      <div class="task-form">
        <el-select v-model="form.sourceId" clearable filterable placeholder="选择采集源" @change="handleSourceChange">
          <el-option
            v-for="source in sources"
            :key="source.id"
            :label="`${source.name} / ${sourceTypeLabel(source.sourceType)}`"
            :value="source.id"
          />
        </el-select>
        <el-select v-model="form.sourceType" :disabled="Boolean(form.sourceId)">
          <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input
          v-model="form.target"
          :disabled="Boolean(form.sourceId)"
          :prefix-icon="Search"
          placeholder="关键词、店铺 ID、排名关键词或商品 URL"
        />
        <el-button type="primary" :icon="Plus" :loading="creating" @click="createTask">
          执行采集
        </el-button>
      </div>
    </section>

    <section class="work-panel">
      <div class="panel-head">
        <div>
          <h2>任务记录</h2>
          <p>后端同步执行当前任务；规模化时可替换为 Celery/Redis 异步队列。</p>
        </div>
      </div>

      <el-table v-loading="loading" :data="tasks" empty-text="暂无任务" height="560">
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">
            {{ sourceTypeLabel(row.sourceType) }}
          </template>
        </el-table-column>
        <el-table-column prop="target" label="目标" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalCount" label="采集" width="90" />
        <el-table-column prop="successCount" label="保存" width="90" />
        <el-table-column prop="failedCount" label="失败" width="90" />
        <el-table-column prop="message" label="说明" min-width="190" show-overflow-tooltip />
        <el-table-column prop="errorDetail" label="错误" min-width="180" show-overflow-tooltip />
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="refreshAll({ loadSources: false })"
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

.task-form {
  display: grid;
  margin-top: 16px;
  grid-template-columns: minmax(170px, 0.8fr) minmax(130px, 140px) minmax(0, 1.4fr) max-content;
  gap: 12px;
}

@media (max-width: 1080px) {
  .task-form {
    grid-template-columns: minmax(0, 1fr) minmax(130px, 160px);
  }

  .task-form .el-input,
  .task-form .el-button {
    grid-column: 1 / -1;
  }

  .task-form .el-button {
    justify-self: flex-end;
  }
}

@media (max-width: 680px) {
  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .task-form {
    grid-template-columns: 1fr;
  }

  .task-form .el-button {
    justify-self: stretch;
  }
}
</style>
