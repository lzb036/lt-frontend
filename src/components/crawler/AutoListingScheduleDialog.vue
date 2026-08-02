<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AutoListingSchedule, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import AutoListingScheduleCreateDialog from './AutoListingScheduleCreateDialog.vue'

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const loading = shallowRef(false)
const operatingId = shallowRef<number | null>(null)
const createVisible = shallowRef(false)
const schedules = shallowRef<AutoListingSchedule[]>([])
const stores = shallowRef<StoreAccount[]>([])
const hasAvailableStore = computed(() => {
  const occupied = new Set(schedules.value.map((schedule) => schedule.storeId))
  return stores.value.some((store) => (
    store.enabled
    && Boolean(store.masked.rakutenServiceSecret)
    && Boolean(store.masked.rakutenLicenseKey)
    && !occupied.has(store.id)
  ))
})

watch(visible, (isVisible) => {
  if (isVisible) {
    void loadData()
  }
})

onMounted(() => {
  if (visible.value) {
    void loadData()
  }
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
  <el-dialog
    v-model="visible"
    title="自动上架"
    width="1120px"
    destroy-on-close
    append-to-body
  >
    <div class="dialog-toolbar">
      <el-button
        type="primary"
        :icon="Plus"
        :disabled="!hasAvailableStore"
        @click="createVisible = true"
      >
        创建自动任务
      </el-button>
      <el-button :icon="Refresh" :loading="loading" @click="loadData">
        刷新
      </el-button>
    </div>

    <el-table v-loading="loading" :data="schedules" height="480" empty-text="暂无自动上架任务">
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
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            :loading="operatingId === row.id"
            @click="toggleSchedule(row)"
          >
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
          <el-button
            link
            type="danger"
            :icon="Delete"
            :disabled="operatingId === row.id"
            @click="removeSchedule(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <AutoListingScheduleCreateDialog
      v-model="createVisible"
      :stores="stores"
      :schedules="schedules"
      @created="handleCreated"
    />
  </el-dialog>
</template>

<style scoped>
.dialog-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.result-error {
  color: var(--el-color-danger);
}
</style>
