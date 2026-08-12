<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Clock, RefreshRight, Setting, WarningFilled } from '@element-plus/icons-vue'

import { useMaintenance } from '../../composables/useMaintenance'
import type { AuthSession, MaintenanceSettingsPayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import MaintenancePreview from '../maintenance/MaintenancePreview.vue'

defineProps<{
  session: AuthSession | null
}>()

const api = useMaintenance()
const loading = shallowRef(false)
const saving = shallowRef(false)
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

onMounted(() => {
  void loadSettings()
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
}

@media (max-width: 640px) {
  .page-head,
  .switch-row {
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
}
</style>
