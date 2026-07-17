<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Check, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  SalesAnalysisCapability,
  SalesAnalysisConstraintSection,
  SalesAnalysisSettingsPayload,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const DEFAULT_SETTINGS: SalesAnalysisSettingsPayload = {
  defaultPeriodDays: 30,
  defaultRankingLimit: 10,
  defaultMetric: 'effectiveUnits',
  defaultGrain: 'day',
  answerDetailLevel: 'standard',
  prioritizeAdjustmentRisk: true,
  showDataUpdatedAt: true,
  showMetricDefinition: true,
  customBusinessInstructions: '',
}

const api = useCollectorApi()
const activeTab = shallowRef('personal')
const loading = shallowRef(false)
const saving = shallowRef(false)
const capabilities = ref<SalesAnalysisCapability[]>([])
const constraints = ref<SalesAnalysisConstraintSection[]>([])
const draft = reactive<SalesAnalysisSettingsPayload>({ ...DEFAULT_SETTINGS })
const savedSnapshot = ref<SalesAnalysisSettingsPayload | null>(null)
const isDirty = computed(() =>
  savedSnapshot.value !== null
  && JSON.stringify(draft) !== JSON.stringify(savedSnapshot.value),
)

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  void loadSettingsWorkspace()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(async () => {
  if (!isDirty.value) {
    return true
  }
  return confirmDiscardChanges()
})

async function loadSettingsWorkspace() {
  loading.value = true
  try {
    const [settings, capabilityValues, constraintValues] = await Promise.all([
      api.getSalesAnalysisSettings(),
      api.listSalesAnalysisCapabilities(),
      api.listSalesAnalysisConstraints(),
    ])
    const snapshot = toPayload(settings)
    Object.assign(draft, snapshot)
    savedSnapshot.value = snapshot
    capabilities.value = capabilityValues
    constraints.value = constraintValues
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品分析设置失败'))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const settings = await api.updateSalesAnalysisSettings({ ...draft })
    const snapshot = toPayload(settings)
    Object.assign(draft, snapshot)
    savedSnapshot.value = snapshot
    ElMessage.success('商品分析设置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存商品分析设置失败'))
  } finally {
    saving.value = false
  }
}

function restoreDefaults() {
  Object.assign(draft, DEFAULT_SETTINGS)
}

function toPayload(settings: SalesAnalysisSettingsPayload): SalesAnalysisSettingsPayload {
  return {
    defaultPeriodDays: settings.defaultPeriodDays,
    defaultRankingLimit: settings.defaultRankingLimit,
    defaultMetric: settings.defaultMetric,
    defaultGrain: settings.defaultGrain,
    answerDetailLevel: settings.answerDetailLevel,
    prioritizeAdjustmentRisk: settings.prioritizeAdjustmentRisk,
    showDataUpdatedAt: settings.showDataUpdatedAt,
    showMetricDefinition: settings.showMetricDefinition,
    customBusinessInstructions: settings.customBusinessInstructions,
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!isDirty.value) {
    return
  }
  event.preventDefault()
  event.returnValue = ''
}

async function confirmDiscardChanges() {
  try {
    await ElMessageBox.confirm(
      '当前个人偏好尚未保存，离开后修改将丢失。',
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
}
</script>

<template>
  <section class="settings-page" v-loading="loading">
    <header class="page-head">
      <div>
        <p class="eyebrow">AI Management</p>
        <h1>商品分析设置</h1>
        <p class="page-summary">查看分析能力与安全边界，并配置当前账号的默认分析偏好。</p>
      </div>
      <div class="head-actions">
        <el-tag v-if="isDirty" type="warning" effect="plain">有未保存修改</el-tag>
        <el-button :icon="RefreshLeft" :disabled="loading || saving" @click="restoreDefaults">
          恢复默认
        </el-button>
        <el-button type="primary" :icon="Check" :loading="saving" :disabled="loading || !isDirty" @click="saveSettings">
          保存设置
        </el-button>
      </div>
    </header>

    <section class="settings-workspace">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <el-tab-pane label="能力说明" name="capability">
          <div v-if="capabilities.length" class="catalog-grid">
            <article v-for="item in capabilities" :key="item.key" class="catalog-item">
              <h2>{{ item.title }}</h2>
              <p>{{ item.description }}</p>
            </article>
          </div>
          <el-empty v-else description="暂无能力说明" />
        </el-tab-pane>

        <el-tab-pane label="个人偏好" name="personal">
          <el-form class="preference-form" label-position="top">
            <div class="form-grid">
              <el-form-item label="默认统计周期">
                <el-segmented
                  v-model="draft.defaultPeriodDays"
                  :options="[
                    { label: '7 天', value: 7 },
                    { label: '30 天', value: 30 },
                    { label: '60 天', value: 60 },
                    { label: '90 天', value: 90 },
                  ]"
                />
              </el-form-item>
              <el-form-item label="默认排行数量">
                <el-input-number v-model="draft.defaultRankingLimit" :min="5" :max="100" :step="5" />
              </el-form-item>
              <el-form-item label="默认分析指标">
                <el-select v-model="draft.defaultMetric" class="full-control">
                  <el-option label="有效销量" value="effectiveUnits" />
                  <el-option label="已下单商品数量" value="orderedUnits" />
                  <el-option label="预估有效销售额" value="effectiveSalesAmount" />
                  <el-option label="订单数量" value="orderCount" />
                </el-select>
              </el-form-item>
              <el-form-item label="默认趋势粒度">
                <el-segmented
                  v-model="draft.defaultGrain"
                  :options="[
                    { label: '按天', value: 'day' },
                    { label: '按周', value: 'week' },
                    { label: '按月', value: 'month' },
                  ]"
                />
              </el-form-item>
              <el-form-item label="回答详细程度">
                <el-segmented
                  v-model="draft.answerDetailLevel"
                  :options="[
                    { label: '简洁', value: 'concise' },
                    { label: '标准', value: 'standard' },
                    { label: '详细', value: 'detailed' },
                  ]"
                />
              </el-form-item>
            </div>

            <div class="switch-list">
              <label class="switch-row">
                <span><strong>优先提示售后调整风险</strong><small>分析时优先关注取消、退款和退货对结果的影响。</small></span>
                <el-switch v-model="draft.prioritizeAdjustmentRisk" />
              </label>
              <label class="switch-row">
                <span><strong>显示数据更新时间</strong><small>在回答中标注分析数据的最近更新时间。</small></span>
                <el-switch v-model="draft.showDataUpdatedAt" />
              </label>
              <label class="switch-row">
                <span><strong>显示指标定义</strong><small>在需要时说明有效销量等业务指标的计算口径。</small></span>
                <el-switch v-model="draft.showMetricDefinition" />
              </label>
            </div>

            <el-form-item label="自定义业务要求">
              <el-input
                v-model="draft.customBusinessInstructions"
                type="textarea"
                :rows="7"
                maxlength="4000"
                show-word-limit
                placeholder="填写希望商品分析长期遵循的业务侧表达偏好，不可覆盖系统安全约束。"
              />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="安全约束" name="security">
          <div v-if="constraints.length" class="constraint-list">
            <section v-for="section in constraints" :key="section.key" class="constraint-section">
              <h2>{{ section.title }}</h2>
              <ul>
                <li v-for="item in section.items" :key="item">{{ item }}</li>
              </ul>
            </section>
          </div>
          <el-empty v-else description="暂无安全约束说明" />
        </el-tab-pane>
      </el-tabs>
    </section>
  </section>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
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

.page-summary {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 14px;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.settings-workspace {
  min-height: 520px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 0 20px 22px;
}

.settings-tabs :deep(.el-tabs__header) {
  margin-bottom: 22px;
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.catalog-item,
.constraint-section {
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
  padding: 16px;
}

.catalog-item h2,
.constraint-section h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
}

.catalog-item p {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.preference-form {
  max-width: 920px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 28px;
}

.full-control {
  width: 100%;
}

.switch-list {
  display: grid;
  margin: 4px 0 22px;
  border-block: 1px solid var(--panel-border);
}

.switch-row {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 2px;
}

.switch-row + .switch-row {
  border-top: 1px solid var(--panel-border);
}

.switch-row span {
  display: grid;
  gap: 4px;
}

.switch-row strong {
  color: var(--text-main);
  font-size: 14px;
}

.switch-row small {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.constraint-list {
  display: grid;
  gap: 12px;
}

.constraint-section ul {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding-left: 20px;
}

.constraint-section li {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .page-head {
    align-items: stretch;
    flex-direction: column;
  }

  .head-actions {
    flex-wrap: wrap;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .settings-workspace {
    padding-inline: 14px;
  }
}
</style>
