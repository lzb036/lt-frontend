<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue'
import { Check, Connection, Key } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AiProviderOption,
  SalesAnalysisModelSettingsPayload,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const emit = defineEmits<{
  dirtyChange: [dirty: boolean]
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const testing = shallowRef(false)
const keyConfigured = shallowRef(false)
const keyMasked = shallowRef('')
const verified = shallowRef(false)
const verifiedAt = shallowRef<string | null>(null)
const lastError = shallowRef<string | null>(null)
const providers = shallowRef<AiProviderOption[]>([])
const savedSnapshot = shallowRef('')
const form = reactive<SalesAnalysisModelSettingsPayload>({
  provider: 'custom_openai',
  apiBaseUrl: '',
  apiKey: '',
  modelName: '',
})

const selectedProvider = computed(() => (
  providers.value.find((item) => item.value === form.provider) || null
))
const modelOptions = computed(() => selectedProvider.value?.models || [])
const currentSnapshot = computed(() => JSON.stringify(form))
const isDirty = computed(() => (
  Boolean(savedSnapshot.value)
  && currentSnapshot.value !== savedSnapshot.value
))

watch(isDirty, (dirty) => emit('dirtyChange', dirty), { immediate: true })
onMounted(() => void loadSettings())

async function loadSettings() {
  loading.value = true
  try {
    const [providerValues, settings] = await Promise.all([
      api.getSalesAnalysisModelProviders(),
      api.getSalesAnalysisModelSettings(),
    ])
    providers.value = providerValues
    Object.assign(form, {
      provider: settings.provider,
      apiBaseUrl: settings.apiBaseUrl,
      apiKey: '',
      modelName: settings.modelName,
    })
    keyConfigured.value = settings.apiKeyConfigured
    keyMasked.value = settings.apiKeyMasked
    verified.value = settings.verified
    verifiedAt.value = settings.verifiedAt || null
    lastError.value = settings.lastError || null
    savedSnapshot.value = currentSnapshot.value
  } catch (error) {
    ElMessage.error(
      toApiErrorMessage(error, '加载商品分析模型配置失败'),
    )
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const settings = await api.updateSalesAnalysisModelSettings({
      ...form,
    })
    Object.assign(form, {
      provider: settings.provider,
      apiBaseUrl: settings.apiBaseUrl,
      apiKey: '',
      modelName: settings.modelName,
    })
    keyConfigured.value = settings.apiKeyConfigured
    keyMasked.value = settings.apiKeyMasked
    verified.value = settings.verified
    verifiedAt.value = settings.verifiedAt || null
    lastError.value = settings.lastError || null
    savedSnapshot.value = currentSnapshot.value
    ElMessage.success('商品分析模型配置已保存')
  } catch (error) {
    ElMessage.error(
      toApiErrorMessage(error, '保存商品分析模型配置失败'),
    )
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  if (isDirty.value) {
    ElMessage.warning('请先保存模型配置，再测试连接')
    return
  }
  testing.value = true
  try {
    const result = await api.testSalesAnalysisModelSettings()
    verified.value = true
    verifiedAt.value = new Date().toISOString()
    lastError.value = null
    ElMessage.success(result.message)
  } catch (error) {
    verified.value = false
    ElMessage.error(
      toApiErrorMessage(error, '测试商品分析模型连接失败'),
    )
  } finally {
    testing.value = false
  }
}

function handleProviderChange(providerValue: string) {
  const provider = providers.value.find(
    (item) => item.value === providerValue,
  )
  form.apiBaseUrl = provider?.apiBaseUrl || ''
  form.modelName = provider?.models[0] || ''
}
</script>

<template>
  <section v-loading="loading" class="model-settings-panel">
    <header class="panel-head">
      <div class="verification-state">
        <el-tag :type="verified ? 'success' : 'warning'">
          {{ verified ? '已验证' : '未验证' }}
        </el-tag>
        <span v-if="verifiedAt" class="verification-time">
          最近验证：{{ verifiedAt }}
        </span>
      </div>
      <div class="panel-actions">
        <el-button
          :icon="Connection"
          :loading="testing"
          :disabled="loading || saving || isDirty"
          @click="testConnection"
        >
          测试连接
        </el-button>
        <el-button
          type="primary"
          :icon="Check"
          :loading="saving"
          :disabled="loading || !isDirty"
          @click="saveSettings"
        >
          保存配置
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="lastError"
      type="error"
      :closable="false"
      :title="lastError"
      show-icon
    />

    <el-form class="model-form" label-position="top">
      <el-form-item label="运营商">
        <el-select
          v-model="form.provider"
          class="full-control"
          filterable
          @change="handleProviderChange"
        >
          <el-option
            v-for="provider in providers"
            :key="provider.value"
            :label="provider.label"
            :value="provider.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="模型名称">
        <el-select
          v-model="form.modelName"
          class="full-control"
          allow-create
          default-first-option
          filterable
          placeholder="选择推荐模型或输入 LiteLLM 模型路由"
        >
          <el-option
            v-for="model in modelOptions"
            :key="model"
            :label="model"
            :value="model"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="OpenAI 兼容地址">
        <el-input
          v-model="form.apiBaseUrl"
          placeholder="https://.../compatible-mode/v1"
        />
      </el-form-item>
      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          :prefix-icon="Key"
          type="password"
          show-password
          autocomplete="new-password"
          :placeholder="
            keyConfigured
              ? `已配置 ${keyMasked}，留空则不修改`
              : '请输入 API Key'
          "
        />
      </el-form-item>
    </el-form>
  </section>
</template>

<style scoped>
.model-settings-panel {
  display: grid;
  gap: 18px;
}

.panel-head,
.panel-actions,
.verification-state {
  display: flex;
  align-items: center;
}

.panel-head {
  justify-content: space-between;
  gap: 16px;
}

.panel-actions,
.verification-state {
  gap: 10px;
}

.verification-time {
  color: var(--text-muted);
  font-size: 13px;
}

.model-form {
  max-width: 760px;
}

.full-control {
  width: 100%;
}

@media (max-width: 760px) {
  .panel-head {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-actions {
    justify-content: flex-end;
  }
}
</style>
