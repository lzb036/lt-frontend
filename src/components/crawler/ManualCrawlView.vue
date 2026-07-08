<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleClose, Delete, Plus, QuestionFilled, Refresh, Search, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlLimit, CrawlTask, CreateTaskPayload, SourceType } from '../../types/crawler'
import { withMinimumDelay } from '../../utils/async'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const refreshing = shallowRef(false)
const creating = shallowRef(false)
const createDialogVisible = shallowRef(false)
const tasks = shallowRef<CrawlTask[]>([])
const selectedTasks = shallowRef<CrawlTask[]>([])
let progressTimer: number | undefined

const filters = reactive({
  target: '',
  status: '',
  sourceType: '' as SourceType | '',
  createdAtRange: [] as string[] | null,
})

const form = reactive({
  sourceType: 'product_url' as SourceType,
  target: '',
  targets: [''],
  rankingPeriod: 'daily' as RankingPeriod,
  crawlLimit: 'all' as CrawlLimit,
  crawlLimitMode: 'all' as 'all' | 'custom',
  crawlLimitCount: 30,
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

const sourceTypeOptions: Array<{ label: string; value: SourceType }> = [
  { label: '店铺采集', value: 'shop' },
  { label: '单个商品采集', value: 'product_url' },
]

const sourceTypeLabels: Record<string, string> = {
  shop: '店铺采集',
  product_url: '单个商品采集',
  ranking: '排行榜采集',
  keyword: '关键词采集',
}

type RankingPeriod = 'daily' | 'weekly' | 'monthly'
type ProductTarget =
  | { type: 'market'; shopCode: string; itemNumber: string }
  | { type: 'fashion'; fashionCode: string }

const rankingPeriodOptions: Array<{ label: string; value: RankingPeriod }> = [
  { label: '日榜', value: 'daily' },
  { label: '周榜', value: 'weekly' },
  { label: '月榜', value: 'monthly' },
]

const productTargetError = '单个商品采集支持普通乐天商品链接、Rakuten Fashion 商品链接、带参数链接、店铺编码/商品编号。'
const shopTargetError = '店铺采集请输入店铺展示名称、店铺url代码、店铺url或sid。'
const shopTargetPlaceholder = '请输入店铺展示名称、url代码、url或sid'

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
      sourceType: filters.sourceType,
      mode: 'manual',
      createdAtFrom: createdAtFromValue(),
      createdAtTo: createdAtToValue(),
    })
    tasks.value = result.items
    setPageResult(result)
  } catch (error) {
    if (!options.silent) {
      ElMessage.error(toApiErrorMessage(error, '加载手动采集任务失败'))
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

async function createTask() {
  if (form.sourceType === 'product_url') {
    await createProductTasks()
    return
  }
  const normalizedTarget = normalizeCreateTarget()
  if (!normalizedTarget) {
    ElMessage.warning('采集内容不能为空')
    return
  }
  if (form.sourceType === 'shop' && !normalizeRakutenShopTarget(normalizedTarget)) {
    ElMessage.error(shopTargetError)
    return
  }
  creating.value = true
  try {
    const payload: CreateTaskPayload = {
      sourceType: form.sourceType,
      target: buildCreateTarget(normalizedTarget),
      rankingPeriod: form.sourceType === 'shop' ? form.rankingPeriod : null,
      crawlLimit: form.sourceType === 'shop' ? currentCrawlLimit() : null,
      mode: 'manual',
    }
    await api.createTask(payload)
    resetPage()
    await loadTasks()
    form.target = ''
    createDialogVisible.value = false
    ElMessage.success('采集任务已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建采集任务失败'))
  } finally {
    creating.value = false
  }
}

async function createProductTasks() {
  const targets = form.targets.map((target) => target.trim()).filter(Boolean)
  if (targets.length === 0) {
    ElMessage.warning('商品URL信息不能为空')
    return
  }
  const invalidIndex = targets.findIndex((target) => !isValidRakutenProductTarget(target))
  if (invalidIndex >= 0) {
    ElMessage.error(`第 ${invalidIndex + 1} 个商品URL格式不正确，${productTargetError}`)
    return
  }
  creating.value = true
  try {
    const results = await Promise.allSettled(
      targets.map((target) => api.createTask({
        sourceType: 'product_url',
        target: normalizeRakutenProductTarget(target),
        mode: 'manual',
      })),
    )
    const successCount = results.filter((result) => result.status === 'fulfilled').length
    const failedCount = results.length - successCount
    if (successCount > 0) {
      resetPage()
      await loadTasks()
    }
    if (failedCount > 0) {
      ElMessage.error(`已创建 ${successCount} 个采集任务，${failedCount} 个创建失败`)
      return
    }
    resetCreateForm()
    createDialogVisible.value = false
    ElMessage.success(`已创建 ${successCount} 个采集任务`)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建采集任务失败'))
  } finally {
    creating.value = false
  }
}

function openCreateDialog() {
  resetCreateForm()
  createDialogVisible.value = true
}

function resetCreateForm() {
  form.sourceType = 'product_url'
  form.target = ''
  form.targets = ['']
  form.rankingPeriod = 'daily'
  form.crawlLimit = 'all'
  form.crawlLimitMode = 'all'
  form.crawlLimitCount = 30
}

function handleSourceTypeChange() {
  form.target = ''
  form.targets = ['']
  form.rankingPeriod = 'daily'
  form.crawlLimit = 'all'
  form.crawlLimitMode = 'all'
  form.crawlLimitCount = 30
}

function addProductInput() {
  form.targets.push('')
}

function removeProductInput(index: number) {
  if (form.targets.length <= 1) {
    form.targets[0] = ''
    return
  }
  form.targets.splice(index, 1)
}

function normalizeCreateTarget() {
  return form.target.trim()
}

function buildShopTarget(keyword: string) {
  const periodLabel = rankingPeriodOptions.find((item) => item.value === form.rankingPeriod)?.label || '日榜'
  return `店铺:${keyword} ${periodLabel} ${crawlLimitLabel(currentCrawlLimit())}`
}

function buildCreateTarget(target: string) {
  if (form.sourceType === 'shop') {
    return buildShopTarget(normalizeRakutenShopTarget(target))
  }
  return target
}

function crawlLimitLabel(value: CrawlLimit | null | undefined) {
  return value === 'all' || value === null || value === undefined ? '全部' : `前 ${value}`
}

function currentCrawlLimit(): CrawlLimit {
  return form.crawlLimitMode === 'all' ? 'all' : Math.max(1, Math.floor(Number(form.crawlLimitCount || 1)))
}

function parseRakutenShopTarget(value: string) {
  const target = value.trim()
  if (!target) {
    return null
  }
  if (/^[0-9]+$/.test(target)) {
    return target
  }
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    return target
  }
  try {
    const parsedUrl = new URL(target)
    const hostname = parsedUrl.hostname.toLowerCase()
    if (hostname === 'search.rakuten.co.jp' && parsedUrl.pathname.replace(/\/$/, '').endsWith('/search/mall')) {
      return parsedUrl.searchParams.get('sn')?.trim()
        || parsedUrl.searchParams.get('su')?.trim()
        || parsedUrl.searchParams.get('sid')?.trim()
        || ''
    }
    if (hostname === 'www.rakuten.co.jp' || hostname === 'item.rakuten.co.jp') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] || ''
    }
    return ''
  } catch {
    return null
  }
}

function normalizeRakutenShopTarget(value: string) {
  return parseRakutenShopTarget(value) || ''
}

function parseRakutenProductTarget(value: string): ProductTarget | null {
  const target = value.trim()
  if (!target) {
    return null
  }
  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const parsedUrl = new URL(target)
      const hostname = parsedUrl.hostname.toLowerCase()
      if (hostname === 'brandavenue.rakuten.co.jp') {
        const parts = parsedUrl.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
        if (parts.length >= 2 && parts[0] === 'item') {
          return { type: 'fashion', fashionCode: parts[1] }
        }
        return null
      }
      if (hostname !== 'item.rakuten.co.jp') {
        return null
      }
      const parts = parsedUrl.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
      if (parts.length < 2) {
        return null
      }
      return { type: 'market', shopCode: parts[0], itemNumber: parts[1] }
    } catch {
      return null
    }
  }
  const parts = target.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  if (parts.length !== 2) {
    return null
  }
  return { type: 'market', shopCode: parts[0], itemNumber: parts[1] }
}

function isValidRakutenProductTarget(value: string) {
  return Boolean(parseRakutenProductTarget(value))
}

function normalizeRakutenProductTarget(value: string) {
  const parsed = parseRakutenProductTarget(value)
  if (!parsed) {
    return value.trim()
  }
  if (parsed.type === 'fashion') {
    return `https://brandavenue.rakuten.co.jp/item/${encodeURIComponent(parsed.fashionCode)}/`
  }
  return `https://item.rakuten.co.jp/${encodeURIComponent(parsed.shopCode)}/${encodeURIComponent(parsed.itemNumber)}/`
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
      `确认删除选中的 ${selectedTasks.value.length} 条手动采集任务？该操作只删除任务记录，不会删除商品数据。`,
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
  filters.sourceType = ''
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

function sourceTypeLabel(value: SourceType) {
  return sourceTypeLabels[value] || value
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
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">
        新增采集任务
      </el-button>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-input v-model="filters.target" class="filter-target-field" :prefix-icon="Search" clearable placeholder="采集内容" @keydown.enter="searchTasks" />
        <el-select v-model="filters.status" class="filter-select-field" clearable placeholder="采集状态" @change="searchTasks">
          <el-option label="待执行" value="queued" />
          <el-option label="采集中" value="running" />
          <el-option label="成功" value="success" />
          <el-option label="部分成功" value="partial" />
          <el-option label="失败" value="failed" />
          <el-option label="已终止" value="cancelled" />
        </el-select>
        <el-select v-model="filters.sourceType" class="filter-select-field" clearable placeholder="采集方式" @change="searchTasks">
          <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
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
        empty-text="暂无手动采集任务"
        height="max(620px, calc(100vh - 300px))"
        row-key="id"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="52" />
        <el-table-column label="采集内容" min-width="260">
          <template #default="{ row }">
            <CopyableTableText :value="row.target" />
          </template>
        </el-table-column>
        <el-table-column label="采集方式" width="140">
          <template #default="{ row }">
            {{ sourceTypeLabel(row.sourceType) }}
          </template>
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
          @size-change="searchTasks"
        />
      </div>
    </section>

    <el-dialog v-model="createDialogVisible" title="新增采集任务" width="560px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="采集方式">
          <el-select v-model="form.sourceType" class="full-control" placeholder="选择采集方式" @change="handleSourceTypeChange">
            <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.sourceType !== 'product_url'">
          <template #label>
            <span class="label-with-tip">
              <span>采集内容</span>
              <el-tooltip v-if="form.sourceType === 'shop'" placement="top" effect="dark" :hide-after="0">
                <template #content>
                  <div class="format-tooltip">
                    <div>支持格式：</div>
                    <code>店铺展示名：オネストワン</code>
                    <code>店铺url代码：honestone</code>
                    <code>店铺sid：441608</code>
                    <code>店铺url：https://search.rakuten.co.jp/search/mall/?...&sid=441608</code>
                  </div>
                </template>
                <el-icon class="hint-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input
            v-model="form.target"
            :prefix-icon="Search"
            :placeholder="shopTargetPlaceholder"
            @keydown.enter="createTask"
          />
        </el-form-item>
        <el-form-item v-if="form.sourceType === 'shop'" label="榜单时间">
          <el-select v-model="form.rankingPeriod" class="full-control" placeholder="选择榜单时间">
            <el-option v-for="item in rankingPeriodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.sourceType === 'shop'" label="采集数量">
          <div class="crawl-limit-control">
            <el-radio-group v-model="form.crawlLimitMode">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="custom">指定数量</el-radio-button>
            </el-radio-group>
            <el-input-number
              v-if="form.crawlLimitMode === 'custom'"
              v-model="form.crawlLimitCount"
              class="crawl-limit-input"
              :min="1"
              :max="99999"
              :step="10"
              controls-position="right"
            />
          </div>
        </el-form-item>
        <el-form-item v-if="form.sourceType === 'product_url'">
          <template #label>
            <span class="label-with-tip">
              <span>采集内容</span>
              <el-tooltip placement="top" effect="dark" :hide-after="0">
                <template #content>
                  <div class="format-tooltip">
                    <div>支持格式：</div>
                    <code>https://item.rakuten.co.jp/honestone/chen159/</code>
                    <code>https://item.rakuten.co.jp/honestone/chen159/?s-id=...</code>
                    <code>https://brandavenue.rakuten.co.jp/item/NP3688/?s-id=...</code>
                    <code>honestone/chen159</code>
                  </div>
                </template>
                <el-icon class="hint-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <div class="product-input-stack">
            <div v-for="(_, index) in form.targets" :key="index" class="product-input-row">
              <el-input
                v-model="form.targets[index]"
                :prefix-icon="Search"
                placeholder="请输入商品url信息"
                @keydown.enter="createTask"
              />
              <el-button v-if="form.targets.length > 1" :icon="Delete" link type="danger" @click="removeProductInput(index)">
                删除
              </el-button>
            </div>
            <div class="add-input-row">
              <el-button :icon="Plus" @click="addProductInput">
                新增输入框
              </el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createTask">
          新增采集任务
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.head-actions {
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
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.head-actions {
  justify-content: flex-end;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
  gap: 14px 16px;
}

.filter-target-field {
  flex: 1 1 460px;
  min-width: 280px;
}

.filter-select-field {
  flex: 0 1 180px;
  min-width: 150px;
}

.filter-actions {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 10px;
  justify-content: flex-start;
}

.filter-date-field {
  flex: 0 1 520px;
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

.product-input-stack {
  display: grid;
  gap: 10px;
  width: 100%;
}

.product-input-row {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) max-content;
}

.product-input-row .el-button {
  align-self: center;
}

.add-input-row {
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

.label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hint-icon {
  color: var(--text-soft);
  cursor: help;
  font-size: 16px;
  transition: color 0.15s ease;
}

.hint-icon:hover {
  color: var(--accent);
}

.format-tooltip {
  display: grid;
  gap: 6px;
  font-size: 12px;
  line-height: 1.45;
}

.format-tooltip code {
  overflow-wrap: anywhere;
  font-family: Consolas, "Microsoft YaHei", monospace;
}

@media (max-width: 1280px) {
  .filter-target-field {
    flex-basis: 520px;
  }

  .filter-date-field {
    flex-basis: 520px;
  }
}

@media (max-width: 760px) {
  .product-input-row {
    grid-template-columns: 1fr;
  }

  .product-input-row .el-button {
    justify-self: flex-end;
  }

  .filter-row {
    align-items: stretch;
    flex-direction: column;
  }

  .filter-target-field,
  .filter-select-field,
  .filter-date-field {
    width: 100%;
    min-width: 0;
  }

  .filter-actions .el-button {
    flex: 1;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-head .el-button,
  .head-actions .el-button {
    width: 100%;
  }
}
</style>
