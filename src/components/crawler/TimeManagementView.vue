<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Refresh, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { TimeSettings, TimeSettingsPayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const runningTaskCleanup = shallowRef(false)
const runningUnlistedCleanup = shallowRef(false)
const settings = shallowRef<TimeSettings | null>(null)
const nowTick = shallowRef(Date.now())
const serverTimeOffsetMs = shallowRef(0)
let countdownTimer: number | undefined

const form = reactive<TimeSettingsPayload>({
  cleanupWeekday: 6,
  cleanupTime: '09:00',
})

const weekdayOptions = [
  { label: '周一', value: 0 },
  { label: '周二', value: 1 },
  { label: '周三', value: 2 },
  { label: '周四', value: 3 },
  { label: '周五', value: 4 },
  { label: '周六', value: 5 },
  { label: '周日', value: 6 },
]

const nextCleanupAtText = computed(() => settings.value?.nextCleanupAt || '-')
const unlistedCleanupTimeText = computed(() => {
  const day = settings.value?.unlistedCleanupMonthDay ?? 1
  const time = settings.value?.unlistedCleanupTime || '01:00'
  return `每月 ${day} 号 ${time}`
})
const unlistedNextCleanupAtText = computed(() => settings.value?.unlistedNextCleanupAt || '-')
const queueHealth = computed(() => settings.value?.queueHealth || null)
const queueHealthTagType = computed(() => {
  if (!queueHealth.value) {
    return 'info'
  }
  if (queueHealth.value.status === 'ok' || queueHealth.value.status === 'disabled') {
    return 'success'
  }
  if (queueHealth.value.status === 'degraded') {
    return 'warning'
  }
  return 'danger'
})
const queueHealthStatusText = computed(() => {
  if (!queueHealth.value) {
    return '未获取'
  }
  if (queueHealth.value.status === 'ok') {
    return '正常'
  }
  if (queueHealth.value.status === 'disabled') {
    return '未启用'
  }
  if (queueHealth.value.status === 'degraded') {
    return '异常'
  }
  return '连接失败'
})
const cleanupCountdownText = computed(() => {
  const nextAt = parseDateTimeMs(settings.value?.nextCleanupAt)
  if (nextAt === null) {
    return '未获取'
  }
  const remainingMs = nextAt - (nowTick.value + serverTimeOffsetMs.value)
  if (remainingMs <= 0) {
    return '待执行'
  }
  return formatCountdown(remainingMs)
})
const unlistedCleanupCountdownText = computed(() => {
  const nextAt = parseDateTimeMs(settings.value?.unlistedNextCleanupAt)
  if (nextAt === null) {
    return '未获取'
  }
  const remainingMs = nextAt - (nowTick.value + serverTimeOffsetMs.value)
  if (remainingMs <= 0) {
    return '待执行'
  }
  return formatCountdown(remainingMs)
})

onMounted(() => {
  startCountdown()
  void loadSettings()
})

onBeforeUnmount(() => {
  stopCountdown()
})

function startCountdown() {
  if (countdownTimer) {
    return
  }
  nowTick.value = Date.now()
  countdownTimer = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
}

function stopCountdown() {
  if (!countdownTimer) {
    return
  }
  window.clearInterval(countdownTimer)
  countdownTimer = undefined
}

async function loadSettings() {
  loading.value = true
  try {
    const result = await api.getTimeSettings()
    applySettings(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载时间设置失败'))
  } finally {
    loading.value = false
  }
}

function applySettings(result: TimeSettings) {
  settings.value = result
  const serverNow = parseDateTimeMs(result.serverNow)
  serverTimeOffsetMs.value = serverNow === null ? 0 : serverNow - Date.now()
  form.cleanupWeekday = result.cleanupWeekday
  form.cleanupTime = result.cleanupTime || '09:00'
}

async function saveSettings() {
  if (!form.cleanupTime) {
    ElMessage.warning('请选择清理时间')
    return
  }
  saving.value = true
  try {
    const result = await api.updateTimeSettings({
      cleanupWeekday: form.cleanupWeekday,
      cleanupTime: form.cleanupTime,
    })
    applySettings(result)
    ElMessage.success('时间设置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存时间设置失败'))
  } finally {
    saving.value = false
  }
}

async function runScheduledTaskCleanupNow() {
  try {
    await ElMessageBox.confirm(
      '确认立即清理所有非运行中的定时采集任务记录？该操作只删除任务记录，不会删除定时计划和商品数据。',
      '立即清理',
      {
        confirmButtonText: '执行',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    runningTaskCleanup.value = true
    const result = await api.runScheduledTaskCleanup()
    applySettings(result)
    ElMessage.success(`已清理 ${result.lastCleanupDeletedCount} 条定时采集任务记录`)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '执行清理失败'))
    }
  } finally {
    runningTaskCleanup.value = false
  }
}

async function runUnlistedProductCleanupNow() {
  try {
    await ElMessageBox.confirm(
      '确认立即为所有启用店铺创建未上架商品删除任务？该操作会同步删除乐天商品，并尝试删除关联的 R-Cabinet 图片。',
      '立即删除未上架商品',
      {
        confirmButtonText: '执行',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    runningUnlistedCleanup.value = true
    const result = await api.runUnlistedProductCleanup()
    applySettings(result.settings)
    const { taskCount, productCount } = result.summary
    if (productCount > 0) {
      ElMessage.success(`已创建 ${taskCount} 个删除任务，涉及 ${productCount} 个未上架商品`)
    } else {
      ElMessage.success('没有需要删除的未上架商品，倒计时已重置')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '执行未上架商品删除失败'))
    }
  } finally {
    runningUnlistedCleanup.value = false
  }
}

function formatValue(value: string | null | undefined) {
  return value || '-'
}

function queuePendingText(row: { queued: number; started: number; deferred: number; scheduled: number }) {
  return row.queued + row.started + row.deferred + row.scheduled
}

function parseDateTimeMs(value: string | null | undefined) {
  if (!value) {
    return null
  }
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const timePart = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  return days > 0 ? `${days}天 ${timePart}` : timePart
}
</script>

<template>
  <section class="page-stack">
    <section v-loading="loading" class="time-panel">
      <div class="time-panel-head">
        <div>
          <h2>定时采集记录清理</h2>
          <p>每周自动清理超过 {{ settings?.retentionDays ?? 7 }} 天的已完成记录</p>
        </div>
        <div class="head-actions">
          <el-button :icon="Refresh" :loading="loading" @click="loadSettings">
            刷新
          </el-button>
          <el-button :icon="VideoPlay" :loading="runningTaskCleanup" @click="runScheduledTaskCleanupNow">
            立即执行
          </el-button>
          <el-button type="primary" :icon="Check" :loading="saving" @click="saveSettings">
            保存
          </el-button>
        </div>
      </div>

      <div class="compact-layout">
        <el-form label-position="top" class="compact-form">
          <el-form-item label="每周执行">
            <div class="schedule-controls">
              <el-select v-model="form.cleanupWeekday" placeholder="选择星期">
                <el-option
                  v-for="item in weekdayOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-time-picker
                v-model="form.cleanupTime"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
              />
            </div>
          </el-form-item>
        </el-form>

        <div class="status-grid">
          <div class="status-item status-item-primary">
            <span>距下次清理</span>
            <strong>{{ cleanupCountdownText }}</strong>
            <em>{{ nextCleanupAtText }}</em>
          </div>
          <div class="status-item">
            <span>上次清理</span>
            <strong>{{ formatValue(settings?.lastCleanupAt) }}</strong>
          </div>
          <div class="status-item">
            <span>上次删除</span>
            <strong>{{ settings?.lastCleanupDeletedCount ?? 0 }} 条</strong>
          </div>
          <div class="status-item">
            <span>设置更新</span>
            <strong>{{ formatValue(settings?.updatedAt) }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section v-loading="loading" class="time-panel">
      <div class="time-panel-head">
        <div>
          <h2>未上架商品月度删除</h2>
          <p>为启用店铺创建商品删除同步任务</p>
        </div>
        <el-button
          type="danger"
          :icon="VideoPlay"
          :loading="runningUnlistedCleanup"
          @click="runUnlistedProductCleanupNow"
        >
          立即执行
        </el-button>
      </div>

      <div class="status-grid status-grid-wide">
        <div class="status-item status-item-primary">
          <span>{{ unlistedCleanupTimeText }}</span>
          <strong>{{ unlistedCleanupCountdownText }}</strong>
          <em>{{ unlistedNextCleanupAtText }}</em>
        </div>
        <div class="status-item">
          <span>上次执行</span>
          <strong>{{ formatValue(settings?.unlistedLastCleanupAt) }}</strong>
        </div>
        <div class="status-item">
          <span>上次商品数</span>
          <strong>{{ settings?.unlistedLastDeletedCount ?? 0 }} 个</strong>
        </div>
        <div class="status-item">
          <span>上次任务数</span>
          <strong>{{ settings?.unlistedLastTaskCount ?? 0 }} 个</strong>
        </div>
      </div>
    </section>

    <section v-loading="loading" class="time-panel">
      <div class="time-panel-head">
        <h2>后台队列状态</h2>
        <el-tag :type="queueHealthTagType">
          {{ queueHealthStatusText }}
        </el-tag>
      </div>

      <el-alert
        v-if="queueHealth && !queueHealth.ok"
        :title="queueHealth.summary || '后台队列异常'"
        :description="queueHealth.error || undefined"
        type="error"
        show-icon
        :closable="false"
      />

      <el-descriptions class="time-summary" :column="3" border>
        <el-descriptions-item label="队列模式">
          {{ queueHealth?.mode || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Worker 数">
          {{ queueHealth?.workerCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="检测时间">
          {{ formatValue(queueHealth?.checkedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="Redis 内存">
          {{ queueHealth?.redis?.usedMemoryHuman || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Redis 上限">
          {{ queueHealth?.redis && queueHealth.redis.maxMemory > 0 ? queueHealth.redis.maxMemoryHuman : '未限制' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态说明">
          {{ queueHealth?.summary || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-table :data="queueHealth?.queues || []" size="small" class="queue-health-table">
        <el-table-column prop="kind" label="类型" width="90" />
        <el-table-column prop="name" label="队列" min-width="180" show-overflow-tooltip />
        <el-table-column prop="workerCount" label="Worker" width="90" />
        <el-table-column label="待处理" width="90">
          <template #default="{ row }">
            {{ queuePendingText(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="queued" label="排队" width="80" />
        <el-table-column prop="started" label="执行" width="80" />
        <el-table-column prop="scheduled" label="定时" width="80" />
        <el-table-column prop="failed" label="失败" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'">
              {{ row.ok ? '正常' : '异常' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.time-panel {
  display: grid;
  gap: 18px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.time-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.time-panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
  font-weight: 800;
}

.time-panel-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.compact-layout {
  display: grid;
  grid-template-columns: minmax(300px, 0.8fr) minmax(560px, 2fr);
  gap: 18px;
  align-items: start;
}

.compact-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.schedule-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.schedule-controls :deep(.el-select),
.schedule-controls :deep(.el-date-editor) {
  width: 100%;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid var(--panel-border);
}

.status-item {
  display: grid;
  align-content: center;
  min-height: 74px;
  gap: 5px;
  padding: 10px 14px;
  border-right: 1px solid var(--panel-border);
}

.status-item:last-child {
  border-right: 0;
}

.status-item span,
.status-item em {
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
}

.status-item strong {
  color: var(--text-main);
  font-size: 14px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.status-item-primary strong {
  font-size: 20px;
}

.status-item-primary em {
  color: var(--text-soft);
}

.queue-health-table {
  width: 100%;
}

@media (max-width: 960px) {
  .compact-layout,
  .status-grid {
    grid-template-columns: 1fr;
  }

  .status-item {
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
  }

  .status-item:last-child {
    border-bottom: 0;
  }

  .time-panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-actions {
    width: 100%;
  }

  .head-actions .el-button {
    flex: 1;
  }
}
</style>
