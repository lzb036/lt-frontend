<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Refresh, RefreshLeft, VideoPlay } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AuthSession,
  ProxyResourceUsage,
  SalesOrderSyncGlobalSettings,
  SalesOrderSyncGlobalSettingsPayload,
  TimeSettings,
  TimeSettingsPayload,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const runningTaskCleanup = shallowRef(false)
const runningUnlistedCleanup = shallowRef(false)
const proxyLoading = shallowRef(false)
const queueLoading = shallowRef(false)
const settings = shallowRef<TimeSettings | null>(null)
const proxyUsage = shallowRef<ProxyResourceUsage | null>(null)
const nowTick = shallowRef(Date.now())
const serverTimeOffsetMs = shallowRef(0)
let countdownTimer: number | undefined
let nextProxyResetRefreshAttemptAt = 0
const isSuperadmin = computed(() => props.session?.role === 'superadmin')

const form = reactive<TimeSettingsPayload>({
  cleanupWeekday: 6,
  cleanupTime: '09:00',
  cleanupEnabled: true,
  productSyncEnabled: true,
  productSyncWeekday: 6,
  productSyncTime: '21:00',
  unlistedCleanupEnabled: true,
})
const DEFAULT_ORDER_SETTINGS: SalesOrderSyncGlobalSettingsPayload = {
  enabled: true,
  intervalMinutes: 30,
  successRetentionDays: 30,
}
const orderState = reactive({
  loading: false,
  saving: false,
  error: '',
  savedSnapshot: null as SalesOrderSyncGlobalSettings | null,
})
const orderDraft = reactive<SalesOrderSyncGlobalSettingsPayload>({ ...DEFAULT_ORDER_SETTINGS })
const orderSettingsDirty = computed(() => (
  JSON.stringify(orderDraft) !== JSON.stringify(orderState.savedSnapshot)
))

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
const productSyncNextAtText = computed(() => settings.value?.productSyncNextAt || '-')
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
  if (!settings.value?.cleanupEnabled) {
    return '已关闭'
  }
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
const productSyncCountdownText = computed(() => {
  if (!settings.value?.productSyncEnabled) {
    return '已关闭'
  }
  const nextAt = parseDateTimeMs(settings.value?.productSyncNextAt)
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
  if (!settings.value?.unlistedCleanupEnabled) {
    return '已关闭'
  }
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
const proxyResetCountdownText = computed(() => {
  const nextAt = parseDateTimeMs(proxyUsage.value?.resetAt)
  if (nextAt === null) {
    return '-'
  }
  return formatCountdown(Math.max(0, nextAt - (nowTick.value + serverTimeOffsetMs.value)))
})

onMounted(() => {
  startCountdown()
  void loadSettings()
  if (isSuperadmin.value) {
    void loadOrderSettings()
  }
  if (isSuperadmin.value) {
    void loadProxyUsage()
  }
})

onBeforeUnmount(() => {
  stopCountdown()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(async () => {
  if (!orderSettingsDirty.value) {
    return true
  }
  try {
    await ElMessageBox.confirm(
      '当前订单同步设置尚未保存，离开后修改将丢失。',
      '确认离开',
      {
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑',
        type: 'warning',
      },
    )
    return true
  } catch {
    return false
  }
})

function startCountdown() {
  if (countdownTimer) {
    return
  }
  nowTick.value = Date.now()
  countdownTimer = window.setInterval(() => {
    const currentNow = Date.now()
    nowTick.value = currentNow
    refreshProxyUsageAfterReset(currentNow)
  }, 1000)
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!orderSettingsDirty.value) {
    return
  }
  event.preventDefault()
  event.returnValue = ''
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

async function loadOrderSettings() {
  orderState.loading = true
  orderState.error = ''
  try {
    const result = await api.getSalesOrderSyncGlobalSettings()
    Object.assign(orderDraft, result)
    orderState.savedSnapshot = { ...result }
    window.addEventListener('beforeunload', handleBeforeUnload)
  } catch (error) {
    orderState.error = toApiErrorMessage(error, '加载订单同步设置失败')
    ElMessage.error(orderState.error)
  } finally {
    orderState.loading = false
  }
}

async function loadProxyUsage(refresh = false) {
  proxyLoading.value = true
  try {
    proxyUsage.value = await api.getProxyResourceUsage(refresh)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载代理流量失败'))
  } finally {
    proxyLoading.value = false
  }
}

async function refreshQueueHealth() {
  queueLoading.value = true
  try {
    const result = await api.getTimeSettings()
    settings.value = settings.value
      ? {
          ...settings.value,
          queueHealth: result.queueHealth,
          serverNow: result.serverNow,
        }
      : result
    applyServerTime(result.serverNow)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '刷新后台队列状态失败'))
  } finally {
    queueLoading.value = false
  }
}

function applySettings(result: TimeSettings) {
  settings.value = result
  applyServerTime(result.serverNow)
  form.cleanupWeekday = result.cleanupWeekday
  form.cleanupTime = result.cleanupTime || '09:00'
  form.cleanupEnabled = result.cleanupEnabled
  form.productSyncEnabled = result.productSyncEnabled
  form.productSyncWeekday = result.productSyncWeekday ?? 6
  form.productSyncTime = result.productSyncTime || '21:00'
  form.unlistedCleanupEnabled = result.unlistedCleanupEnabled
}

function applyServerTime(serverNowValue?: string | null) {
  const serverNow = parseDateTimeMs(serverNowValue)
  serverTimeOffsetMs.value = serverNow === null ? 0 : serverNow - Date.now()
}

function refreshProxyUsageAfterReset(currentNow: number) {
  const resetAt = parseDateTimeMs(proxyUsage.value?.resetAt)
  if (
    resetAt === null
    || resetAt > currentNow + serverTimeOffsetMs.value
    || proxyLoading.value
    || currentNow < nextProxyResetRefreshAttemptAt
  ) {
    return
  }
  nextProxyResetRefreshAttemptAt = currentNow + 60_000
  void loadProxyUsage(true)
}

async function saveSettings() {
  if (!form.cleanupTime) {
    ElMessage.warning('请选择清理时间')
    return
  }
  if (!form.productSyncTime) {
    ElMessage.warning('请选择商品同步时间')
    return
  }
  saving.value = true
  try {
    const result = await api.updateTimeSettings({
      cleanupWeekday: form.cleanupWeekday,
      cleanupTime: form.cleanupTime,
      cleanupEnabled: form.cleanupEnabled,
      productSyncEnabled: form.productSyncEnabled,
      productSyncWeekday: form.productSyncWeekday,
      productSyncTime: form.productSyncTime,
      unlistedCleanupEnabled: form.unlistedCleanupEnabled,
    })
    applySettings(result)
    ElMessage.success('资源管理设置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存时间设置失败'))
  } finally {
    saving.value = false
  }
}

async function saveOrderSettings() {
  orderState.saving = true
  orderState.error = ''
  try {
    const result = await api.updateSalesOrderSyncGlobalSettings({ ...orderDraft })
    Object.assign(orderDraft, result)
    orderState.savedSnapshot = { ...result }
    ElMessage.success('订单同步设置已保存')
  } catch (error) {
    orderState.error = toApiErrorMessage(error, '保存订单同步设置失败')
    ElMessage.error(orderState.error)
  } finally {
    orderState.saving = false
  }
}

function restoreOrderDefaults() {
  Object.assign(orderDraft, DEFAULT_ORDER_SETTINGS)
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

function formatBytes(value?: number | null) {
  const bytes = Math.max(0, Number(value || 0))
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  if (bytes < 1) {
    return '0 B'
  }
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / (1024 ** index)).toFixed(index >= 3 ? 2 : 1)} ${units[index]}`
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
          <el-switch
            v-model="form.cleanupEnabled"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
          <el-button type="danger" :icon="VideoPlay" :loading="runningTaskCleanup" @click="runScheduledTaskCleanupNow">
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
              <el-select v-model="form.cleanupWeekday" :disabled="!form.cleanupEnabled" placeholder="选择星期">
                <el-option
                  v-for="item in weekdayOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-time-picker
                v-model="form.cleanupTime"
                :disabled="!form.cleanupEnabled"
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
          <h2>商品自动同步</h2>
          <p>按统一时间为所有启用且凭据完整的店铺创建商品同步任务</p>
        </div>
        <div class="panel-head-actions">
          <el-switch
            v-model="form.productSyncEnabled"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
          <el-button type="primary" :icon="Check" :loading="saving" @click="saveSettings">
            保存
          </el-button>
        </div>
      </div>

      <div class="compact-layout">
        <el-form label-position="top" class="compact-form">
          <el-form-item label="每周执行">
            <div class="schedule-controls">
              <el-select
                v-model="form.productSyncWeekday"
                :disabled="!form.productSyncEnabled"
                placeholder="选择星期"
              >
                <el-option
                  v-for="item in weekdayOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-time-picker
                v-model="form.productSyncTime"
                :disabled="!form.productSyncEnabled"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="选择时间"
              />
            </div>
          </el-form-item>
        </el-form>

        <div class="status-grid">
          <div class="status-item status-item-primary">
            <span>距下次同步</span>
            <strong>{{ productSyncCountdownText }}</strong>
            <em>{{ productSyncNextAtText }}</em>
          </div>
          <div class="status-item">
            <span>当前状态</span>
            <strong>{{ settings?.productSyncEnabled ? '自动同步已开启' : '自动同步已关闭' }}</strong>
          </div>
          <div class="status-item">
            <span>上次执行</span>
            <strong>{{ formatValue(settings?.productSyncLastAt) }}</strong>
          </div>
          <div class="status-item">
            <span>上次任务数</span>
            <strong>{{ settings?.productSyncLastTaskCount ?? 0 }} 个</strong>
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
        <div class="panel-head-actions">
          <el-switch
            v-model="form.unlistedCleanupEnabled"
            inline-prompt
            active-text="开启"
            inactive-text="关闭"
          />
          <el-button
            type="danger"
            :icon="VideoPlay"
            :loading="runningUnlistedCleanup"
            @click="runUnlistedProductCleanupNow"
          >
            立即执行
          </el-button>
          <el-button type="primary" :icon="Check" :loading="saving" @click="saveSettings">
            保存
          </el-button>
        </div>
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

    <section v-if="isSuperadmin" v-loading="orderState.loading" class="time-panel">
      <div class="time-panel-head">
        <div>
          <h2>订单自动同步</h2>
        </div>
        <div class="head-actions">
          <el-tag v-if="orderSettingsDirty" type="warning" effect="plain">
            有未保存修改
          </el-tag>
          <el-button
            :icon="RefreshLeft"
            :disabled="orderState.loading || orderState.saving || !orderState.savedSnapshot"
            @click="restoreOrderDefaults"
          >
            恢复默认
          </el-button>
          <el-button
            type="primary"
            :icon="Check"
            :loading="orderState.saving"
            :disabled="orderState.loading || !orderSettingsDirty"
            @click="saveOrderSettings"
          >
            保存
          </el-button>
        </div>
      </div>

      <el-result
        v-if="orderState.error && !orderState.savedSnapshot"
        icon="error"
        title="订单同步设置加载失败"
        :sub-title="orderState.error"
      >
        <template #extra>
          <el-button type="primary" :icon="RefreshLeft" @click="loadOrderSettings">
            重试
          </el-button>
        </template>
      </el-result>
      <el-form v-else label-position="top" class="settings-form">
        <div class="setting-grid">
          <section class="setting-card setting-card-primary">
            <div class="setting-card-copy">
              <span>自动同步</span>
              <strong>{{ orderDraft.enabled ? '已启用' : '已停用' }}</strong>
              <small>关闭后停止自动获取订单，手动立即更新仍可使用。</small>
            </div>
            <el-switch v-model="orderDraft.enabled" />
          </section>

          <section class="setting-card">
            <div class="setting-card-copy">
              <span>同步间隔</span>
              <strong>{{ orderDraft.intervalMinutes }} 分钟</strong>
              <small>系统按照该间隔检查并获取各店铺新增或变更订单。</small>
            </div>
            <el-input-number
              v-model="orderDraft.intervalMinutes"
              class="setting-control"
              :min="5"
              :max="1440"
              :step="5"
            />
          </section>

          <section class="setting-card">
            <div class="setting-card-copy">
              <span>成功记录保留</span>
              <strong>{{ orderDraft.successRetentionDays }} 天</strong>
              <small>只清理订单获取任务记录，不会删除订单和销量数据。</small>
            </div>
            <el-input-number
              v-model="orderDraft.successRetentionDays"
              class="setting-control"
              :min="1"
              :max="365"
            />
          </section>
        </div>
      </el-form>
    </section>

    <section v-if="isSuperadmin" v-loading="proxyLoading" class="time-panel proxy-usage-panel">
      <div class="time-panel-head">
        <div>
          <h2>代理流量</h2>
          <p>每月 {{ proxyUsage?.resetDay ?? 2 }} 日重置</p>
        </div>
        <div class="panel-head-actions">
          <el-tag v-if="proxyUsage?.stale" type="warning">缓存数据</el-tag>
          <el-tag v-else-if="proxyUsage" type="success">订阅数据</el-tag>
          <el-button :icon="Refresh" :loading="proxyLoading" @click="loadProxyUsage(true)">
            刷新流量
          </el-button>
        </div>
      </div>

      <div class="proxy-progress-row">
        <el-progress
          :percentage="proxyUsage?.usagePercent ?? 0"
          :stroke-width="14"
          :color="(proxyUsage?.usagePercent ?? 0) >= 90 ? 'var(--danger)' : 'var(--accent)'"
        />
      </div>

      <div class="proxy-usage-main">
        <strong>
          已用 {{ formatBytes(proxyUsage?.usedBytes) }}
          <span>/ 总计 {{ formatBytes(proxyUsage?.totalBytes) }}</span>
        </strong>
        <div class="proxy-usage-meta">
          <span>剩余 {{ formatBytes(proxyUsage?.remainingBytes) }}</span>
          <span>距离重置 {{ proxyResetCountdownText }}</span>
          <span>更新时间 {{ formatValue(proxyUsage?.checkedAt) }}</span>
        </div>
      </div>
    </section>

    <section v-if="isSuperadmin" v-loading="loading || queueLoading" class="time-panel">
      <div class="time-panel-head">
        <h2>后台队列状态</h2>
        <div class="panel-head-actions">
          <el-tag :type="queueHealthTagType">
            {{ queueHealthStatusText }}
          </el-tag>
          <el-button
            :icon="Refresh"
            :loading="loading || queueLoading"
            @click="refreshQueueHealth"
          >
            刷新队列
          </el-button>
        </div>
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

.panel-head-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.proxy-progress-row :deep(.el-progress-bar__outer) {
  background: var(--panel-muted);
}

.proxy-usage-main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
}

.proxy-usage-main > strong {
  color: var(--text-main);
  font-size: 24px;
  font-weight: 800;
}

.proxy-usage-main > strong span {
  color: var(--text-muted);
  font-size: 16px;
  font-weight: 600;
}

.proxy-usage-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 18px;
  color: var(--text-muted);
  font-size: 13px;
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

  .panel-head-actions {
    width: 100%;
  }

  .panel-head-actions .el-button {
    flex: 1;
  }

  .proxy-usage-main {
    align-items: flex-start;
    flex-direction: column;
  }

  .proxy-usage-main > strong {
    font-size: 20px;
  }

  .proxy-usage-meta {
    justify-content: flex-start;
  }
}
</style>
