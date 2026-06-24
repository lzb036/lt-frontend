<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh, Search, Timer, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { CrawlSource, ScheduledCrawl, ScheduledCrawlPayload, SourceType } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const schedules = shallowRef<ScheduledCrawl[]>([])
const sources = shallowRef<CrawlSource[]>([])

const form = reactive<ScheduledCrawlPayload>({
  sourceId: null,
  name: '',
  crawlContent: '',
  crawlCondition: '',
  sourceType: 'keyword',
  target: '',
  enabled: true,
  intervalMinutes: 60,
  notes: '',
})

const sourceTypeOptions: Array<{ label: string; value: SourceType }> = [
  { label: '乐天搜索', value: 'keyword' },
  { label: '采集店铺', value: 'shop' },
  { label: '排行榜', value: 'ranking' },
  { label: '采集商品地址/ID', value: 'product_url' },
]

onMounted(() => {
  void refreshAll()
})

async function refreshAll() {
  loading.value = true
  try {
    const [scheduleValues, sourceValues] = await Promise.all([
      api.listSchedules(),
      api.listSources(),
    ])
    schedules.value = scheduleValues
    sources.value = sourceValues
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载定时采集失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.sourceId = null
  form.name = ''
  form.crawlContent = ''
  form.crawlCondition = ''
  form.sourceType = 'keyword'
  form.target = ''
  form.enabled = true
  form.intervalMinutes = 60
  form.notes = ''
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(row: ScheduledCrawl) {
  editingId.value = row.id
  form.sourceId = row.sourceId ?? null
  form.name = row.name
  form.crawlContent = row.crawlContent
  form.crawlCondition = row.crawlCondition
  form.sourceType = row.sourceType
  form.target = row.target
  form.enabled = row.enabled
  form.intervalMinutes = row.intervalMinutes
  form.notes = row.notes
  dialogOpen.value = true
}

function handleSourceChange() {
  if (!form.sourceId) {
    return
  }
  const source = sources.value.find((item) => item.id === form.sourceId)
  if (!source) {
    return
  }
  form.sourceType = source.sourceType
  form.target = source.target
  form.crawlContent = source.target
  form.crawlCondition = source.sourceType
}

async function saveSchedule() {
  if (!form.name.trim() || (!form.sourceId && !form.target.trim())) {
    ElMessage.warning('请填写任务名称和采集目标')
    return
  }
  saving.value = true
  try {
    const result = await api.saveSchedule({ ...form, name: form.name.trim(), target: form.target.trim() }, editingId.value ?? undefined)
    schedules.value = result.schedules
    dialogOpen.value = false
    ElMessage.success('定时采集已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存定时采集失败'))
  } finally {
    saving.value = false
  }
}

async function runSchedule(row: ScheduledCrawl) {
  loading.value = true
  try {
    const result = await api.runSchedule(row.id)
    schedules.value = result.schedules
    ElMessage.success('定时任务已执行一次')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '执行定时任务失败'))
  } finally {
    loading.value = false
  }
}

async function removeSchedule(row: ScheduledCrawl) {
  try {
    await ElMessageBox.confirm(`确认删除定时采集「${row.name}」？`, '删除定时采集', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    schedules.value = await api.deleteSchedule(row.id)
    ElMessage.success('定时采集已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除定时采集失败'))
    }
  }
}

function sourceTypeLabel(value: SourceType) {
  return sourceTypeOptions.find((item) => item.value === value)?.label || value
}

function statusLabel(row: ScheduledCrawl) {
  if (!row.enabled) {
    return '已停用'
  }
  const labels: Record<string, string> = {
    idle: '待执行',
    running: '执行中',
    disabled: '已停用',
    failed: '失败',
  }
  return labels[row.status] || row.status
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Scheduled Jobs</p>
        <h1>定时采集</h1>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="refreshAll">
          刷新
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增定时采集
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <el-table v-loading="loading" :data="schedules" empty-text="暂无定时采集" height="650">
        <el-table-column prop="ownerUsername" label="租户编码" width="140" />
        <el-table-column prop="name" label="任务名称" min-width="170" show-overflow-tooltip />
        <el-table-column prop="crawlContent" label="采集内容" min-width="230" show-overflow-tooltip />
        <el-table-column label="采集条件" width="140">
          <template #default="{ row }">
            {{ sourceTypeLabel(row.sourceType) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ statusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="intervalMinutes" label="间隔(分钟)" width="120" />
        <el-table-column prop="lastRunAt" label="上次执行" min-width="170" />
        <el-table-column prop="nextRunAt" label="下次执行" min-width="170" />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button :icon="VideoPlay" link type="primary" @click="runSchedule(row)">
              立即执行
            </el-button>
            <el-button :icon="Timer" link type="primary" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button :icon="Delete" link type="danger" @click="removeSchedule(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogOpen" :title="editingId ? '编辑定时采集' : '新增定时采集'" width="680px">
      <div class="dialog-form">
        <el-input v-model="form.name" placeholder="任务名称" />
        <el-select v-model="form.sourceId" clearable filterable placeholder="可选：使用已保存采集源" @change="handleSourceChange">
          <el-option v-for="source in sources" :key="source.id" :label="`${source.name} / ${source.target}`" :value="source.id" />
        </el-select>
        <el-select v-model="form.sourceType" :disabled="Boolean(form.sourceId)" placeholder="采集条件">
          <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="form.target" :disabled="Boolean(form.sourceId)" :prefix-icon="Search" placeholder="采集目标：关键词、店铺ID、商品URL" />
        <el-input v-model="form.crawlContent" placeholder="采集内容显示值，可留空" />
        <el-input v-model="form.crawlCondition" placeholder="采集条件显示值，可留空" />
        <el-input-number v-model="form.intervalMinutes" :min="5" :max="1440" controls-position="right" />
        <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="备注" />
      </div>
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

.page-head,
.head-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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

.dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dialog-form .el-textarea {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .dialog-form {
    grid-template-columns: 1fr;
  }
}
</style>
