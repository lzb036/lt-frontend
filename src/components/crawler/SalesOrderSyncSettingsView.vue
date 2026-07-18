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
  <section class="page-stack">
    <section v-loading="state.loading" class="time-panel">
      <div class="time-panel-head">
        <div>
          <h2>订单自动同步</h2>
          <p>定时获取店铺订单，并维护近365天订单和商品销量数据</p>
        </div>
        <div class="head-actions">
          <el-tag v-if="isDirty" type="warning" effect="plain">
            有未保存修改
          </el-tag>
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
            保存
          </el-button>
        </div>
      </div>

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
        class="settings-form"
        label-position="top"
      >
        <div class="setting-grid">
          <section class="setting-card setting-card-primary">
            <div class="setting-card-copy">
              <span>自动同步</span>
              <strong>{{ draft.enabled ? '已启用' : '已停用' }}</strong>
              <small>关闭后停止自动获取订单，手动立即更新仍可使用。</small>
            </div>
            <el-switch v-model="draft.enabled" />
          </section>

          <section class="setting-card">
            <div class="setting-card-copy">
              <span>同步间隔</span>
              <strong>{{ draft.intervalMinutes }} 分钟</strong>
              <small>系统按照该间隔检查并获取各店铺新增或变更订单。</small>
            </div>
            <el-input-number
              v-model="draft.intervalMinutes"
              class="setting-control"
              :min="5"
              :max="1440"
              :step="5"
            />
          </section>

          <section class="setting-card">
            <div class="setting-card-copy">
              <span>成功记录保留</span>
              <strong>{{ draft.successRetentionDays }} 天</strong>
              <small>只清理订单获取任务记录，不会删除订单和销量数据。</small>
            </div>
            <el-input-number
              v-model="draft.successRetentionDays"
              class="setting-control"
              :min="1"
              :max="365"
            />
          </section>
        </div>
      </el-form>
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
  align-items: center;
  gap: 8px;
}

.settings-form {
  width: 100%;
}

.setting-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--panel-border);
}

.setting-card {
  display: flex;
  min-height: 138px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 16px;
  border-right: 1px solid var(--panel-border);
}

.setting-card:last-child {
  border-right: 0;
}

.setting-card-copy {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
}

.setting-card-copy span,
.setting-card-copy small {
  color: var(--text-muted);
  font-size: 12px;
}

.setting-card-copy strong {
  color: var(--text-main);
  font-size: 20px;
  font-weight: 800;
}

.setting-card-primary .setting-card-copy strong {
  color: var(--accent);
}

.setting-card-copy small {
  line-height: 1.55;
}

.setting-control {
  flex: 0 0 118px;
  width: 118px;
}

@media (max-width: 960px) {
  .setting-grid {
    grid-template-columns: 1fr;
  }

  .setting-card {
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
  }

  .setting-card:last-child {
    border-bottom: 0;
  }

  .time-panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
