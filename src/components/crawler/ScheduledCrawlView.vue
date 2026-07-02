<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh, Search, View, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlLimit, CrawlTask, RankingPeriod, ScheduledCrawl, ScheduledCrawlPayload } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const scheduleLoading = shallowRef(false)
const saving = shallowRef(false)
const dialogOpen = ref(false)
const schedulesDialogOpen = ref(false)
const editingId = ref<number | null>(null)
const tasks = shallowRef<CrawlTask[]>([])
const schedules = shallowRef<ScheduledCrawl[]>([])
const selectedTasks = shallowRef<CrawlTask[]>([])
let progressTimer: number | undefined

const rankingPeriodOptions: Array<{ label: string; value: RankingPeriod }> = [
  { label: '实时', value: 'realtime' },
  { label: '日榜', value: 'daily' },
  { label: '周榜', value: 'weekly' },
  { label: '月榜', value: 'monthly' },
]

const filters = reactive({
  target: '',
  status: '',
  createdAtRange: [] as string[] | null,
})

const form = reactive<ScheduledCrawlPayload>({
  sourceId: null,
  name: '',
  crawlContent: '',
  crawlCondition: '',
  sourceType: 'shop',
  target: '',
  rankingPeriod: 'daily',
  crawlLimit: 'all',
  enabled: true,
  intervalMinutes: 1440,
  scheduleTime: '09:00',
  notes: '',
})

const crawlLimitForm = reactive({
  mode: 'all' as 'all' | 'custom',
  count: 30,
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
  void refreshAll()
})

onBeforeUnmount(() => {
  stopProgressPolling()
})

watch(tasks, syncProgressPolling)

async function refreshAll() {
  await Promise.all([loadTasks(), loadSchedules()])
}

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

async function loadSchedules() {
  scheduleLoading.value = true
  try {
    const result = await api.listSchedulesPage({ page: 1, pageSize: 500 })
    schedules.value = result.items
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载定时任务失败'))
  } finally {
    scheduleLoading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.sourceId = null
  form.name = ''
  form.crawlContent = ''
  form.crawlCondition = ''
  form.sourceType = 'shop'
  form.target = ''
  form.rankingPeriod = 'daily'
  form.crawlLimit = 'all'
  crawlLimitForm.mode = 'all'
  crawlLimitForm.count = 30
  form.enabled = true
  form.intervalMinutes = 1440
  form.scheduleTime = '09:00'
  form.notes = ''
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function openSchedulesDialog() {
  schedulesDialogOpen.value = true
  void loadSchedules()
}

function openEditDialog(row: ScheduledCrawl) {
  editingId.value = row.id
  form.sourceId = null
  form.name = row.name
  form.crawlContent = row.crawlContent
  form.crawlCondition = row.crawlCondition
  form.sourceType = 'shop'
  form.target = row.crawlContent || normalizeScheduleTarget(row.target)
  form.rankingPeriod = rankingPeriodFromTarget(row.target)
  form.crawlLimit = crawlLimitFromTarget(row.target)
  setCrawlLimitForm(form.crawlLimit)
  form.enabled = row.enabled
  form.intervalMinutes = 1440
  form.scheduleTime = row.scheduleTime || '09:00'
  form.notes = ''
  dialogOpen.value = true
}

function normalizeScheduleTarget(value: string) {
  return String(value || '').replace(/^店铺[:：]/, '').replace(/\s+(实时|日榜|周榜|月榜)(?:\s+(?:全部|全量|前\s*[0-9]{1,3}))?$/, '').trim()
}

function rankingPeriodFromTarget(value: string): RankingPeriod {
  const target = String(value || '')
  if (/\s实时\s/.test(target)) {
    return 'realtime'
  }
  if (/\s周榜\s/.test(target)) {
    return 'weekly'
  }
  if (/\s月榜\s/.test(target)) {
    return 'monthly'
  }
  return 'daily'
}

function rankingPeriodLabel(value: RankingPeriod) {
  return rankingPeriodOptions.find((item) => item.value === value)?.label || '日榜'
}

function crawlLimitFromTarget(value: string): CrawlLimit {
  const target = String(value || '')
  if (/\s(?:全部|全量)\s*$/.test(target)) {
    return 'all'
  }
  const match = target.match(/\s前\s*([0-9]{1,5})\s*$/)
  if (!match) {
    return 'all'
  }
  return Math.max(1, Number(match[1]))
}

function crawlLimitLabel(value: CrawlLimit | null | undefined) {
  return value === 'all' || value === null || value === undefined ? '全部' : `前${value}个`
}

function setCrawlLimitForm(value: CrawlLimit | null | undefined) {
  if (value === 'all' || value === null || value === undefined) {
    crawlLimitForm.mode = 'all'
    crawlLimitForm.count = 30
    return
  }
  crawlLimitForm.mode = 'custom'
  crawlLimitForm.count = Math.max(1, Math.floor(Number(value || 1)))
}

function currentCrawlLimit(): CrawlLimit {
  return crawlLimitForm.mode === 'all' ? 'all' : Math.max(1, Math.floor(Number(crawlLimitForm.count || 1)))
}

async function saveSchedule() {
  if (!form.name.trim() || !form.target.trim()) {
    ElMessage.warning('请填写任务名称和店铺信息')
    return
  }
  if (!form.scheduleTime) {
    ElMessage.warning('请选择每天执行时间')
    return
  }
  saving.value = true
  try {
    await api.saveSchedule({
      ...form,
      name: form.name.trim(),
      target: form.target.trim(),
      sourceType: 'shop',
      rankingPeriod: form.rankingPeriod,
      crawlLimit: currentCrawlLimit(),
      intervalMinutes: 1440,
      crawlContent: form.target.trim(),
      crawlCondition: '店铺采集',
      notes: '',
    }, editingId.value ?? undefined)
    await refreshAll()
    dialogOpen.value = false
    ElMessage.success('定时采集已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存定时采集失败'))
  } finally {
    saving.value = false
  }
}

async function runSchedule(row: ScheduledCrawl) {
  scheduleLoading.value = true
  try {
    await api.runSchedule(row.id)
    await refreshAll()
    ElMessage.success('定时任务已执行一次')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '执行定时任务失败'))
  } finally {
    scheduleLoading.value = false
  }
}

async function removeSchedule(row: ScheduledCrawl) {
  try {
    await ElMessageBox.confirm(`确认删除定时采集「${row.name}」？`, '删除定时采集', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.deleteSchedule(row.id)
    await refreshAll()
    ElMessage.success('定时采集已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除定时采集失败'))
    }
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
    ElMessage.success('重新采集任务已提交后台执行')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重启任务失败'))
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
  if (status === 'queued' || status === 'running') {
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

function statusLabel(row: CrawlTask) {
  const status = effectiveTaskStatus(row)
  const labels: Record<string, string> = {
    queued: '待执行',
    running: '采集中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
  }
  return labels[status] || status
}

function statusType(row: CrawlTask) {
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
  return 'info'
}

function scheduleStatusLabel(row: ScheduledCrawl) {
  if (!row.enabled) {
    return '未启用'
  }
  const labels: Record<string, string> = {
    idle: '已启用',
    running: '执行中',
    disabled: '未启用',
    failed: '失败',
  }
  return labels[row.status] || row.status
}

function scheduleStatusType(row: ScheduledCrawl) {
  if (!row.enabled || row.status === 'disabled') {
    return 'info'
  }
  if (row.status === 'failed') {
    return 'danger'
  }
  if (row.status === 'running') {
    return 'warning'
  }
  return 'success'
}

function handlePageSizeChange() {
  resetPage()
  void loadTasks()
}
</script>

<template>
  <section class="page-stack">
    <div class="head-actions">
      <el-button :icon="View" @click="openSchedulesDialog">
        查看定时任务
      </el-button>
      <el-button type="danger" :icon="Delete" :disabled="selectedTasks.length < 1" :loading="loading" @click="deleteSelectedTasks">
        批量删除
      </el-button>
      <el-button :icon="Refresh" :loading="refreshing" @click="refreshTasks">
        刷新
      </el-button>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">
        新增定时采集
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
        height="620"
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
        <el-table-column label="操作" width="118" fixed="right">
          <template #default="{ row }">
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

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑定时采集' : '新增定时采集'" width="560px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="任务名称">
          <el-input v-model="form.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="采集方式">
          <el-input model-value="店铺采集" disabled />
        </el-form-item>
        <el-form-item label="采集内容">
          <el-input v-model="form.target" :prefix-icon="Search" placeholder="请输入店铺展示名称、url代码、url或sid" />
        </el-form-item>
        <el-form-item label="榜单时间">
          <el-select v-model="form.rankingPeriod" class="full-control" placeholder="选择榜单时间">
            <el-option v-for="item in rankingPeriodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="采集数量">
          <div class="crawl-limit-control">
            <el-radio-group v-model="crawlLimitForm.mode">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="custom">指定数量</el-radio-button>
            </el-radio-group>
            <el-input-number
              v-if="crawlLimitForm.mode === 'custom'"
              v-model="crawlLimitForm.count"
              class="crawl-limit-input"
              :min="1"
              :max="99999"
              :step="10"
              controls-position="right"
            />
          </div>
        </el-form-item>
        <el-form-item label="每天执行时间">
          <el-time-picker
            v-model="form.scheduleTime"
            class="full-control"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择每天几点几分"
          />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSchedule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="schedulesDialogOpen" title="定时任务" width="980px" append-to-body>
      <el-table v-loading="scheduleLoading" :data="schedules" empty-text="暂无定时任务" height="520">
        <el-table-column label="任务名称" min-width="160">
          <template #default="{ row }">
            <CopyableTableText :value="row.name" />
          </template>
        </el-table-column>
        <el-table-column label="采集内容" min-width="220">
          <template #default="{ row }">
            <CopyableTableText :value="row.crawlContent || row.target" />
          </template>
        </el-table-column>
        <el-table-column label="执行时间" width="110">
          <template #default="{ row }">
            {{ row.scheduleTime }}
          </template>
        </el-table-column>
        <el-table-column label="榜单时间" width="110">
          <template #default="{ row }">
            {{ rankingPeriodLabel(rankingPeriodFromTarget(row.target)) }}
          </template>
        </el-table-column>
        <el-table-column label="采集数量" width="110">
          <template #default="{ row }">
            {{ crawlLimitLabel(crawlLimitFromTarget(row.target)) }}
          </template>
        </el-table-column>
        <el-table-column label="启用状态" width="110">
          <template #default="{ row }">
            <el-tag :type="scheduleStatusType(row)">
              {{ scheduleStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastRunAt" label="上次执行" min-width="170" />
        <el-table-column prop="nextRunAt" label="下次执行" min-width="170" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button :icon="VideoPlay" link type="primary" @click="runSchedule(row)">
              立即执行
            </el-button>
            <el-button :icon="Edit" link type="primary" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button :icon="Delete" link type="danger" @click="removeSchedule(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
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

.crawl-limit-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
}

.crawl-limit-input {
  width: 180px;
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
