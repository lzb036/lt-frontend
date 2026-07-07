<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { TimeSettings, TimeSettingsPayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
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

const retentionText = computed(() => `${settings.value?.retentionDays ?? 7} 天`)
const nextCleanupAtText = computed(() => settings.value?.nextCleanupAt || '-')
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

function formatValue(value: string | null | undefined) {
  return value || '-'
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
        <h2>定时清理</h2>
        <el-button :icon="Refresh" :loading="loading" @click="loadSettings">
          刷新
        </el-button>
      </div>

      <div class="cleanup-countdown">
        <span>定时清理倒计时</span>
        <strong>{{ cleanupCountdownText }}</strong>
        <em>{{ nextCleanupAtText }}</em>
      </div>

      <el-form label-position="top" class="time-form">
        <el-form-item label="清理周期">
          <el-select v-model="form.cleanupWeekday" class="full-control" placeholder="选择星期">
            <el-option
              v-for="item in weekdayOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="清理时间">
          <el-time-picker
            v-model="form.cleanupTime"
            class="full-control"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择时间"
          />
        </el-form-item>
        <el-form-item label="保留天数">
          <el-input :model-value="retentionText" disabled />
        </el-form-item>
      </el-form>

      <el-descriptions class="time-summary" :column="2" border>
        <el-descriptions-item label="下次清理">
          {{ formatValue(settings?.nextCleanupAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="上次清理">
          {{ formatValue(settings?.lastCleanupAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="上次删除">
          {{ settings?.lastCleanupDeletedCount ?? 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ formatValue(settings?.updatedAt) }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="time-actions">
        <el-button type="primary" :icon="Check" :loading="saving" @click="saveSettings">
          保存
        </el-button>
      </div>
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

.time-form {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cleanup-countdown {
  display: grid;
  max-width: 320px;
  gap: 2px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  padding: 10px 12px;
  box-shadow: var(--shadow-sm);
}

.cleanup-countdown span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.cleanup-countdown strong {
  color: var(--text-main);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
}

.cleanup-countdown em {
  color: var(--text-soft);
  font-size: 13px;
  font-style: normal;
}

.full-control {
  width: 100%;
}

.time-summary {
  width: 100%;
}

.time-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .time-form {
    grid-template-columns: 1fr;
  }

  .cleanup-countdown {
    max-width: none;
  }
}
</style>
