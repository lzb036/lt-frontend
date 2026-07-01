<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, Connection, Goods, Key, Lock, Refresh, User } from '@element-plus/icons-vue'

const props = defineProps<{
  loading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  submit: [payload: { username: string; password: string }]
}>()

const REMEMBERED_LOGIN_KEY = 'lt_collector_remembered_login'

const form = reactive({
  username: '',
  password: '',
  captcha: '',
  rememberUsername: false,
})
const localError = shallowRef('')
const captchaQuestion = shallowRef('')
const captchaAnswer = shallowRef('')

const displayError = computed(() => localError.value || props.errorMessage)
const canSubmit = computed(() => (
  form.username.trim().length > 0
  && form.password.length > 0
  && form.captcha.trim().length > 0
  && !props.loading
))

onMounted(() => {
  restoreRememberedLogin()
  refreshCaptcha()
})

watch(
  () => [form.username, form.password, form.captcha],
  () => {
    localError.value = ''
  },
)

watch(
  () => form.rememberUsername,
  (rememberUsername) => {
    if (!rememberUsername) {
      window.localStorage.removeItem(REMEMBERED_LOGIN_KEY)
    }
  },
)

function refreshCaptcha() {
  const first = randomNumber(2, 9)
  const second = randomNumber(1, 8)
  const useMinus = Math.random() > 0.5
  if (useMinus) {
    const max = Math.max(first, second)
    const min = Math.min(first, second)
    captchaQuestion.value = `${max}-${min}=?`
    captchaAnswer.value = String(max - min)
  } else {
    captchaQuestion.value = `${first}+${second}=?`
    captchaAnswer.value = String(first + second)
  }
  form.captcha = ''
}

function randomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function validateLoginForm() {
  if (!form.username.trim()) {
    return '请输入用户名'
  }
  if (!form.password) {
    return '请输入密码'
  }
  if (!form.captcha.trim()) {
    return '请输入验证码'
  }
  if (form.captcha.trim() !== captchaAnswer.value) {
    return '验证码不正确'
  }
  return ''
}

function handleSubmit() {
  const validationMessage = validateLoginForm()
  if (validationMessage) {
    localError.value = validationMessage
    ElMessage.warning(validationMessage)
    if (validationMessage === '验证码不正确') {
      refreshCaptcha()
    }
    return
  }
  if (!canSubmit.value) {
    return
  }
  syncRememberedLogin()
  emit('submit', {
    username: form.username.trim(),
    password: form.password,
  })
}

function syncRememberedLogin() {
  if (!form.rememberUsername) {
    window.localStorage.removeItem(REMEMBERED_LOGIN_KEY)
    return
  }
  window.localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({
    username: form.username.trim(),
  }))
}

function restoreRememberedLogin() {
  const raw = window.localStorage.getItem(REMEMBERED_LOGIN_KEY)
  if (!raw) {
    return
  }
  try {
    const value = JSON.parse(raw) as { username?: unknown; password?: unknown }
    form.username = typeof value.username === 'string' ? value.username : ''
    form.password = ''
    form.rememberUsername = Boolean(form.username)
    if ('password' in value) {
      syncRememberedLogin()
    }
  } catch {
    window.localStorage.removeItem(REMEMBERED_LOGIN_KEY)
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-layout">
      <aside class="login-visual" aria-label="系统概览">
        <div class="brand-row">
          <span class="brand-mark">
            <img src="/favicon.svg" alt="" />
          </span>
          <span class="brand-copy">
            <strong>商品采集系统</strong>
            <span>Rakuten Product Collector</span>
          </span>
        </div>

        <div class="visual-copy">
          <p class="visual-eyebrow">按用户隔离的采集工作台</p>
          <h1>店铺、商品结果按账号独立管理</h1>
          <p>超级管理员只建账号，具体店铺与乐天 API 密钥由用户自行维护。</p>
        </div>

        <div class="feature-grid">
          <div class="feature-item">
            <el-icon><Key /></el-icon>
            <span>店铺密钥</span>
          </div>
          <div class="feature-item">
            <el-icon><Connection /></el-icon>
            <span>店铺配置</span>
          </div>
          <div class="feature-item">
            <el-icon><Goods /></el-icon>
            <span>商品结果</span>
          </div>
          <div class="feature-item">
            <el-icon><Box /></el-icon>
            <span>任务留痕</span>
          </div>
        </div>
      </aside>

      <section class="login-card" aria-labelledby="login-title">
        <div class="login-header">
          <span class="login-icon">
            <img src="/favicon.svg" alt="" />
          </span>
          <p class="login-eyebrow">运营后台登录</p>
          <h2 id="login-title" class="login-title">商品采集系统</h2>
          <p class="login-subtitle">请输入账号信息进入采集后台</p>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit">
          <label class="form-field">
            <span class="field-label">用户名</span>
            <el-input
              v-model="form.username"
              size="large"
              :prefix-icon="User"
              autocomplete="username"
              placeholder="请输入用户名"
              aria-label="用户名"
            />
          </label>

          <label class="form-field">
            <span class="field-label">密码</span>
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              :prefix-icon="Lock"
              autocomplete="current-password"
              placeholder="请输入密码"
              aria-label="密码"
              @keydown.enter="handleSubmit"
            />
          </label>

          <div class="captcha-row">
            <label class="form-field">
              <span class="field-label">验证码</span>
              <el-input
                v-model="form.captcha"
                size="large"
                :prefix-icon="Key"
                autocomplete="off"
                inputmode="numeric"
                placeholder="请输入验证码"
                aria-label="验证码"
                @keydown.enter="handleSubmit"
              />
            </label>
            <button
              class="captcha-code"
              type="button"
              aria-label="刷新验证码"
              @click="refreshCaptcha"
            >
              <span>{{ captchaQuestion }}</span>
              <el-icon><Refresh /></el-icon>
            </button>
          </div>

          <div class="form-options">
            <el-checkbox v-model="form.rememberUsername" class="remember-check">
              记住用户名
            </el-checkbox>
          </div>

          <el-alert
            v-if="displayError"
            class="login-alert"
            type="error"
            :closable="false"
            show-icon
            :title="displayError"
          />

          <el-button
            class="login-submit"
            size="large"
            type="primary"
            :icon="Lock"
            :loading="loading"
            :disabled="loading"
            @click="handleSubmit"
          >
            登录系统
          </el-button>
        </form>
      </section>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  isolation: isolate;
  display: grid;
  min-height: 100vh;
  place-items: center;
  color: var(--text-main);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent), transparent 94%), transparent 34%),
    linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-strong) 100%);
  padding: 22px;
}

.login-page::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--panel-border), transparent 64%) 1px, transparent 1px),
    linear-gradient(0deg, color-mix(in srgb, var(--panel-border), transparent 64%) 1px, transparent 1px);
  background-size: 34px 34px;
  content: '';
  opacity: 0.44;
}

.login-layout {
  display: grid;
  width: min(1120px, 100%);
  min-height: min(720px, calc(100vh - 44px));
  grid-template-columns: minmax(420px, 1.05fr) minmax(390px, 0.95fr);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.login-visual {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 42px 50px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-active), #111827 72%),
      color-mix(in srgb, var(--accent), #173d59 66%) 58%,
      color-mix(in srgb, var(--accent), #0f766e 48%)
    ),
    linear-gradient(45deg, rgba(255, 255, 255, 0.08), transparent);
  color: #ffffff;
  overflow: hidden;
}

.login-visual::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 42px 42px;
  content: '';
  opacity: 0.18;
}

.brand-row,
.visual-copy,
.feature-grid {
  position: relative;
  z-index: 1;
}

.brand-row {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
}

.brand-mark img {
  display: block;
  width: 34px;
  height: 34px;
}

.brand-copy {
  display: grid;
  gap: 2px;
}

.brand-copy strong {
  font-size: 18px;
  line-height: 1.1;
}

.brand-copy span {
  color: rgba(255, 255, 255, 0.66);
  font-size: 12px;
  text-transform: uppercase;
}

.visual-copy {
  max-width: 520px;
}

.visual-eyebrow {
  margin: 0 0 16px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 13px;
  font-weight: 700;
}

.visual-copy h1 {
  margin: 0;
  font-size: clamp(31px, 3.7vw, 46px);
  font-weight: 800;
  line-height: 1.1;
}

.visual-copy p:last-child {
  max-width: 460px;
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 15px;
  line-height: 1.8;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.feature-item {
  display: grid;
  min-height: 78px;
  align-content: center;
  gap: 9px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  padding: 14px;
}

.feature-item .el-icon {
  color: color-mix(in srgb, var(--accent-border), #ffffff 32%);
  font-size: 22px;
}

.feature-item span {
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  font-weight: 700;
}

.login-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 46px 56px;
  background: var(--panel-bg);
}

.login-header,
.login-form {
  width: min(392px, 100%);
  margin-right: auto;
  margin-left: auto;
}

.login-header {
  margin-bottom: 24px;
}

.login-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  margin-bottom: 14px;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}

.login-icon img {
  display: block;
  width: 36px;
  height: 36px;
}

.login-eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 800;
}

.login-title {
  margin: 0;
  color: var(--text-main);
  font-size: 29px;
  font-weight: 800;
  line-height: 1.2;
}

.login-subtitle {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 14px;
}

.login-form {
  display: grid;
  gap: 16px;
}

.form-field {
  display: grid;
  gap: 6px;
}

.field-label {
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 700;
}

.captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px;
  align-items: end;
  gap: 12px;
}

.captcha-code {
  display: inline-flex;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent), white 78%), var(--panel-bg)),
    repeating-linear-gradient(-15deg, transparent 0, transparent 6px, color-mix(in srgb, var(--accent), transparent 88%) 6px, color-mix(in srgb, var(--accent), transparent 88%) 8px);
  color: var(--accent-active);
  cursor: pointer;
  font: inherit;
  font-size: 20px;
  font-weight: 900;
}

.captcha-code:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.form-options {
  min-height: 24px;
}

.remember-check :deep(.el-checkbox__label) {
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 700;
}

.login-alert {
  border: 1px solid color-mix(in srgb, var(--danger), transparent 68%);
  background: var(--danger-soft);
}

.login-submit {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--accent) !important;
  color: var(--on-accent) !important;
  font-size: 16px;
  font-weight: 800;
}

.login-form :deep(.el-input__wrapper) {
  min-height: 46px;
  background: var(--panel-muted) !important;
}

.login-form :deep(.el-input__inner) {
  color: var(--text-main) !important;
  font-size: 15px;
  font-weight: 600;
}

@media (max-width: 920px) {
  .login-layout {
    grid-template-columns: 1fr;
  }

  .login-visual {
    padding: 24px 28px;
  }

  .visual-copy p:last-child,
  .feature-grid {
    display: none;
  }

  .visual-copy {
    margin-top: 22px;
  }
}

@media (max-width: 560px) {
  .login-page {
    padding: 10px;
  }

  .login-card {
    padding: 22px 18px;
  }

  .login-visual {
    padding: 18px;
  }

  .visual-copy h1 {
    font-size: 22px;
  }

  .captcha-row {
    grid-template-columns: 1fr;
  }

  .captcha-code {
    width: 100%;
  }
}
</style>
