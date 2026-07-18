<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Check, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import {
  createSalesOrderSyncSettingsDraftState,
  loadSalesOrderSyncSettingsDraftState,
  saveSalesOrderSyncSettingsDraftState,
} from '../../composables/salesAnalysisSettingsState'
import type { SalesOrderSyncGlobalSettingsPayload } from '../../types/crawler'

const DEFAULT_SETTINGS: SalesOrderSyncGlobalSettingsPayload = {
  enabled: true,
  intervalMinutes: 30,
  successRetentionDays: 30,
}

const api = useCollectorApi()
const state = reactive(createSalesOrderSyncSettingsDraftState(DEFAULT_SETTINGS))
const draft = state.draft
const isDirty = computed(() => state.isDirty())

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  void loadSettings()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(async () => {
  if (!isDirty.value) return true
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

async function loadSettings() {
  const loaded = await loadSalesOrderSyncSettingsDraftState(
    state,
    api.getSalesOrderSyncGlobalSettings(),
  )
  if (!loaded) {
    ElMessage.error(state.error || '加载订单同步设置失败')
  }
}

async function saveSettings() {
  const saved = await saveSalesOrderSyncSettingsDraftState(
    state,
    api.updateSalesOrderSyncGlobalSettings,
  )
  if (saved) {
    ElMessage.success('订单同步设置已保存')
  } else {
    ElMessage.error(state.error || '保存订单同步设置失败')
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
</script>

<template>
  <section class="settings-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Resource Management</p>
        <h1>订单同步设置</h1>
      </div>
      <div class="head-actions">
        <el-tag v-if="isDirty" type="warning" effect="plain">有未保存修改</el-tag>
        <el-button
          :icon="RefreshLeft"
          :disabled="state.loading || state.saving || !state.savedSnapshot"
          @click="state.restoreDefaults()"
        >
          恢复默认
        </el-button>
        <el-button
          type="primary"
          :icon="Check"
          :loading="state.saving"
          :disabled="state.loading || !isDirty"
          @click="saveSettings"
        >
          保存设置
        </el-button>
      </div>
    </header>

    <section class="work-panel">
      <el-result
        v-if="state.error && !state.savedSnapshot"
        icon="error"
        title="订单同步设置加载失败"
        :sub-title="state.error"
      >
        <template #extra>
          <el-button type="primary" :icon="RefreshLeft" @click="loadSettings">
            重试
          </el-button>
        </template>
      </el-result>
      <el-form
        v-else
        v-loading="state.loading"
        class="settings-form"
        label-position="top"
      >
        <label class="switch-row">
          <span>
            <strong>启用自动同步</strong>
            <small>关闭后停止自动获取订单，手动立即更新仍可使用。</small>
          </span>
          <el-switch v-model="draft.enabled" />
        </label>
        <div class="form-grid">
          <el-form-item label="自动同步间隔">
            <el-input-number
              v-model="draft.intervalMinutes"
              :min="5"
              :max="1440"
              :step="5"
            />
            <span class="field-suffix">分钟</span>
          </el-form-item>
          <el-form-item label="成功记录保留天数">
            <el-input-number
              v-model="draft.successRetentionDays"
              :min="1"
              :max="365"
            />
            <span class="field-suffix">天</span>
          </el-form-item>
        </div>
      </el-form>
    </section>
  </section>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 18px;
}

.settings-form {
  max-width: 760px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border-soft);
}

.switch-row span {
  display: grid;
  gap: 5px;
}

.switch-row small {
  color: var(--text-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding-top: 20px;
}

.field-suffix {
  margin-left: 8px;
  color: var(--text-muted);
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
