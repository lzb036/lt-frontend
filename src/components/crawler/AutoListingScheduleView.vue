<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh, VideoPause, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AutoListingSchedule,
  AutoListingTaskType,
  StoreAccount,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import AutoListingScheduleCreateDialog from './AutoListingScheduleCreateDialog.vue'
import AutomaticTaskScheduleEditDialog from './AutomaticTaskScheduleEditDialog.vue'
import ManualListingTaskCreateDialog from './ManualListingTaskCreateDialog.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const operatingId = shallowRef<number | null>(null)
const automaticCreateVisible = shallowRef(false)
const manualCreateVisible = shallowRef(false)
const editVisible = shallowRef(false)
const editingSchedule = shallowRef<AutoListingSchedule | null>(null)
const schedules = shallowRef<AutoListingSchedule[]>([])
const stores = shallowRef<StoreAccount[]>([])
const filters = reactive({
  storeId: null as number | null,
  taskType: '' as '' | AutoListingTaskType,
})

onMounted(() => {
  void loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [scheduleRows, storeRows] = await Promise.all([
      api.listAutoListingSchedules({
        storeId: filters.storeId,
        taskType: filters.taskType,
      }),
      api.listStores(),
    ])
    schedules.value = scheduleRows
    stores.value = storeRows
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载自动上架任务失败'))
  } finally {
    loading.value = false
  }
}

function frequencyLabel(schedule: AutoListingSchedule) {
  if (schedule.taskType === 'manual') {
    if (schedule.executionMode === 'scheduled' || schedule.scheduleType === 'once') {
      return `到期执行 ${formatDateTime(schedule.nextRunAt)}`
    }
    return '立即执行'
  }
  if (schedule.scheduleType === 'daily') {
    return `每天 ${schedule.scheduleTime}`
  }
  if (schedule.scheduleType === 'weekly') {
    const weekday = ['一', '二', '三', '四', '五', '六', '日'][(schedule.weekday || 1) - 1]
    return `每周${weekday} ${schedule.scheduleTime}`
  }
  return `每月 ${schedule.monthDay || 1} 日 ${schedule.scheduleTime}`
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function resultText(schedule: AutoListingSchedule) {
  return schedule.lastError || schedule.lastMessage || '尚未执行'
}

function statusLabel(schedule: AutoListingSchedule) {
  if (schedule.taskType === 'manual' && schedule.status === 'completed') {
    return '已完成'
  }
  const statusText = {
    idle: '等待执行',
    running: '执行中',
    failed: '上次失败',
    disabled: '已停用',
    completed: '已完成',
  }[schedule.status]
  if (schedule.status === 'failed' || schedule.status === 'running') {
    return statusText
  }
  if (!schedule.enabled && schedule.taskType === 'automatic') {
    return '已停用'
  }
  return statusText || '等待执行'
}

function statusType(schedule: AutoListingSchedule) {
  if (schedule.status === 'completed') {
    return 'success'
  }
  if (!schedule.enabled || schedule.status === 'disabled') {
    return 'info'
  }
  if (schedule.status === 'running') {
    return 'warning'
  }
  if (schedule.status === 'failed') {
    return 'danger'
  }
  return 'success'
}

async function removeSchedule(schedule: AutoListingSchedule) {
  try {
    await ElMessageBox.confirm(
      `确认删除店铺「${schedule.storeAliasName || schedule.storeName}」的${schedule.taskType === 'automatic' ? '定时任务' : '手动任务'}？`,
      '删除上架任务',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    operatingId.value = schedule.id
    await api.deleteAutoListingSchedule(schedule.id)
    schedules.value = schedules.value.filter((item) => item.id !== schedule.id)
    ElMessage.success('自动上架任务已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除自动上架任务失败'))
    }
  } finally {
    operatingId.value = null
  }
}

function openEdit(schedule: AutoListingSchedule) {
  editingSchedule.value = schedule
  editVisible.value = true
}

async function toggleSchedule(schedule: AutoListingSchedule) {
  operatingId.value = schedule.id
  try {
    const updated = await api.updateAutoListingScheduleStatus(
      schedule.id,
      !schedule.enabled,
    )
    await loadData()
    ElMessage.success(updated.enabled ? '自动上架任务已启用' : '自动上架任务已关闭')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, schedule.enabled ? '关闭自动上架任务失败' : '启用自动上架任务失败'))
  } finally {
    operatingId.value = null
  }
}

async function handleCreated() {
  await loadData()
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Automation Management</p>
        <h1>自动上架管理</h1>
      </div>
      <div class="head-actions">
        <el-button
          type="primary"
          :icon="Plus"
          @click="automaticCreateVisible = true"
        >
          创建定时任务
        </el-button>
        <el-button
          type="success"
          :icon="Plus"
          @click="manualCreateVisible = true"
        >
          创建任务
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadData">
          刷新
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-select
          v-model="filters.storeId"
          class="filter-control"
          clearable
          filterable
          placeholder="筛选店铺"
          @change="loadData"
        >
          <el-option
            v-for="store in stores"
            :key="store.id"
            :label="store.aliasName || store.storeName"
            :value="store.id"
          />
        </el-select>
        <el-select
          v-model="filters.taskType"
          class="filter-control"
          clearable
          placeholder="任务类型"
          @change="loadData"
        >
          <el-option label="自动任务" value="automatic" />
          <el-option label="手动任务" value="manual" />
        </el-select>
      </div>
      <el-table
        v-loading="loading"
        :data="schedules"
        height="100%"
        empty-text="暂无自动上架任务"
      >
        <el-table-column label="上架店铺" min-width="150">
          <template #default="{ row }">
            {{ row.storeAliasName || row.storeName }}
          </template>
        </el-table-column>
        <el-table-column label="任务类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.taskType === 'automatic' ? 'primary' : 'success'" effect="plain">
              {{ row.taskType === 'automatic' ? '自动任务' : '手动任务' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="执行计划" min-width="170">
          <template #default="{ row }">{{ frequencyLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="上架数量" width="100" align="center" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row)" effect="plain">
              {{ statusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下次执行" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.nextRunAt) }}</template>
        </el-table-column>
        <el-table-column label="上次执行" min-width="160">
          <template #default="{ row }">{{ formatDateTime(row.lastRunAt) }}</template>
        </el-table-column>
        <el-table-column label="上次结果" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ 'result-error': Boolean(row.lastError) }">{{ resultText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="row.taskType === 'automatic'">
              <el-button
                link
                type="primary"
                :icon="Edit"
                :disabled="operatingId !== null"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                :type="row.enabled ? 'warning' : 'success'"
                :icon="row.enabled ? VideoPause : VideoPlay"
                :loading="operatingId === row.id"
                :disabled="operatingId !== null && operatingId !== row.id"
                @click="toggleSchedule(row)"
              >
                {{ row.enabled ? '关闭' : '启用' }}
              </el-button>
            </template>
            <el-button
              link
              type="danger"
              :icon="Delete"
              :disabled="operatingId !== null"
              @click="removeSchedule(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <AutoListingScheduleCreateDialog
      v-model="automaticCreateVisible"
      :stores="stores"
      :schedules="schedules"
      @created="handleCreated"
    />
    <ManualListingTaskCreateDialog
      v-model="manualCreateVisible"
      :stores="stores"
      @created="handleCreated"
    />
    <AutomaticTaskScheduleEditDialog
      v-model="editVisible"
      :task="editingSchedule"
      task-kind="listing"
      @updated="handleCreated"
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
.head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.page-head {
  justify-content: space-between;
  gap: 16px;
}

.head-actions {
  justify-content: flex-end;
  gap: 10px;
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
  flex: 1 1 auto;
  min-height: 520px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.filter-control {
  width: 220px;
}

.result-error {
  color: var(--el-color-danger);
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
