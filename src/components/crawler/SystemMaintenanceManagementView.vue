<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue'
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
import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AuthSession,
  MaintenanceSettingsPayload,
  UserAccount,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import AnnouncementManagementPanel from './AnnouncementManagementPanel.vue'

defineProps<{
  session: AuthSession | null
}>()

const api = useMaintenance()
const collectorApi = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const taskControlLoading = shallowRef(false)
const taskControlAction = shallowRef<'stop' | 'resume' | ''>('')
const usersLoading = shallowRef(false)
const users = shallowRef<UserAccount[]>([])
const selectedUsernames = shallowRef<string[]>([])
const taskControlFeedback = shallowRef('')
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

const taskControlStatus = computed(() => api.taskControl.value)
const taskControlPaused = computed(() => Boolean(taskControlStatus.value?.paused))
const taskControlDeploySafe = computed(() => Boolean(taskControlStatus.value?.deploySafe))
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
  if (taskControlStatus.value?.phase === 'stop_failed') {
    return '停止不完整'
  }
  if (taskControlStatus.value?.phase === 'resume_failed') {
    return '恢复失败'
  }
  if (taskControlDeploySafe.value) {
    return '已静默，可以部署'
  }
  return taskControlPaused.value ? '任务调度已暂停' : '任务调度正常'
})
const taskControlTagType = computed(() => {
  if (
    taskControlStatus.value?.phase === 'stop_failed'
    || taskControlStatus.value?.phase === 'resume_failed'
  ) {
    return 'danger' as const
  }
  if (taskControlDeploySafe.value) {
    return 'success' as const
  }
  return taskControlPaused.value ? 'warning' as const : 'success' as const
})
const taskControlErrors = computed(() => taskControlStatus.value?.lastResult.errors || [])
const taskControlQueue = computed(() => taskControlStatus.value?.lastResult.quiescence?.queue)
const taskControlSelectionLocked = computed(() => Boolean(taskControlStatus.value?.selectionLocked))
const selectableUsers = computed(() => users.value)
const allUsersSelected = computed(() => (
  selectableUsers.value.length > 0
  && selectableUsers.value.every((user) => selectedUsernames.value.includes(user.username))
))
const taskControlAlertType = computed(() => {
  if (taskControlStatus.value?.phase === 'stop_failed' || taskControlStatus.value?.phase === 'resume_failed') {
    return 'error' as const
  }
  if (taskControlDeploySafe.value || taskControlStatus.value?.lastResult.action === 'resume') {
    return 'success' as const
  }
  return taskControlPaused.value ? 'warning' as const : 'info' as const
})
const taskControlAlertTitle = computed(() => {
  if (taskControlFeedback.value) {
    return taskControlFeedback.value
  }
  if (taskControlStatus.value?.phase === 'stopping') {
    return '正在停止所选用户的任务并确认队列静默，请勿开始部署。'
  }
  if (taskControlStatus.value?.phase === 'resuming') {
    return '正在恢复本次停止快照中的任务和计划。'
  }
  if (taskControlStatus.value?.phase === 'stop_failed') {
    return taskControlErrors.value[0] || '任务停止不完整，当前禁止部署。'
  }
  if (taskControlStatus.value?.phase === 'resume_failed') {
    return taskControlErrors.value[0] || '本次恢复失败，用户选择仍保持锁定，请重试恢复。'
  }
  if (taskControlDeploySafe.value) {
    return `所选 ${taskControlStatus.value?.selectedUsernames.length || 0} 个用户已确认静默，可以开始部署。`
  }
  if (taskControlStatus.value?.lastResult.action === 'resume') {
    const errors = taskControlErrors.value.length
    return errors
      ? `恢复已完成，但有 ${errors} 项因状态变化未恢复。`
      : '本次停止的用户任务和计划已恢复，现可重新选择用户。'
  }
  return '选择用户后执行停止。停止成功前不可部署，恢复完成后才可开始下一次操作。'
})

onMounted(() => {
  void Promise.all([loadSettings(), loadTaskControl(), loadUsers()])
})

watch(
  () => taskControlStatus.value?.selectedUsernames,
  (usernames) => {
    if (taskControlSelectionLocked.value) {
      selectedUsernames.value = [...(usernames || [])]
    }
  },
  { deep: true },
)

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
          ? '确认保存并启用维护计划？开始时间到达后，除超级管理员和 test 测试用户外，其他用户将无法进入业务页面。'
          : '确认立即开启维护模式？开启后，除超级管理员和 test 测试用户外，其他用户将立即进入维护提示页。',
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

async function loadUsers() {
  usersLoading.value = true
  try {
    users.value = await collectorApi.listUsers()
  } catch (error) {
    taskControlFeedback.value = toApiErrorMessage(error, '加载用户列表失败')
  } finally {
    usersLoading.value = false
  }
}

function toggleSelectAll(value: boolean) {
  if (taskControlSelectionLocked.value) {
    return
  }
  selectedUsernames.value = value
    ? selectableUsers.value.map((user) => user.username)
    : []
}

async function stopAllTasks() {
  if (!selectedUsernames.value.length) {
    taskControlFeedback.value = '请至少选择一个用户。'
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `该操作会停止所选 ${selectedUsernames.value.length} 个用户正在执行和等待执行的任务，并锁定本次选择，直到恢复完成。请输入“停止所选任务”确认。`,
      '停止所选用户任务',
      {
        confirmButtonText: '确认停止',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: '停止所选任务',
        inputValidator: (value) => value === '停止所选任务' || '请输入“停止所选任务”',
      },
    )
    if (result.value !== '停止所选任务') {
      return
    }
  } catch {
    return
  }
  taskControlAction.value = 'stop'
  taskControlFeedback.value = '正在停止所选用户的任务并确认静默状态。'
  try {
    const control = await api.stopAllTasks(selectedUsernames.value)
    if (!control.deploySafe) {
      taskControlFeedback.value = control.lastResult.errors?.[0]
        || '任务停止不完整，仍未达到部署静默状态，请重新执行停止检查。'
    } else {
      taskControlFeedback.value = `所选用户已进入部署静默状态，本次记录了 ${control.resumableCount} 个可恢复项目。`
    }
  } catch (error) {
    taskControlFeedback.value = toApiErrorMessage(error, '停止所选用户任务失败')
  } finally {
    taskControlAction.value = ''
    await loadTaskControl()
  }
}

async function resumeAllTasks() {
  try {
    await ElMessageBox.confirm(
      `确认恢复本次维护停止的 ${taskControlStatus.value?.resumableCount || 0} 项任务？系统只会恢复本次停止快照中的任务和计划，不会恢复历史取消或失败任务。`,
      '恢复本次停止任务',
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
  taskControlFeedback.value = '正在恢复本次停止快照中的任务和计划。'
  try {
    const control = await api.resumeAllTasks()
    const errors = control.lastResult.errors || []
    if (errors.length > 0) {
      taskControlFeedback.value = `恢复已完成，另有 ${errors.length} 项因状态变化或业务条件不满足未恢复。`
    } else {
      taskControlFeedback.value = '本次停止的用户任务和计划已全部恢复，可以重新选择用户。'
    }
    if (!control.selectionLocked) {
      selectedUsernames.value = []
    }
  } catch (error) {
    taskControlFeedback.value = toApiErrorMessage(error, '恢复本次停止任务失败')
  } finally {
    taskControlAction.value = ''
    await loadTaskControl()
  }
}

function toPickerValue(value?: string | null) {
  return value ? value.slice(0, 16) : null
}

</script>

<template>
  <section class="maintenance-management page-stack">
    <header class="page-head">
      <div>
        <p class="eyebrow">System Operations</p>
        <h1>系统维护管理</h1>
      </div>
    </header>

    <div v-loading="loading && !loaded" class="maintenance-layout">
      <section class="settings-panel">
        <div class="panel-heading settings-heading">
          <div class="panel-heading-icon"><el-icon><Setting /></el-icon></div>
          <div>
            <h2>维护设置</h2>
          </div>
          <div class="settings-heading-actions">
            <el-tag :type="status.type" effect="light" size="large">
              <el-icon><component :is="status.icon" /></el-icon>
              {{ status.label }}
            </el-tag>
            <el-button :icon="RefreshRight" :loading="loading" @click="loadSettings">刷新</el-button>
          </div>
        </div>

        <el-form label-position="top" class="maintenance-form">
          <el-form-item>
            <div class="switch-row">
              <div>
                <strong>开启维护管理</strong>
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
          </div>
        </div>
        <div class="task-control-actions">
          <el-tag :type="taskControlTagType" effect="light" size="large">
            {{ taskControlStateLabel }}
          </el-tag>
          <el-button :icon="RefreshRight" :loading="taskControlLoading" @click="loadTaskControl">
            刷新状态
          </el-button>
        </div>
      </div>

      <div class="user-selection">
        <div class="selection-head">
          <div>
            <strong>选择用户</strong>
            <span v-if="taskControlSelectionLocked">本次选择已锁定，恢复完成后才能重新选择。</span>
            <span v-else>停止和恢复只作用于所选用户。</span>
          </div>
          <el-checkbox
            :model-value="allUsersSelected"
            :disabled="taskControlSelectionLocked || usersLoading || !selectableUsers.length"
            @change="toggleSelectAll(Boolean($event))"
          >
            全选
          </el-checkbox>
        </div>
        <el-select
          v-model="selectedUsernames"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="4"
          :loading="usersLoading"
          :disabled="taskControlSelectionLocked"
          placeholder="请选择需要停止任务的用户"
        >
          <el-option
            v-for="user in selectableUsers"
            :key="user.username"
            :label="`${user.displayName || user.username}（${user.username}）${user.enabled ? '' : ' - 已停用'}`"
            :value="user.username"
          />
        </el-select>
      </div>

      <el-alert
        :type="taskControlAlertType"
        :closable="false"
        show-icon
        :title="taskControlAlertTitle"
      >
        <template v-if="taskControlPaused && taskControlQueue" #default>
          队列剩余：等待 {{ taskControlQueue.queued }}、延迟 {{ taskControlQueue.deferred }}、计划 {{ taskControlQueue.scheduled }}、执行中 {{ taskControlQueue.started }}。
        </template>
      </el-alert>

      <div class="danger-actions">
        <el-button
          v-if="!taskControlDeploySafe"
          type="danger"
          :icon="VideoPause"
          :loading="taskControlAction === 'stop'"
          :disabled="taskControlTransitioning || (!taskControlPaused && !selectedUsernames.length)"
          @click="stopAllTasks"
        >
          {{ taskControlPaused ? '重新停止并检查' : '停止所选用户任务' }}
        </el-button>
        <el-button
          v-else
          type="primary"
          :icon="VideoPlay"
          :loading="taskControlAction === 'resume'"
          :disabled="taskControlTransitioning"
          @click="resumeAllTasks"
        >
          恢复本次停止任务
        </el-button>
      </div>
    </section>

    <AnnouncementManagementPanel />
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

.settings-heading-actions :deep(.el-tag) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.maintenance-layout {
  display: block;
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

.settings-heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.task-control-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-selection {
  display: grid;
  gap: 12px;
}

.user-selection :deep(.el-select) {
  width: 100%;
}

.selection-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.selection-head > div {
  display: grid;
  gap: 4px;
}

.selection-head strong {
  color: var(--text-main);
  font-size: 14px;
}

.selection-head span {
  color: var(--text-soft);
  font-size: 12px;
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

.switch-row strong {
  display: block;
}

.switch-row strong {
  color: var(--text-main);
  font-size: 14px;
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

@media (max-width: 640px) {
  .page-head,
  .switch-row,
  .task-control-head {
    align-items: stretch;
    flex-direction: column;
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

  .settings-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .settings-heading-actions {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
  }

  .selection-head {
    align-items: flex-start;
  }
}
</style>
