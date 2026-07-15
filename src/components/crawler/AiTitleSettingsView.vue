<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { Connection, Key, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AiProviderOption, AiTitleSettingsPayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const testing = shallowRef(false)
const keyConfigured = shallowRef(false)
const keyMasked = shallowRef('')
const providers = shallowRef<AiProviderOption[]>([])
const verified = shallowRef(false)
const form = reactive<AiTitleSettingsPayload>({
  provider: 'custom_openai',
  apiBaseUrl: '',
  apiKey: '',
  modelName: '',
  titlePrompt: '',
  subtitlePrompt: '',
})
const selectedProvider = computed(() => providers.value.find((item) => item.value === form.provider) || null)
const modelOptions = computed(() => selectedProvider.value?.models || [])

onMounted(() => void loadSettings())

async function loadSettings() {
  loading.value = true
  try {
    const [providerValues, settings] = await Promise.all([
      api.getAiTitleProviders(),
      api.getAiTitleSettings(),
    ])
    providers.value = providerValues
    Object.assign(form, settings, { apiKey: '' })
    keyConfigured.value = settings.apiKeyConfigured
    keyMasked.value = settings.apiKeyMasked
    verified.value = settings.verified
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载标题优化配置失败'))
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const settings = await api.updateAiTitleSettings({ ...form })
    keyConfigured.value = settings.apiKeyConfigured
    keyMasked.value = settings.apiKeyMasked
    verified.value = settings.verified
    form.apiKey = ''
    ElMessage.success('标题优化配置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存标题优化配置失败'))
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  try {
    const result = await api.testAiTitleSettings()
    verified.value = true
    ElMessage.success(result.message)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '测试连接失败'))
  } finally {
    testing.value = false
  }
}

function handleProviderChange(providerValue: string) {
  const provider = providers.value.find((item) => item.value === providerValue)
  form.apiBaseUrl = provider?.apiBaseUrl || ''
  form.modelName = provider?.models[0] || ''
  verified.value = false
}
</script>

<template>
  <section class="page-stack" v-loading="loading">
    <div class="page-head">
      <div>
        <p class="eyebrow">AI Management</p>
        <h1>标题优化</h1>
      </div>
      <div class="head-actions">
        <el-tag :type="verified ? 'success' : 'warning'">{{ verified ? '已验证' : '未验证' }}</el-tag>
        <el-button :icon="Connection" :loading="testing" @click="testConnection">测试连接</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="saving" @click="saveSettings">保存</el-button>
      </div>
    </div>

    <section class="work-panel">
      <el-form label-position="top">
        <el-form-item label="运营商">
          <el-select v-model="form.provider" class="full-control" filterable @change="handleProviderChange">
            <el-option v-for="provider in providers" :key="provider.value" :label="provider.label" :value="provider.value" />
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
            <el-option v-for="model in modelOptions" :key="model" :label="model" :value="model" />
          </el-select>
        </el-form-item>
        <el-form-item label="OpenAI 兼容地址">
          <el-input v-model="form.apiBaseUrl" placeholder="https://.../compatible-mode/v1" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            :prefix-icon="Key"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="keyConfigured ? `已配置 ${keyMasked}，留空则不修改` : '请输入 API Key'"
          />
        </el-form-item>
        <el-form-item label="商品标题提示词">
          <el-input v-model="form.titlePrompt" type="textarea" :rows="8" maxlength="10000" show-word-limit />
        </el-form-item>
        <el-form-item label="商品副标题提示词">
          <el-input v-model="form.subtitlePrompt" type="textarea" :rows="8" maxlength="10000" show-word-limit />
        </el-form-item>
      </el-form>
    </section>
  </section>
</template>

<style scoped>
.page-stack { display: grid; gap: 18px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.eyebrow { margin: 0 0 6px; color: var(--accent); font-size: 12px; font-weight: 800; }
.page-head h1 { margin: 0; color: var(--text-main); font-size: 26px; font-weight: 800; }
.head-actions { display: flex; gap: 10px; }
.work-panel { border: 1px solid var(--panel-border); border-radius: 8px; background: var(--panel-bg); box-shadow: var(--shadow-sm); padding: 18px; }
.full-control { width: 100%; }
@media (max-width: 760px) {
  .page-head { align-items: stretch; flex-direction: column; }
  .head-actions { justify-content: flex-end; }
}
</style>
