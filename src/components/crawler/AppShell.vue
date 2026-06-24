<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Connection, DataBoard, Goods, Key, List, Search, SwitchButton, User } from '@element-plus/icons-vue'

import type { AuthSession } from '../../types/crawler'

const props = defineProps<{
  session: AuthSession | null
}>()

const emit = defineEmits<{
  logout: []
}>()

const route = useRoute()
const router = useRouter()

const isSuperadmin = computed(() => props.session?.role === 'superadmin')
const activePath = computed(() => {
  const path = route.path || '/dashboard'
  return path === '/' ? '/dashboard' : path
})
const displayName = computed(() => props.session?.displayName || props.session?.username || '未登录')

const menuItems = computed(() => {
  const baseItems = [
    { path: '/dashboard', label: '概览', icon: DataBoard },
    { path: '/secrets', label: '我的密钥配置', icon: Key },
    { path: '/sources', label: '采集源', icon: Connection },
    { path: '/tasks', label: '采集任务', icon: List },
    { path: '/products', label: '商品结果', icon: Goods },
  ]
  if (isSuperadmin.value) {
    return [
      ...baseItems,
      { path: '/users', label: '用户管理', icon: User },
    ]
  }
  return baseItems
})

async function handleMenuSelect(path: string) {
  if (path !== activePath.value) {
    await router.push(path)
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="shell-sidebar">
      <div class="shell-brand">
        <span class="brand-mark">
          <el-icon><Search /></el-icon>
        </span>
        <span>
          <strong>商品采集系统</strong>
          <em>Product Collector</em>
        </span>
      </div>

      <el-menu
        class="shell-menu"
        :default-active="activePath"
        @select="handleMenuSelect"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
        </el-menu-item>
      </el-menu>
    </aside>

    <div class="shell-main">
      <header class="shell-header">
        <div class="header-copy">
          <strong>{{ route.meta.title || '采集工作台' }}</strong>
          <span>用户隔离配置与商品采集任务管理</span>
        </div>
        <div class="header-user">
          <span class="role-tag">{{ isSuperadmin ? '超级管理员' : '运营用户' }}</span>
          <span class="user-name">{{ displayName }}</span>
          <el-button
            :icon="SwitchButton"
            plain
            @click="emit('logout')"
          >
            退出
          </el-button>
        </div>
      </header>

      <main class="shell-content">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :session="session"
          />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 238px minmax(0, 1fr);
  background: linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-strong) 100%);
}

.shell-sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100vh;
  flex-direction: column;
  border-right: 1px solid var(--panel-border);
  background: var(--sidebar-bg);
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 72px;
  padding: 0 18px;
  border-bottom: 1px solid var(--panel-border);
}

.brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}

.shell-brand strong {
  display: block;
  color: var(--text-main);
  font-size: 16px;
  line-height: 1.2;
}

.shell-brand em {
  display: block;
  color: var(--text-faint);
  font-size: 12px;
  font-style: normal;
}

.shell-menu {
  flex: 1;
  border-right: 0;
  background: transparent;
  padding: 12px 10px;
}

.shell-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 2px 0;
  border-radius: 6px;
  color: var(--sidebar-text);
  font-weight: 700;
}

.shell-menu :deep(.el-menu-item.is-active) {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
}

.shell-main {
  min-width: 0;
}

.shell-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--header-bg);
  padding: 0 24px;
  backdrop-filter: blur(12px);
}

.header-copy {
  display: grid;
  gap: 3px;
}

.header-copy strong {
  color: var(--text-main);
  font-size: 18px;
}

.header-copy span {
  color: var(--text-soft);
  font-size: 13px;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-tag {
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 800;
}

.user-name {
  color: var(--text-main);
  font-weight: 800;
}

.shell-content {
  padding: 22px 24px 34px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .shell-sidebar {
    position: static;
    height: auto;
  }

  .shell-menu {
    display: flex;
    overflow-x: auto;
    padding: 8px;
  }

  .shell-menu :deep(.el-menu-item) {
    flex: 0 0 auto;
  }

  .shell-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px 16px;
  }

  .shell-content {
    padding: 16px;
  }
}
</style>
