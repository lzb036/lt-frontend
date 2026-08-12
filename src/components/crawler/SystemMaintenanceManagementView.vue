<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCheck,
  Clock,
  RefreshRight,
  Setting,
  SwitchButton,
  VideoPause,
  VideoPlay,
  WarningFilled,
} from '@element-plus/icons-vue'

import { useMaintenance } from '../../composables/useMaintenance'
import type {
  AuthSession,
  MaintenanceSettingsPayload,
  TaskControlCounts,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import MaintenancePreview from '../maintenance/MaintenancePreview.vue'

defineProps<{
  session: AuthSession | null
}>()

const api = useMaintenance()
const loading = shallowRef(false)
const saving = shallowRef(false)
const taskControlLoading = shallowRef(false)
const taskControlAction = shallowRef<'stop' | 'resume' | ''>('')
const loaded = shallowRef(false)
const form = reactive<MaintenanceSettingsPayload>({
  enabled: false,
  title: '系统维护中',
  message: '系统正在进行维护升级，请稍后再试。',
  startsAt: null,
  estimatedEndsAt: null,
})

const status = computed(() => {
  if (api.maintenance.value?.active) {
    return { label: '维护中', type: 'warning' as const, icon: WarningFilled }
  }
  if (api.maintenance.value?.scheduled) {
    return { label: '已计划', type: 'primary' as const, icon: Clock }
  }
  return { label: '正常运行', type: 'success' as const, icon: CircleCheck }
})

const activationHint = computed(() => {
  if (!form.enabled) {
    return '保存后不会限制普通用户访问。'
  }
  if (form.startsAt) {
    return '保存后将在开始时间到达时自动进入维护模式。'
  }
  return '保存后将立即进入维护模式。'
})

const taskControlStatus = computed(() => api.taskControl.value)
const taskControlPaused = computed(() => Boolean(taskControlStatus.value?.paused))
const taskControlTransitioning = computed(() => (
  taskControlStatus.value?.phase === 'stopping'
  || taskControlStatus.value?.phase === 'resuming'
))
const taskControlStateLabel = computed(() => {
  if (taskControlStatus.value?.phase === 'stopping') {
    return '正在停止任务'
  }
  if (taskControlStatus.value?.phase === 'resuming') {
    return '正在恢复任务'
  }
  return taskControlPaused.value ? '任务调度已暂停' : '任务调度正常'
})
const taskCountItems = computed(() => {
  const counts = taskControlStatus.value?.activeCounts
  return [
    { key: 'crawl' as const, label: '采集任务', value: counts?.crawl || 0 },
    { key: 'listing' as const, label: '上架任务', value: counts?.listing || 0 },
    { key: 'sync' as const, label: '同步及图片任务', value: counts?.sync || 0 },
    { key: 'salesOrderSync' as const, label: '订单同步', value: counts?.salesOrderSync || 0 },
    { key: 'imageCleanupRecords' as const, label: '待清理图片', value: counts?.imageCleanupRecords || 0 },
  ]
})
const lastOperationLabel = computed(() => {
  const control = taskControlStatus.value
  if (!control?.operationId) {
    return '暂无全局任务管控记录'
  }
  if (control.paused) {
    return `${control.stoppedBy || '超级管理员'} 于 ${formatDateTime(control.stoppedAt)} 停止全部任务`
  }
  if (control.resumedAt) {
    return `${control.resumedBy || '超级管理员'} 于 ${formatDateTime(control.resumedAt)} 恢复全部任务`
  }
  return '任务调度正常'
})

onMounted(() => {
  void Promise.all([loadSettings(), loadTaskControl()])
})

async function loadSettings() {
  loading.value = true
  try {
    const settings = await api.fetchMaintenanceSettings()
    form.enabled = settings.enabled
    form.title = settings.title
    form.message = settings.message
    form.startsAt = toPickerValue(settings.startsAt)
    form.estimatedEndsAt = toPickerValue(settings.estimatedEndsAt)
    loaded.value = true
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载维护设置失败'))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入维护提示标题')
    return
  }
  if (!form.message.trim()) {
    ElMessage.warning('请输入维护提示内容')
    return
  }
  if (form.startsAt && form.estimatedEndsAt && new Date(form.estimatedEndsAt) <= new Date(form.startsAt)) {
    ElMessage.warning('预计维护完成时间必须晚于开始维护时间')
    return
  }
  if (form.enabled) {
    try {
      await ElMessageBox.confirm(
        form.startsAt
          ? '确认保存并启用维护计划？开始时间到达后，除超级管理员外的用户将无法进入业务页面。'
          : '确认立即开启维护模式？开启后，除超级管理员外的用户将立即进入维护提示页。',
        form.startsAt ? '启用维护计划' : '立即开启维护',
        {
          confirmButtonText: '确认启用',
          cancelButtonText: '取消',
          type: 'warning',
        },
      )
    } catch {
      return
    }
  }

  saving.value = true
  try {
    const settings = await api.updateMaintenanceSettings({
      enabled: form.enabled,
      title: form.title.trim(),
      message: form.message.trim(),
      startsAt: form.startsAt || null,
      estimatedEndsAt: form.estimatedEndsAt || null,
    })
    form.startsAt = toPickerValue(settings.startsAt)
    form.estimatedEndsAt = toPickerValue(settings.estimatedEndsAt)
    ElMessage.success(settings.active ? '维护模式已开启' : settings.scheduled ? '维护计划已保存' : '维护设置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存维护设置失败'))
  } finally {
    saving.value = false
  }
}

async function loadTaskControl() {
  taskControlLoading.value = true
  try {
    await api.fetchTaskControlStatus()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载任务管控状态失败'))
  } finally {
    taskControlLoading.value = false
  }
}

async function stopAllTasks() {
  try {
    const result = await ElMessageBox.prompt(
      '该操作会停止所有用户正在执行和等待执行的任务，暂停后台调度，但不会关闭 worker，也不会删除任务记录。请输入“停止全部任务”确认。',
      '停止全部任务',
      {
        confirmButtonText: '确认停止',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: '停止全部任务',
        inputValidator: (value) => value === '停止全部任务' || '请输入“停止全部任务”',
      },
    )
    if (result.value !== '停止全部任务') {
      return
    }
  } catch {
    return
  }
  taskControlAction.value = 'stop'
  try {
    const control = await api.stopAllTasks()
    ElMessage.success(`已停止本次维护范围内的任务，可恢复 ${control.resumableCount} 项`)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '停止全部任务失败'))
  } finally {
    taskControlAction.value = ''
    await loadTaskControl()
  }
}

async function resumeAllTasks() {
  try {
    await ElMessageBox.confirm(
      `确认恢复本次维护停止的 ${taskControlStatus.value?.resumableCount || 0} 项任务？系统只会恢复本次停止快照中的任务和计划，不会恢复历史取消或失败任务。`,
      '全部恢复',
      {
        confirmButtonText: '确认恢复',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  taskControlAction.value = 'resume'
  try {
    const control = await api.resumeAllTasks()
    const errors = control.lastResult.errors || []
    if (errors.length > 0) {
      await ElMessageBox.alert(
        `已恢复大部分任务，另有 ${errors.length} 项因状态变化或业务条件不满足未恢复。`,
        '恢复结果',
        { type: 'warning', confirmButtonText: '知道了' },
      )
    } else {
      ElMessage.success('本次维护停止的任务已全部恢复')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '恢复全部任务失败'))
  } finally {
    taskControlAction.value = ''
    await loadTaskControl()
  }
}

function toPickerValue(value?: string | null) {
  return value ? value.slice(0, 16) : null
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return '未记录'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function countValue(key: keyof TaskControlCounts) {
  return taskControlStatus.value?.activeCounts[key] || 0
}
</script>

<template>
  <section class="maintenance-management page-stack">
    <header class="page-head">
      <div>
        <p class="eyebrow">System Operations</p>
        <h1>系统维护管理</h1>
        <p class="page-description">配置维护窗口和普通用户看到的提示内容。</p>
      </div>
      <div class="head-actions">
        <el-tag :type="status.type" effect="light" size="large">
          <el-icon><component :is="status.icon" /></el-icon>
          {{ status.label }}
        </el-tag>
        <el-button :icon="RefreshRight" :loading="loading" @click="loadSettings">刷新</el-button>
      </div>
    </header>

    <div v-loading="loading && !loaded" class="maintenance-layout">
      <section class="settings-panel">
        <div class="panel-heading">
          <div class="panel-heading-icon"><el-icon><Setting /></el-icon></div>
          <div>
            <h2>维护设置</h2>
            <p>维护期间超级管理员仍可正常登录和操作。</p>
          </div>
        </div>

        <el-form label-position="top" class="maintenance-form">
          <el-form-item>
            <div class="switch-row">
              <div>
                <strong>开启维护管理</strong>
                <span>{{ activationHint }}</span>
              </div>
              <el-switch
                v-model="form.enabled"
                inline-prompt
                active-text="开启"
                inactive-text="关闭"
                style="--el-switch-on-color: #d8942f"
              />
            </div>
          </el-form-item>

          <div class="time-grid">
            <el-form-item label="开始维护时间">
              <el-date-picker
                v-model="form.startsAt"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm"
                format="YYYY-MM-DD HH:mm"
                placeholder="不填写则立即生效"
                clearable
              />
            </el-form-item>
            <el-form-item label="预计维护完成时间">
              <el-date-picker
                v-model="form.estimatedEndsAt"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm"
                format="YYYY-MM-DD HH:mm"
                placeholder="选择预计恢复时间"
                clearable
              />
            </el-form-item>
          </div>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="预计完成时间仅用于向用户展示，不会自动关闭维护模式。维护结束后请手动关闭开关。"
          />

          <el-form-item label="维护提示标题">
            <el-input
              v-model="form.title"
              maxlength="255"
              show-word-limit
              placeholder="例如：系统升级维护中"
            />
          </el-form-item>

          <el-form-item label="维护提示内容">
            <el-input
              v-model="form.message"
              type="textarea"
              :rows="6"
              maxlength="5000"
              show-word-limit
              resize="vertical"
              placeholder="填写维护原因、影响范围或其他需要向用户说明的内容"
            />
          </el-form-item>

          <div class="form-actions">
            <el-button type="primary" :loading="saving" @click="saveSettings">
              保存维护设置
            </el-button>
          </div>
        </el-form>
      </section>

      <MaintenancePreview :settings="form" />
    </div>

    <section v-loading="taskControlLoading" class="task-control-panel">
      <div class="task-control-head">
        <div class="panel-heading task-control-heading">
          <div
            class="panel-heading-icon"
            :class="{ 'is-paused': taskControlPaused }"
          >
            <el-icon>
              <VideoPause v-if="taskControlPaused" />
              <SwitchButton v-else />
            </el-icon>
          </div>
          <div>
            <h2>全局任务管控</h2>
            <p>停止或恢复所有用户本次维护范围内的任务，worker 始终保持运行。</p>
          </div>
        </div>
        <div class="task-control-actions">
          <el-tag :type="taskControlPaused ? 'warning' : 'success'" effect="light" size="large">
            {{ taskControlStateLabel }}
          </el-tag>
          <el-button :icon="RefreshRight" :loading="taskControlLoading" @click="loadTaskControl">
            刷新状态
          </el-button>
        </div>
      </div>

      <div class="task-count-grid">
        <div v-for="item in taskCountItems" :key="item.key" class="task-count-item">
          <span>{{ item.label }}</span>
          <strong>{{ countValue(item.key) }}</strong>
        </div>
      </div>

      <div class="task-control-summary">
        <div>
          <span>当前活跃任务</span>
          <strong>{{ taskControlStatus?.activeTotal || 0 }}</strong>
        </div>
        <div>
          <span>本次可恢复项目</span>
          <strong>{{ taskControlStatus?.resumableCount || 0 }}</strong>
        </div>
        <p>{{ lastOperationLabel }}</p>
      </div>

      <el-alert
        v-if="taskControlPaused"
        type="warning"
        :closable="false"
        show-icon
        title="任务调度已暂停。所有用户不能创建新任务，自动上架、自动删除、定时采集和订单同步也不会触发。"
      />
      <el-alert
        v-else
        type="info"
        :closable="false"
        show-icon
        title="全部恢复只处理最近一次“停止全部任务”生成的快照，不会恢复此前由用户取消、失败或禁用的历史任务。"
      />

      <div class="danger-actions">
        <el-button
          v-if="!taskControlPaused"
          type="danger"
          :icon="VideoPause"
          :loading="taskControlAction === 'stop'"
          :disabled="taskControlTransitioning"
          @click="stopAllTasks"
        >
          停止全部任务
        </el-button>
        <el-button
          v-else
          type="primary"
          :icon="VideoPlay"
          :loading="taskControlAction === 'resume'"
          :disabled="taskControlTransitioning"
          @click="resumeAllTasks"
        >
          全部恢复
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

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.page-head h1 {
  margin: 3px 0 0;
  color: var(--text-main);
  font-size: 22px;
  letter-spacing: 0;
}

.eyebrow {
  margin: 0;
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 800;
}

.page-description {
  margin: 7px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-actions :deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.maintenance-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr);
  align-items: start;
  gap: 20px;
}

.settings-panel {
  padding: 22px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.task-control-panel {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.task-control-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--panel-border);
}

.task-control-heading {
  padding-bottom: 0;
  border-bottom: 0;
}

.panel-heading-icon.is-paused {
  color: #8a5d18;
  background: #f8edd9;
}

.task-control-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-count-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.task-count-item {
  min-width: 0;
  display: grid;
  gap: 7px;
  padding: 14px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: var(--page-bg);
}

.task-count-item span {
  color: var(--text-faint);
  font-size: 12px;
}

.task-count-item strong {
  color: var(--text-main);
  font-size: 22px;
  line-height: 1;
}

.task-control-summary {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  padding: 14px 16px;
  border-left: 3px solid #5b8399;
  background: var(--page-bg);
}

.task-control-summary div {
  display: grid;
  gap: 3px;
}

.task-control-summary span {
  color: var(--text-faint);
  font-size: 11px;
}

.task-control-summary strong {
  color: var(--text-main);
  font-size: 17px;
}

.task-control-summary p {
  margin: 0;
  color: var(--text-soft);
  font-size: 12px;
  text-align: right;
}

.danger-actions {
  display: flex;
  justify-content: flex-end;
}

.panel-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--panel-border);
}

.panel-heading-icon {
  width: 42px;
  height: 42px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  color: #2c5f7d;
  background: #eaf3f7;
  font-size: 21px;
}

.panel-heading h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 16px;
}

.panel-heading p {
  margin: 5px 0 0;
  color: var(--text-faint);
  font-size: 12px;
}

.maintenance-form {
  display: grid;
  gap: 2px;
  margin-top: 20px;
}

.switch-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: var(--page-bg);
}

.switch-row strong,
.switch-row span {
  display: block;
}

.switch-row strong {
  color: var(--text-main);
  font-size: 14px;
}

.switch-row span {
  margin-top: 4px;
  color: var(--text-faint);
  font-size: 12px;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.time-grid :deep(.el-date-editor) {
  width: 100%;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

@media (max-width: 1080px) {
  .maintenance-layout {
    grid-template-columns: 1fr;
  }

  .task-count-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .page-head,
  .switch-row,
  .task-control-head {
    align-items: stretch;
    flex-direction: column;
  }

  .head-actions {
    justify-content: space-between;
  }

  .time-grid {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    padding: 16px;
  }

  .task-control-panel {
    padding: 16px;
  }

  .task-control-actions {
    justify-content: space-between;
  }

  .task-count-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .task-control-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .task-control-summary p {
    grid-column: 1 / -1;
    text-align: left;
  }
}
</style>
