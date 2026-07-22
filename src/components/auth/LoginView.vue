<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Key, Lock, Refresh, User } from '@element-plus/icons-vue'
import LoginBrandVisual from './LoginBrandVisual.vue'

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
      <LoginBrandVisual />

      <section class="login-panel" aria-labelledby="login-title">
        <div class="login-panel-top">
          <span class="secure-status">
            <span></span>
            SECURE ACCESS
          </span>
          <span class="system-version">RAKUTEN · COLLECTOR</span>
        </div>

        <div class="login-header">
          <span class="login-icon">
            <img src="/favicon.svg" alt="" />
          </span>
          <p class="login-eyebrow">欢迎回来</p>
          <h2 id="login-title" class="login-title">登录乐天商品采集系统</h2>
          <p class="login-subtitle">使用工作账号进入乐天商品采集后台</p>
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
              show-password
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
            进入工作台
          </el-button>
        </form>

        <div class="login-panel-footer">
          <span>RAKUTEN PRODUCT COLLECTOR</span>
          <span>乐天商品采集系统</span>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  height: 100%;
  min-height: 100vh;
  color: var(--text-main);
  background: var(--panel-bg);
  overflow-y: auto;
}

.login-layout {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 1.35fr) minmax(420px, 0.85fr);
}

.login-panel {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--panel-border), transparent 72%) 1px, transparent 1px),
    var(--panel-bg);
  background-size: 42px 42px;
  padding: clamp(38px, 6vw, 86px);
}

.login-panel::before {
  position: absolute;
  top: 0;
  right: 0;
  width: 3px;
  height: 32%;
  background: #ff8f55;
  content: '';
}

.login-panel-top,
.login-panel-footer {
  position: absolute;
  right: clamp(32px, 5vw, 72px);
  left: clamp(32px, 5vw, 72px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.4px;
}

.login-panel-top {
  top: 30px;
}

.secure-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.secure-status span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1cb184;
  box-shadow: 0 0 0 4px rgba(28, 177, 132, 0.1);
}

.login-panel-footer {
  bottom: 28px;
  border-top: 1px solid var(--panel-border);
  padding-top: 16px;
  letter-spacing: 0.8px;
}

.login-panel-footer span:last-child {
  letter-spacing: 0;
}

.login-header,
.login-form {
  width: min(410px, 100%);
  margin-right: auto;
  margin-left: auto;
}

.login-header {
  margin-bottom: 28px;
}

.login-icon {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  margin-bottom: 20px;
  border: 1px solid color-mix(in srgb, #0f766e, transparent 62%);
  border-radius: 8px;
  background: color-mix(in srgb, #0f766e, var(--panel-bg) 90%);
  box-shadow: inset 0 -12px 24px rgba(15, 118, 110, 0.05);
}

.login-icon img {
  display: block;
  width: 38px;
  height: 38px;
}

.login-eyebrow {
  margin: 0 0 10px;
  color: #0f8d78;
  font-size: 12px;
  font-weight: 800;
}

.login-title {
  margin: 0;
  color: var(--text-main);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.2;
}

.login-subtitle {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.login-form {
  display: grid;
  gap: 18px;
}

.form-field {
  display: grid;
  gap: 6px;
}

.field-label {
  color: var(--text-main);
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
    linear-gradient(135deg, color-mix(in srgb, #0f766e, white 91%), var(--panel-bg)),
    repeating-linear-gradient(-15deg, transparent 0, transparent 6px, rgba(15, 118, 110, 0.08) 6px, rgba(15, 118, 110, 0.08) 8px);
  color: #0d7465;
  cursor: pointer;
  font: inherit;
  font-size: 20px;
  font-weight: 900;
}

.captcha-code:hover {
  border-color: color-mix(in srgb, #0f766e, transparent 48%);
  color: #0f766e;
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
  height: 50px;
  border: 0;
  border-radius: var(--radius-sm);
  background: linear-gradient(105deg, #0a7567, #129581 58%, #0d7769) !important;
  color: var(--on-accent) !important;
  font-size: 15px;
  font-weight: 800;
  box-shadow: 0 12px 26px rgba(15, 118, 110, 0.2);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.login-submit:hover:not(.is-disabled) {
  box-shadow: 0 15px 30px rgba(15, 118, 110, 0.28);
  transform: translateY(-1px);
}

.login-form :deep(.el-input__wrapper) {
  min-height: 46px;
  background: color-mix(in srgb, var(--panel-muted), var(--panel-bg) 28%) !important;
  transition: box-shadow 180ms ease, background 180ms ease;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  background: var(--panel-bg) !important;
  box-shadow: 0 0 0 1px #0f8d78 inset, 0 0 0 3px rgba(15, 141, 120, 0.08) !important;
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

  .login-panel {
    min-height: 640px;
    padding: 70px 40px 84px;
  }
}

@media (max-width: 560px) {
  .login-panel {
    min-height: 610px;
    padding: 66px 20px 78px;
  }

  .captcha-row {
    grid-template-columns: 1fr;
  }

  .captcha-code {
    width: 100%;
  }

  .system-version,
  .login-panel-footer span:first-child {
    display: none;
  }

  .login-title {
    font-size: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-submit {
    transition: none;
  }
}
</style>
