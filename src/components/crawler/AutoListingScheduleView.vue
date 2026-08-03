<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AutoListingSchedule, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import AutoListingScheduleCreateDialog from './AutoListingScheduleCreateDialog.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const operatingId = shallowRef<number | null>(null)
const createVisible = shallowRef(false)
const schedules = shallowRef<AutoListingSchedule[]>([])
const stores = shallowRef<StoreAccount[]>([])

onMounted(() => {
  void loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [scheduleRows, storeRows] = await Promise.all([
      api.listAutoListingSchedules(),
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
  if (!schedule.enabled) {
    return '已停用'
  }
  return {
    idle: '等待执行',
    running: '执行中',
    failed: '上次失败',
    disabled: '已停用',
  }[schedule.status] || '等待执行'
}

function statusType(schedule: AutoListingSchedule) {
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

async function toggleSchedule(schedule: AutoListingSchedule) {
  operatingId.value = schedule.id
  try {
    const updated = await api.updateAutoListingScheduleStatus(schedule.id, !schedule.enabled)
    schedules.value = schedules.value.map((item) => item.id === updated.id ? updated : item)
    ElMessage.success(updated.enabled ? '自动上架任务已启用' : '自动上架任务已停用')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新自动上架任务失败'))
  } finally {
    operatingId.value = null
  }
}

async function runScheduleNow(schedule: AutoListingSchedule) {
  try {
    await ElMessageBox.confirm(
      `确认立即执行店铺「${schedule.storeAliasName || schedule.storeName}」的自动上架任务？`,
      '立即执行自动上架',
      {
        confirmButtonText: '立即执行',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    operatingId.value = schedule.id
    const updated = await api.runAutoListingSchedule(schedule.id)
    schedules.value = schedules.value.map((item) => item.id === updated.id ? updated : item)
    ElMessage.success(updated.lastMessage || '自动上架任务已创建')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '立即执行自动上架失败'))
      await loadData()
    }
  } finally {
    operatingId.value = null
  }
}

async function removeSchedule(schedule: AutoListingSchedule) {
  try {
    await ElMessageBox.confirm(
      `确认删除店铺「${schedule.storeAliasName || schedule.storeName}」的自动上架任务？`,
      '删除自动上架任务',
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

function handleCreated(schedule: AutoListingSchedule) {
  schedules.value = [schedule, ...schedules.value]
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
          @click="createVisible = true"
        >
          创建自动任务
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadData">
          刷新
        </el-button>
      </div>
    </div>

    <section class="work-panel">
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
            <el-button
              link
              type="success"
              :icon="VideoPlay"
              :loading="operatingId === row.id"
              :disabled="row.status === 'running' || (operatingId !== null && operatingId !== row.id)"
              @click="runScheduleNow(row)"
            >
              立即执行
            </el-button>
            <el-button
              link
              type="primary"
              :disabled="operatingId !== null"
              @click="toggleSchedule(row)"
            >
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
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
      v-model="createVisible"
      :stores="stores"
      :schedules="schedules"
      @created="handleCreated"
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
