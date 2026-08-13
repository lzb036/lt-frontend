<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RouterView, useRouter } from 'vue-router'

import LoginView from './components/auth/LoginView.vue'
import MaintenanceNoticeView from './components/maintenance/MaintenanceNoticeView.vue'
import { useAuth } from './composables/useAuth'
import { useMaintenance } from './composables/useMaintenance'
import { canAccessRouteMeta, getDefaultRoutePath } from './utils/permissions'

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
const {
  maintenance,
  checkingMaintenance,
  fetchMaintenanceStatus,
} = useMaintenance()

const router = useRouter()
const initialBoot = shallowRef(true)
let maintenanceRefreshTimer: number | undefined
const canBypassMaintenance = computed(() => (
  session.value?.role === 'superadmin'
  || session.value?.username === 'test'
))
const showMaintenance = computed(() => (
  authenticated.value
  && Boolean(maintenance.value?.active)
  && !canBypassMaintenance.value
))
const booting = computed(() => (
  initialBoot.value
  || checkingSession.value
  || (authenticated.value && checkingMaintenance.value && !maintenance.value)
))

onMounted(async () => {
  try {
    await fetchSession()
    if (session.value) {
      await refreshMaintenance()
      guardCurrentRoute()
    }
  } catch {
  } finally {
    initialBoot.value = false
    syncMaintenancePolling()
  }
})

onBeforeUnmount(() => {
  if (maintenanceRefreshTimer !== undefined) {
    window.clearInterval(maintenanceRefreshTimer)
  }
})

watch(session, (nextSession) => {
  syncMaintenancePolling()
  if (nextSession) {
    guardCurrentRoute()
  }
})

watch(() => router.currentRoute.value.fullPath, () => {
  guardCurrentRoute()
})

async function handleLogin(payload: { username: string; password: string }) {
  try {
    const nextSession = await login(payload)
    await refreshMaintenance()
    if (
      maintenance.value?.active
      && nextSession.role !== 'superadmin'
      && nextSession.username !== 'test'
    ) {
      return
    }
    await router.replace(getDefaultRoutePath(nextSession))
    ElMessage.success('登录成功')
  } catch {
    ElMessage.error(authError.value || '登录失败')
  }
}

function guardCurrentRoute() {
  if (!session.value) {
    return
  }
  const defaultRoute = getDefaultRoutePath(session.value)
  if (router.currentRoute.value.path === '/') {
    void router.replace(defaultRoute)
    return
  }
  const blocked = router.currentRoute.value.matched.some((record) => !canAccessRouteMeta(session.value, record.meta))
  if (!blocked) {
    return
  }
  void router.replace(defaultRoute)
  ElMessage.warning('当前账号没有访问该页面的权限')
}

async function handleLogout() {
  await logout()
  await router.replace(getDefaultRoutePath(null))
  ElMessage.success('已退出登录')
}

async function refreshMaintenance(silent = false) {
  try {
    await fetchMaintenanceStatus()
  } catch {
    if (!silent) {
      ElMessage.error('维护状态刷新失败，请稍后重试')
    }
  }
}

function syncMaintenancePolling() {
  if (maintenanceRefreshTimer !== undefined) {
    window.clearInterval(maintenanceRefreshTimer)
    maintenanceRefreshTimer = undefined
  }
  if (!session.value) {
    return
  }
  maintenanceRefreshTimer = window.setInterval(() => {
    void refreshMaintenance(true)
  }, 30_000)
}
</script>

<template>
  <main v-if="booting" class="app-boot">
    <section class="app-boot-panel">
      <span>正在检查登录状态...</span>
    </section>
  </main>
  <MaintenanceNoticeView
    v-else-if="showMaintenance && maintenance"
    :maintenance="maintenance"
    @logout="handleLogout"
  />
  <RouterView
    v-else-if="authenticated"
    v-slot="{ Component }"
  >
    <component
      :is="Component"
      :session="session"
      :maintenance-active="Boolean(maintenance?.active)"
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
