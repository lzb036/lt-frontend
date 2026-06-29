<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RouterView, useRouter } from 'vue-router'

import LoginView from './components/auth/LoginView.vue'
import { useAuth } from './composables/useAuth'
import { canAccessRouteMeta } from './utils/permissions'

const {
  authenticated,
  checkingSession,
  loggingIn,
  authError,
  session,
  fetchSession,
  login,
  logout,
} = useAuth()

const router = useRouter()

onMounted(async () => {
  try {
    await fetchSession()
    guardCurrentRoute()
  } catch {
  }
})

watch(session, () => {
  guardCurrentRoute()
})

watch(() => router.currentRoute.value.fullPath, () => {
  guardCurrentRoute()
})

async function handleLogin(payload: { username: string; password: string }) {
  try {
    await login(payload)
    await router.replace('/dashboard')
    ElMessage.success('登录成功')
  } catch {
    ElMessage.error(authError.value || '登录失败')
  }
}

function guardCurrentRoute() {
  if (!session.value) {
    return
  }
  const blocked = router.currentRoute.value.matched.some((record) => !canAccessRouteMeta(session.value, record.meta))
  if (!blocked) {
    return
  }
  void router.replace('/dashboard')
  ElMessage.warning('当前账号没有访问该页面的权限')
}

async function handleLogout() {
  await logout()
  await router.replace('/dashboard')
  ElMessage.success('已退出登录')
}
</script>

<template>
  <main v-if="checkingSession" class="app-boot">
    <section class="app-boot-panel">
      <span>正在检查登录状态...</span>
    </section>
  </main>
  <RouterView
    v-else-if="authenticated"
    v-slot="{ Component }"
  >
    <component
      :is="Component"
      :session="session"
      @logout="handleLogout"
    />
  </RouterView>
  <LoginView
    v-else
    :loading="loggingIn"
    :error-message="authError"
    @submit="handleLogin"
  />
</template>

<style scoped>
.app-boot {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--page-bg);
  padding: 24px;
}

.app-boot-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  padding: 18px 22px;
  color: var(--text-soft);
  box-shadow: var(--shadow-sm);
}
</style>
