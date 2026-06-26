<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, Key, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AuthSession, SecretProfile, SecretProfilePayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const verifying = shallowRef(false)
const profile = shallowRef<SecretProfile | null>(null)

const form = reactive({
  rakutenShopUrl: '',
  rakutenShopName: '',
  rakutenServiceSecret: '',
  rakutenLicenseKey: '',
  alibabaAppKey: '',
  alibabaAppSecret: '',
  alibabaAccessToken: '',
  logisticsBaseUrl: '',
  logisticsUsername: '',
  logisticsPassword: '',
  proxyUrl: '',
  ossAccessKeyId: '',
  ossAccessKeySecret: '',
  ossBucket: '',
  ossEndpoint: '',
  autoCrawlEnabled: false,
  autoCrawlIntervalMinutes: 60,
})

const masked = computed(() => profile.value?.masked)
const hasAnySecret = computed(() => Boolean(
  masked.value?.rakutenServiceSecret
  || masked.value?.rakutenLicenseKey
  || masked.value?.alibabaAppKey
  || masked.value?.ossAccessKeyId
  || masked.value?.proxyUrl,
))

onMounted(() => {
  void loadProfile()
})

async function loadProfile() {
  loading.value = true
  try {
    const value = await api.getSecretProfile()
    profile.value = value
    fillForm(value)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载密钥配置失败'))
  } finally {
    loading.value = false
  }
}

function fillForm(value: SecretProfile) {
  form.rakutenShopUrl = value.rakutenShopUrl || ''
  form.rakutenShopName = value.rakutenShopName || ''
  form.rakutenServiceSecret = ''
  form.rakutenLicenseKey = ''
  form.alibabaAppKey = ''
  form.alibabaAppSecret = ''
  form.alibabaAccessToken = ''
  form.logisticsBaseUrl = value.logisticsBaseUrl || ''
  form.logisticsUsername = ''
  form.logisticsPassword = ''
  form.proxyUrl = ''
  form.ossAccessKeyId = ''
  form.ossAccessKeySecret = ''
  form.ossBucket = value.ossBucket || ''
  form.ossEndpoint = value.ossEndpoint || ''
  form.autoCrawlEnabled = value.autoCrawlEnabled
  form.autoCrawlIntervalMinutes = value.autoCrawlIntervalMinutes || 60
}

function buildPayload(): SecretProfilePayload {
  const payload: SecretProfilePayload = {
    rakutenShopUrl: form.rakutenShopUrl.trim(),
    rakutenShopName: form.rakutenShopName.trim(),
    logisticsBaseUrl: form.logisticsBaseUrl.trim(),
    ossBucket: form.ossBucket.trim(),
    ossEndpoint: form.ossEndpoint.trim(),
    autoCrawlEnabled: form.autoCrawlEnabled,
    autoCrawlIntervalMinutes: form.autoCrawlIntervalMinutes,
  }
  const secretValues: Array<[keyof SecretProfilePayload, string]> = [
    ['rakutenServiceSecret', form.rakutenServiceSecret],
    ['rakutenLicenseKey', form.rakutenLicenseKey],
    ['alibabaAppKey', form.alibabaAppKey],
    ['alibabaAppSecret', form.alibabaAppSecret],
    ['alibabaAccessToken', form.alibabaAccessToken],
    ['logisticsUsername', form.logisticsUsername],
    ['logisticsPassword', form.logisticsPassword],
    ['proxyUrl', form.proxyUrl],
    ['ossAccessKeyId', form.ossAccessKeyId],
    ['ossAccessKeySecret', form.ossAccessKeySecret],
  ]
  for (const [key, value] of secretValues) {
    if (value.trim()) {
      payload[key] = value.trim() as never
    }
  }
  return payload
}

async function saveProfile() {
  saving.value = true
  try {
    const value = await api.updateSecretProfile(buildPayload())
    profile.value = value
    fillForm(value)
    ElMessage.success('密钥配置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存密钥配置失败'))
  } finally {
    saving.value = false
  }
}

async function verifyProfile() {
  verifying.value = true
  try {
    const value = await api.verifySecretProfile()
    profile.value = value
    ElMessage.success('配置校验已记录')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '配置校验失败'))
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">User Secrets</p>
        <h1>我的密钥配置</h1>
      </div>
      <div class="head-actions">
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="loadProfile"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          :icon="CircleCheck"
          :loading="saving"
          @click="saveProfile"
        >
          保存配置
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="这些配置只属于当前登录用户。超级管理员只负责创建账号，不需要代替用户填写业务密钥。"
    />

    <section class="work-panel" v-loading="loading">
      <div class="panel-head">
        <div>
          <h2>业务密钥与采集基础配置</h2>
          <p>已保存的密钥仅显示掩码；空白密钥输入框表示本次不修改原密钥。</p>
        </div>
        <el-tag :type="hasAnySecret ? 'success' : 'warning'">
          {{ hasAnySecret ? '已有密钥' : '未配置密钥' }}
        </el-tag>
      </div>

      <el-form class="profile-form" label-position="top">
        <el-divider content-position="left">Rakuten 店铺/API</el-divider>
        <div class="form-grid">
          <el-form-item label="Rakuten 店铺地址">
            <el-input v-model="form.rakutenShopUrl" placeholder="https://www.rakuten.co.jp/..." />
          </el-form-item>
          <el-form-item label="店铺名称">
            <el-input v-model="form.rakutenShopName" placeholder="用于内部识别" />
          </el-form-item>
          <el-form-item label="Service Secret">
            <el-input v-model="form.rakutenServiceSecret" type="password" show-password :placeholder="masked?.rakutenServiceSecret || '未保存'" />
          </el-form-item>
          <el-form-item label="License Key">
            <el-input v-model="form.rakutenLicenseKey" type="password" show-password :placeholder="masked?.rakutenLicenseKey || '未保存'" />
          </el-form-item>
        </div>

        <el-divider content-position="left">1688 与物流</el-divider>
        <div class="form-grid">
          <el-form-item label="1688 App Key">
            <el-input v-model="form.alibabaAppKey" type="password" show-password :placeholder="masked?.alibabaAppKey || '未保存'" />
          </el-form-item>
          <el-form-item label="1688 App Secret">
            <el-input v-model="form.alibabaAppSecret" type="password" show-password :placeholder="masked?.alibabaAppSecret || '未保存'" />
          </el-form-item>
          <el-form-item label="1688 Access Token">
            <el-input v-model="form.alibabaAccessToken" type="password" show-password :placeholder="masked?.alibabaAccessToken || '未保存'" />
          </el-form-item>
          <el-form-item label="国际物流 Base URL">
            <el-input v-model="form.logisticsBaseUrl" placeholder="https://..." />
          </el-form-item>
          <el-form-item label="国际物流账号">
            <el-input v-model="form.logisticsUsername" type="password" show-password :placeholder="masked?.logisticsUsername || '未保存'" />
          </el-form-item>
          <el-form-item label="国际物流密码">
            <el-input v-model="form.logisticsPassword" type="password" show-password :placeholder="masked?.logisticsPassword || '未保存'" />
          </el-form-item>
        </div>

        <el-divider content-position="left">代理与 OSS</el-divider>
        <div class="form-grid">
          <el-form-item label="代理地址">
            <el-input v-model="form.proxyUrl" type="password" show-password :placeholder="masked?.proxyUrl || '可选，用于采集代理'" />
          </el-form-item>
          <el-form-item label="OSS AccessKey ID">
            <el-input v-model="form.ossAccessKeyId" type="password" show-password :placeholder="masked?.ossAccessKeyId || '未保存'" />
          </el-form-item>
          <el-form-item label="OSS AccessKey Secret">
            <el-input v-model="form.ossAccessKeySecret" type="password" show-password :placeholder="masked?.ossAccessKeySecret || '未保存'" />
          </el-form-item>
          <el-form-item label="OSS Bucket">
            <el-input v-model="form.ossBucket" placeholder="bucket 名称" />
          </el-form-item>
          <el-form-item label="OSS Endpoint">
            <el-input v-model="form.ossEndpoint" placeholder="oss-cn-xxx.aliyuncs.com" />
          </el-form-item>
        </div>

        <el-divider content-position="left">自动采集偏好</el-divider>
        <div class="schedule-row">
          <el-switch v-model="form.autoCrawlEnabled" active-text="开启自动采集" inactive-text="关闭自动采集" />
          <el-input-number v-model="form.autoCrawlIntervalMinutes" :min="5" :max="1440" :step="5" />
          <span>分钟执行一次</span>
        </div>
      </el-form>

      <div class="panel-actions">
        <el-button :icon="Key" :loading="verifying" @click="verifyProfile">
          校验并记录
        </el-button>
        <span v-if="profile?.lastVerifiedAt" class="muted-text">
          最近校验：{{ profile.lastVerifiedAt }}
        </span>
      </div>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.panel-head,
.head-actions,
.panel-actions,
.schedule-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-head,
.panel-head {
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1,
.panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.panel-head h2 {
  font-size: 17px;
}

.panel-head p {
  margin: 5px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.profile-form {
  margin-top: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 16px;
}

.schedule-row {
  flex-wrap: wrap;
  color: var(--text-soft);
  font-weight: 700;
}

.panel-actions {
  flex-wrap: wrap;
  margin-top: 18px;
}

.muted-text {
  color: var(--text-faint);
  font-size: 13px;
}

@media (max-width: 760px) {
  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
