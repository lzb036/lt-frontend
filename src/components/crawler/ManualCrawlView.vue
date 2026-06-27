<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Plus, QuestionFilled, Search, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlTask, CreateTaskPayload, SourceType } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const creating = shallowRef(false)
const createDialogVisible = shallowRef(false)
const tasks = shallowRef<CrawlTask[]>([])

const filters = reactive({
  target: '',
  status: '',
  sourceType: '' as SourceType | '',
})

const form = reactive({
  sourceType: 'product_url' as SourceType,
  target: '',
  targets: [''],
  rankingPeriod: 'daily' as RankingPeriod,
  rankingLimit: 10,
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
  { label: '排行榜采集', value: 'ranking' },
  { label: '单个商品采集', value: 'product_url' },
]

type RankingPeriod = 'realtime' | 'daily' | 'weekly' | 'monthly'

const rankingPeriodOptions: Array<{ label: string; value: RankingPeriod }> = [
  { label: '实时', value: 'realtime' },
  { label: '日榜', value: 'daily' },
  { label: '周榜', value: 'weekly' },
  { label: '月榜', value: 'monthly' },
]

const productTargetError = '单个商品采集只支持完整乐天商品链接、带参数的乐天商品链接、店铺编码/商品编号。'
const shopTargetError = '店铺采集请输入店铺展示名称、店铺 URL 代码、店铺 URL 或 sid。'

onMounted(() => {
  void loadTasks()
})

async function loadTasks() {
  loading.value = true
  try {
    const result = await api.listTasksPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      target: filters.target.trim(),
      status: filters.status,
      sourceType: filters.sourceType,
    })
    tasks.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载手动采集任务失败'))
  } finally {
    loading.value = false
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
  form.rankingLimit = 10
}

function handleSourceTypeChange() {
  form.target = ''
  form.targets = ['']
  form.rankingPeriod = 'daily'
  form.rankingLimit = 10
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

function buildRankingTarget(keyword: string, prefix = '') {
  const limit = Math.min(100, Math.max(1, Number(form.rankingLimit) || 10))
  const periodLabel = rankingPeriodOptions.find((item) => item.value === form.rankingPeriod)?.label || '日榜'
  return `${prefix}${keyword} ${periodLabel} 前${limit}`
}

function buildCreateTarget(target: string) {
  if (form.sourceType === 'ranking') {
    return buildRankingTarget(target)
  }
  if (form.sourceType === 'shop') {
    return buildRankingTarget(normalizeRakutenShopTarget(target), '店铺:')
  }
  return target
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

function parseRakutenProductTarget(value: string) {
  const target = value.trim()
  if (!target) {
    return null
  }
  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const parsedUrl = new URL(target)
      if (parsedUrl.hostname !== 'item.rakuten.co.jp') {
        return null
      }
      const parts = parsedUrl.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
      if (parts.length < 2) {
        return null
      }
      return { shopCode: parts[0], itemNumber: parts[1] }
    } catch {
      return null
    }
  }
  const parts = target.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  if (parts.length !== 2) {
    return null
  }
  return { shopCode: parts[0], itemNumber: parts[1] }
}

function isValidRakutenProductTarget(value: string) {
  return Boolean(parseRakutenProductTarget(value))
}

function normalizeRakutenProductTarget(value: string) {
  const parsed = parseRakutenProductTarget(value)
  if (!parsed) {
    return value.trim()
  }
  return `https://item.rakuten.co.jp/${encodeURIComponent(parsed.shopCode)}/${encodeURIComponent(parsed.itemNumber)}/`
}

async function restartTask(row: CrawlTask) {
  loading.value = true
  try {
    await api.restartTask(row.id)
    await loadTasks()
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
  resetPage()
  void loadTasks()
}

function searchTasks() {
  resetPage()
  void loadTasks()
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
    <section class="work-panel">
      <div class="panel-toolbar">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增采集任务
        </el-button>
      </div>

      <div class="filter-row">
        <el-input v-model="filters.target" :prefix-icon="Search" clearable placeholder="采集内容" @keydown.enter="searchTasks" />
        <el-select v-model="filters.status" clearable placeholder="采集状态" @change="searchTasks">
          <el-option label="待执行" value="queued" />
          <el-option label="采集中" value="running" />
          <el-option label="成功" value="success" />
          <el-option label="部分成功" value="partial" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-select v-model="filters.sourceType" clearable placeholder="采集条件" @change="searchTasks">
          <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button :icon="Delete" @click="resetFilters">
          重置
        </el-button>
      </div>

      <el-table v-loading="loading" :data="tasks" empty-text="暂无手动采集任务" height="620">
        <el-table-column prop="ownerUsername" label="租户编码" width="140" />
        <el-table-column label="采集内容" min-width="260">
          <template #default="{ row }">
            <CopyableTableText :value="row.target" />
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
        <el-table-column label="说明" min-width="180">
          <template #default="{ row }">
            <CopyableTableText :value="row.message" />
          </template>
        </el-table-column>
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
                    <code>店铺 URL 代码：honestone</code>
                    <code>店铺 sid：441608</code>
                    <code>https://search.rakuten.co.jp/search/mall/?...&sid=441608</code>
                  </div>
                </template>
                <el-icon class="hint-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input
            v-model="form.target"
            :prefix-icon="Search"
            :placeholder="form.sourceType === 'ranking' ? '请输入商品关键词' : '请输入店铺展示名称、URL代码、url或sid'"
            @keydown.enter="createTask"
          />
        </el-form-item>
        <el-form-item v-if="form.sourceType === 'ranking' || form.sourceType === 'shop'" label="榜单时间">
          <el-select v-model="form.rankingPeriod" class="full-control" placeholder="选择榜单时间">
            <el-option v-for="item in rankingPeriodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.sourceType === 'ranking' || form.sourceType === 'shop'" label="采集数量">
          <el-input-number
            v-model="form.rankingLimit"
            class="full-control"
            :min="1"
            :max="100"
            :step="5"
            step-strictly
            controls-position="right"
          />
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
.panel-toolbar {
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

.panel-toolbar {
  justify-content: flex-end;
  margin-bottom: 14px;
}

.filter-row {
  display: grid;
  gap: 12px;
}

.filter-row {
  margin-bottom: 14px;
  grid-template-columns: minmax(0, 1fr) minmax(150px, 170px) minmax(160px, 190px) max-content;
}

.full-control {
  width: 100%;
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

@media (max-width: 1120px) {
  .filter-row {
    grid-template-columns: minmax(0, 1fr) minmax(150px, 170px) minmax(160px, 190px);
  }

  .filter-row .el-button {
    grid-column: 1 / -1;
    justify-self: flex-end;
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
    grid-template-columns: 1fr;
  }

  .filter-row .el-button {
    grid-column: auto;
    justify-self: stretch;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-head .el-button,
  .panel-toolbar .el-button {
    width: 100%;
  }
}
</style>
