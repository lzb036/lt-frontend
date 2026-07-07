<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, Edit, Plus, Refresh, Search, Upload, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlLimit, RankingPeriod, ScheduleImportResult, ScheduledCrawl, ScheduledCrawlPayload, ScheduleStatus } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const saving = shallowRef(false)
const importing = shallowRef(false)
const downloadingTemplate = shallowRef(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const importInputRef = ref<HTMLInputElement | null>(null)
const scheduleTableRef = ref<{ clearSelection: () => void } | null>(null)
const schedules = shallowRef<ScheduledCrawl[]>([])
const selectedSchedules = shallowRef<ScheduledCrawl[]>([])

const rankingPeriodOptions: Array<{ label: string; value: RankingPeriod }> = [
  { label: '日榜', value: 'daily' },
  { label: '周榜', value: 'weekly' },
  { label: '月榜', value: 'monthly' },
]

const filters = reactive({
  keyword: '',
  enabledStatus: '' as '' | 'enabled' | 'disabled',
  status: '' as '' | ScheduleStatus,
  scheduleTime: '',
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
  scheduleTime: '20:00',
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
  void loadSchedules()
})

async function loadSchedules(options: { silent?: boolean } = {}) {
  if (!options.silent) {
    loading.value = true
  }
  try {
    const result = await api.listSchedulesPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: filters.keyword.trim(),
      enabledStatus: filters.enabledStatus,
      status: filters.status,
      scheduleTime: filters.scheduleTime,
      createdAtFrom: createdAtFromValue(),
      createdAtTo: createdAtToValue(),
    })
    schedules.value = result.items
    setPageResult(result)
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(toApiErrorMessage(error, '加载采集店铺失败'))
    }
  } finally {
    if (!options.silent) {
      loading.value = false
    }
  }
}

async function refreshSchedules() {
  refreshing.value = true
  try {
    await withMinimumDelay(loadSchedules())
  } finally {
    refreshing.value = false
  }
}

function searchSchedules() {
  resetPage()
  void loadSchedules()
}

function resetFilters() {
  filters.keyword = ''
  filters.enabledStatus = ''
  filters.status = ''
  filters.scheduleTime = ''
  filters.createdAtRange = []
  resetPage()
  void loadSchedules()
}

function createdAtFromValue() {
  const value = filters.createdAtRange?.[0] || ''
  return value ? `${value}T00:00:00` : ''
}

function createdAtToValue() {
  const value = filters.createdAtRange?.[1] || ''
  return value ? `${value}T23:59:59` : ''
}

async function downloadScheduleTemplate() {
  downloadingTemplate.value = true
  try {
    const blob = await api.downloadScheduleImportTemplate()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '定时采集导入模板.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '下载模板失败'))
  } finally {
    downloadingTemplate.value = false
  }
}

function openScheduleImportFilePicker() {
  importInputRef.value?.click()
}

async function handleScheduleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    ElMessage.warning('请选择 xls 或 xlsx 表格文件')
    return
  }
  importing.value = true
  try {
    const result = await api.importSchedules(file)
    await loadSchedules()
    showScheduleImportResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '导入采集店铺失败'))
  } finally {
    importing.value = false
  }
}

function showScheduleImportResult(result: ScheduleImportResult) {
  const summary = `导入完成：新增 ${result.createdCount} 条，更新 ${result.updatedCount} 条，失败 ${result.failedCount} 条`
  if (result.failedCount > 0) {
    const failedText = result.failedRows
      .slice(0, 20)
      .map((row) => `第 ${row.rowNumber} 行：${row.message}`)
      .join('\n')
    void ElMessageBox.alert(failedText || '部分数据导入失败', summary, {
      confirmButtonText: '知道了',
      type: 'warning',
    })
    return
  }
  ElMessage.success(summary)
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
  form.scheduleTime = '20:00'
  form.notes = ''
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
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
  form.scheduleTime = row.scheduleTime || '20:00'
  form.notes = row.notes || ''
  dialogOpen.value = true
}

function normalizeScheduleTarget(value: string) {
  return String(value || '').replace(/^店铺[:：]/, '').replace(/\s+(实时|日榜|周榜|月榜)(?:\s+(?:全部|全量|前\s*[0-9]{1,5}))?$/, '').trim()
}

function rankingPeriodFromTarget(value: string): RankingPeriod {
  const target = String(value || '')
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
      notes: form.notes,
    }, editingId.value ?? undefined)
    await loadSchedules()
    dialogOpen.value = false
    ElMessage.success('采集店铺已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存采集店铺失败'))
  } finally {
    saving.value = false
  }
}

async function runSchedule(row: ScheduledCrawl) {
  loading.value = true
  try {
    await api.runSchedule(row.id)
    await loadSchedules()
    ElMessage.success('采集店铺已执行一次')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '执行采集店铺失败'))
  } finally {
    loading.value = false
  }
}

async function removeSchedule(row: ScheduledCrawl) {
  try {
    await ElMessageBox.confirm(`确认删除采集店铺「${row.name}」？`, '删除采集店铺', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.deleteSchedule(row.id)
    await loadSchedules()
    ElMessage.success('采集店铺已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除采集店铺失败'))
    }
  }
}

function handleSelectionChange(rows: ScheduledCrawl[]) {
  selectedSchedules.value = rows
}

function clearSelection() {
  selectedSchedules.value = []
  scheduleTableRef.value?.clearSelection()
}

async function deleteSelectedSchedules() {
  if (selectedSchedules.value.length < 1) {
    ElMessage.warning('请选择要删除的采集店铺')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedSchedules.value.length} 条采集店铺？该操作会删除定时计划，不会删除已采集商品数据。`,
      '批量删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    loading.value = true
    const result = await api.deleteSchedules(selectedSchedules.value.map((item) => item.id))
    clearSelection()
    await loadSchedules()
    if (result.failedIds.length > 0) {
      ElMessage.warning(`已删除 ${result.deletedCount} 条，${result.failedIds.length} 条删除失败`)
    } else {
      ElMessage.success(`已删除 ${result.deletedCount} 条采集店铺`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '批量删除采集店铺失败'))
    }
  } finally {
    loading.value = false
  }
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
  void loadSchedules()
}
</script>

<template>
  <section class="page-stack">
    <div class="head-actions">
      <input
        ref="importInputRef"
        class="schedule-import-input"
        type="file"
        accept=".xls,.xlsx"
        @change="handleScheduleImportFileChange"
      >
      <el-button :icon="Download" :loading="downloadingTemplate" @click="downloadScheduleTemplate">
        下载模板
      </el-button>
      <el-button :icon="Upload" :loading="importing" @click="openScheduleImportFilePicker">
        导入表格
      </el-button>
      <el-button type="danger" :icon="Delete" :disabled="selectedSchedules.length < 1" :loading="loading" @click="deleteSelectedSchedules">
        批量删除
      </el-button>
      <el-button :icon="Refresh" :loading="refreshing" @click="refreshSchedules">
        刷新
      </el-button>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">
        新增定时采集
      </el-button>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-input v-model="filters.keyword" :prefix-icon="Search" clearable placeholder="店铺名称、URL、备注" @keydown.enter="searchSchedules" />
        <el-select v-model="filters.enabledStatus" clearable placeholder="启用状态" @change="searchSchedules">
          <el-option label="已启用" value="enabled" />
          <el-option label="未启用" value="disabled" />
        </el-select>
        <el-select v-model="filters.status" clearable placeholder="运行状态" @change="searchSchedules">
          <el-option label="空闲" value="idle" />
          <el-option label="执行中" value="running" />
          <el-option label="失败" value="failed" />
          <el-option label="已停用" value="disabled" />
        </el-select>
        <el-time-picker
          v-model="filters.scheduleTime"
          class="full-control"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="执行时间"
          @change="searchSchedules"
        />
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
            @change="searchSchedules"
          />
        </div>
        <div class="filter-actions">
          <el-button type="primary" :icon="Search" @click="searchSchedules">
            搜索
          </el-button>
          <el-button :icon="Delete" @click="resetFilters">
            重置
          </el-button>
        </div>
      </div>

      <el-table
        ref="scheduleTableRef"
        v-loading="loading"
        :data="schedules"
        empty-text="暂无采集店铺"
        height="max(620px, calc(100vh - 300px))"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="52" />
        <el-table-column label="任务名称" min-width="190">
          <template #default="{ row }">
            <CopyableTableText :value="row.name" />
          </template>
        </el-table-column>
        <el-table-column label="采集内容" min-width="240">
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
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '已启用' : '未启用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="运行状态" width="110">
          <template #default="{ row }">
            <el-tag :type="scheduleStatusType(row)">
              {{ scheduleStatusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastRunAt" label="上次执行" min-width="170" />
        <el-table-column prop="nextRunAt" label="下次执行" min-width="170" />
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
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
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="loadSchedules"
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
  flex-wrap: wrap;
  gap: 12px;
}

.schedule-import-input {
  display: none;
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
  grid-template-columns: minmax(260px, 1fr) minmax(120px, 140px) minmax(120px, 140px) minmax(128px, 148px) minmax(280px, 360px) max-content;
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

@media (max-width: 1280px) {
  .filter-row {
    grid-template-columns: minmax(0, 1fr) minmax(120px, 150px) minmax(120px, 150px);
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
