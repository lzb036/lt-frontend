<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { Delete, Edit, Plus, Refresh, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AutoDeletionTask, AutoListingTaskType, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import FieldHelpTooltip from './FieldHelpTooltip.vue'
import AutomaticTaskScheduleEditDialog from './AutomaticTaskScheduleEditDialog.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const dialogVisible = shallowRef(false)
const editVisible = shallowRef(false)
const editingTask = shallowRef<AutoDeletionTask | null>(null)
const operatingId = shallowRef<number | null>(null)
const createMode = shallowRef<AutoListingTaskType>('automatic')
const tasks = shallowRef<AutoDeletionTask[]>([])
const stores = shallowRef<StoreAccount[]>([])
const filters = reactive({ storeId: null as number | null, taskType: '' as '' | AutoListingTaskType })
const form = reactive({
  storeId: 0,
  quantity: 50,
  scheduleType: 'daily' as 'daily' | 'weekly' | 'monthly',
  scheduleTime: '09:00',
  weekday: 1,
  monthDay: 1,
  executionMode: 'immediate' as 'immediate' | 'scheduled',
  executeAt: null as string | null,
})
const executionModeOptions = [
  { label: '立即执行', value: 'immediate' },
  { label: '到期执行', value: 'scheduled' },
] as const
const createDialogTitle = computed(() => (
  createMode.value === 'automatic' ? '创建定时删除任务' : '创建删除任务'
))
const deletionTaskHint = computed(() => (
  createMode.value === 'automatic'
    ? '任务会在设定时间执行，只选择目标店铺中已上架、近一年有效销量为 0 的商品，并按上架时间从早到晚处理；符合条件的商品不足时按实际数量创建同步商品删除任务。选择每月执行时，如果当月没有所选日期，则在当月最后一天执行。'
    : (
      form.executionMode === 'scheduled'
        ? '任务仍归类为手动任务，将在选择的日期和时间到达后执行一次。执行时只选择目标店铺中已上架、近一年有效销量为 0 的商品，并按上架时间从早到晚处理；符合条件的商品不足时按实际数量创建同步商品删除任务。'
        : '任务仍归类为手动任务，创建后立即执行。执行时只选择目标店铺中已上架、近一年有效销量为 0 的商品，并按上架时间从早到晚处理；符合条件的商品不足时按实际数量创建同步商品删除任务。'
    )
))
const submitButtonText = computed(() => {
  if (createMode.value === 'automatic') return '创建定时任务'
  return form.executionMode === 'scheduled' ? '创建任务' : '创建并执行'
})

onMounted(() => void loadData())

async function loadData() {
  loading.value = true
  try {
    const [taskRows, storeRows] = await Promise.all([
      api.listAutoDeletionTasks(filters),
      api.listStores(),
    ])
    tasks.value = taskRows
    stores.value = storeRows
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载自动删除任务失败'))
  } finally {
    loading.value = false
  }
}

function openCreate(mode: AutoListingTaskType) {
  createMode.value = mode
  form.storeId = stores.value.find((store) => store.enabled)?.id || 0
  form.quantity = 50
  form.scheduleType = 'daily'
  form.scheduleTime = '09:00'
  form.weekday = 1
  form.monthDay = 1
  form.executionMode = 'immediate'
  form.executeAt = defaultExecuteAt()
  dialogVisible.value = true
}

function defaultExecuteAt() {
  const value = new Date(Date.now() + 60 * 60 * 1000)
  value.setSeconds(0, 0)
  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}:00`,
  ].join(' ')
}

function disablePastDate(value: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return value.getTime() < today.getTime()
}

async function submit() {
  if (!form.storeId) {
    ElMessage.warning('请选择店铺')
    return
  }
  if (
    createMode.value === 'manual'
    && form.executionMode === 'scheduled'
    && (
      !form.executeAt
      || new Date(form.executeAt.replace(' ', 'T')).getTime() <= Date.now()
    )
  ) {
    ElMessage.warning('到期执行时间必须晚于当前时间')
    return
  }
  saving.value = true
  try {
    if (createMode.value === 'automatic') {
      await api.createAutoDeletionTask({
        storeId: form.storeId,
        quantity: form.quantity,
        scheduleType: form.scheduleType,
        scheduleTime: form.scheduleTime,
        weekday: form.scheduleType === 'weekly' ? form.weekday : null,
        monthDay: form.scheduleType === 'monthly' ? form.monthDay : null,
      })
      ElMessage.success('自动删除任务已创建')
    } else {
      const task = await api.createManualDeletionTask({
        storeId: form.storeId,
        quantity: form.quantity,
        executionMode: form.executionMode,
        executeAt: form.executionMode === 'scheduled' ? form.executeAt : null,
      })
      ElMessage.success(task.lastMessage || '删除任务已创建')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建自动删除任务失败'))
  } finally {
    saving.value = false
  }
}

function scheduleLabel(task: AutoDeletionTask) {
  if (task.taskType === 'manual') {
    if (task.executionMode === 'scheduled' || task.scheduleType === 'once') {
      return `到期执行 ${formatDateTime(task.nextRunAt)}`
    }
    return '立即执行'
  }
  if (task.scheduleType === 'daily') return `每天 ${task.scheduleTime}`
  if (task.scheduleType === 'weekly') return `每周${['一', '二', '三', '四', '五', '六', '日'][(task.weekday || 1) - 1]} ${task.scheduleTime}`
  return `每月 ${task.monthDay || 1} 日 ${task.scheduleTime}`
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function removeTask(task: AutoDeletionTask) {
  try {
    await ElMessageBox.confirm('确认删除该自动删除任务记录？', '删除任务', { type: 'warning' })
    await api.deleteAutoDeletionTask(task.id)
    await loadData()
    ElMessage.success('任务已删除')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(toApiErrorMessage(error, '删除任务失败'))
  }
}

function openEdit(task: AutoDeletionTask) {
  editingTask.value = task
  editVisible.value = true
}

async function toggleTask(task: AutoDeletionTask) {
  operatingId.value = task.id
  try {
    const updated = await api.updateAutoDeletionTaskStatus(task.id, !task.enabled)
    tasks.value = tasks.value.map((item) => (
      item.id === updated.id ? updated : item
    ))
    ElMessage.success(updated.enabled ? '自动删除任务已启用' : '自动删除任务已关闭')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, task.enabled ? '关闭自动删除任务失败' : '启用自动删除任务失败'))
  } finally {
    operatingId.value = null
  }
}

function statusLabel(task: AutoDeletionTask) {
  if (task.taskType === 'manual' && task.status === 'completed') return '已完成'
  if (task.status === 'running') return '执行中'
  if (task.status === 'failed') return '上次失败'
  if (task.taskType === 'automatic' && !task.enabled) return '已关闭'
  return '等待执行'
}

function statusType(task: AutoDeletionTask) {
  if (task.status === 'completed') return 'success'
  if (task.status === 'running') return 'warning'
  if (task.status === 'failed') return 'danger'
  if (task.taskType === 'automatic' && !task.enabled) return 'info'
  return 'success'
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div><p class="eyebrow">Automation Management</p><h1>自动删除管理</h1></div>
      <div class="head-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate('automatic')">
          创建定时任务
        </el-button>
        <el-button type="success" :icon="Plus" @click="openCreate('manual')">
          创建任务
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
      </div>
    </div>
    <section class="work-panel">
      <div class="filters">
        <el-select v-model="filters.storeId" clearable filterable placeholder="筛选店铺" @change="loadData">
          <el-option v-for="store in stores" :key="store.id" :label="store.aliasName || store.storeName" :value="store.id" />
        </el-select>
        <el-select v-model="filters.taskType" clearable placeholder="任务类型" @change="loadData">
          <el-option label="自动任务" value="automatic" /><el-option label="手动任务" value="manual" />
        </el-select>
      </div>
      <el-table v-loading="loading" :data="tasks" height="100%" empty-text="暂无自动删除任务">
        <el-table-column label="店铺" min-width="150"><template #default="{ row }">{{ row.storeAliasName || row.storeName }}</template></el-table-column>
        <el-table-column label="任务类型" width="110"><template #default="{ row }">{{ row.taskType === 'automatic' ? '自动任务' : '手动任务' }}</template></el-table-column>
        <el-table-column label="执行计划" min-width="170"><template #default="{ row }">{{ scheduleLabel(row) }}</template></el-table-column>
        <el-table-column prop="quantity" label="删除数量" width="100" />
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row)" effect="plain">{{ statusLabel(row) }}</el-tag></template></el-table-column>
        <el-table-column prop="lastMessage" label="上次结果" min-width="280" show-overflow-tooltip />
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="row.taskType === 'automatic'">
              <el-button link type="primary" :icon="Edit" :disabled="operatingId !== null" @click="openEdit(row)">编辑</el-button>
              <el-button
                link
                :type="row.enabled ? 'warning' : 'success'"
                :icon="row.enabled ? VideoPause : VideoPlay"
                :loading="operatingId === row.id"
                :disabled="operatingId !== null && operatingId !== row.id"
                @click="toggleTask(row)"
              >
                {{ row.enabled ? '关闭' : '启用' }}
              </el-button>
            </template>
            <el-button link type="danger" :icon="Delete" :disabled="operatingId !== null" @click="removeTask(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
    <el-dialog v-model="dialogVisible" width="540px">
      <template #header>
        <div class="dialog-title-with-help">
          <span>{{ createDialogTitle }}</span>
          <FieldHelpTooltip
            :label="createDialogTitle"
            :content="deletionTaskHint"
          />
        </div>
      </template>
      <el-form label-width="96px">
        <el-form-item label="店铺"><el-select v-model="form.storeId" class="full" filterable><el-option v-for="store in stores.filter(item => item.enabled)" :key="store.id" :label="store.aliasName || store.storeName" :value="store.id" /></el-select></el-form-item>
        <el-form-item label="删除数量">
          <el-input-number v-model="form.quantity" :min="1" :max="10000" />
        </el-form-item>
        <template v-if="createMode === 'manual'">
          <el-form-item label="执行方式">
            <el-segmented v-model="form.executionMode" :options="executionModeOptions" />
          </el-form-item>
          <el-form-item v-if="form.executionMode === 'scheduled'" label="执行时间">
            <el-date-picker
              v-model="form.executeAt"
              class="full"
              type="datetime"
              format="YYYY/MM/DD HH:mm"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="选择到期执行日期和时间"
              :disabled-date="disablePastDate"
            />
          </el-form-item>
        </template>
        <template v-if="createMode === 'automatic'">
          <el-form-item label="执行周期"><el-segmented v-model="form.scheduleType" :options="[{ label: '每天', value: 'daily' }, { label: '每周', value: 'weekly' }, { label: '每月', value: 'monthly' }]" /></el-form-item>
          <el-form-item v-if="form.scheduleType === 'weekly'" label="星期"><el-input-number v-model="form.weekday" :min="1" :max="7" /></el-form-item>
          <el-form-item v-if="form.scheduleType === 'monthly'" label="日期">
            <el-input-number v-model="form.monthDay" :min="1" :max="31" />
          </el-form-item>
          <el-form-item label="时间"><el-time-picker v-model="form.scheduleTime" format="HH:mm" value-format="HH:mm" /></el-form-item>
        </template>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submit">{{ submitButtonText }}</el-button></template>
    </el-dialog>
    <AutomaticTaskScheduleEditDialog
      v-model="editVisible"
      :task="editingTask"
      task-kind="deletion"
      @updated="loadData"
    />
  </section>
</template>

<style scoped>
.page-stack {
  display: flex;
  min-height: calc(100vh - 132px);
  flex-direction: column;
  gap: 18px;
}

.page-head,
.head-actions,
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.page-head {
  justify-content: space-between;
}

.head-actions {
  justify-content: flex-end;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
  font-size: 26px;
}

.work-panel {
  flex: 1;
  min-height: 520px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  padding: 18px;
}

.filters {
  margin-bottom: 14px;
}

.filters :deep(.el-select) {
  width: 220px;
}

.full {
  width: 100%;
}

.dialog-title-with-help {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  font-size: var(--el-dialog-title-font-size);
  line-height: var(--el-dialog-font-line-height);
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
