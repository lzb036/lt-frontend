<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  Aim,
  AlarmClock,
  Document,
  Expand,
  Finished,
  Fold,
  House,
  OfficeBuilding,
  Refresh,
  Sell,
  Setting,
  Shop,
  ShoppingBag,
  ShoppingCartFull,
  Tickets,
  UserFilled,
  Warning,
} from '@element-plus/icons-vue'

import type { AuthSession } from '../../types/crawler'
import { hasAnyPermission, hasPermission, isSuperadmin as isSuperadminSession } from '../../utils/permissions'

type MenuEntry = {
  path: string
  label: string
  icon: unknown
}

type MenuGroup = {
  key: string
  label: string
  icon: unknown
  children: MenuEntry[]
}

const props = defineProps<{
  session: AuthSession | null
}>()

const emit = defineEmits<{
  logout: []
}>()

const route = useRoute()
const router = useRouter()

const isSuperadmin = computed(() => isSuperadminSession(props.session))
const activePath = computed(() => {
  const path = route.path || '/dashboard'
  return path === '/' ? '/dashboard' : path
})
const sidebarCollapsed = ref(false)

const menuGroups = computed(() => {
  const groups: Array<MenuEntry | MenuGroup> = [
    {
      path: '/dashboard',
      label: '仪表盘',
      icon: House,
    },
  ]
  const jobChildren: MenuEntry[] = []
  if (hasPermission(props.session, 'crawler.manage')) {
    jobChildren.push(
      { path: '/ltJobs/wjJobs', label: '手动采集', icon: Aim },
      { path: '/ltJobs/wjProductJob', label: '定时采集', icon: AlarmClock },
    )
  }
  if (hasPermission(props.session, 'products.manage')) {
    jobChildren.push({ path: '/ltJobs/upGoodsJob', label: '上架任务', icon: ShoppingCartFull })
  }
  if (hasAnyPermission(props.session, ['products.manage', 'stores.manage'])) {
    jobChildren.push({ path: '/ltJobs/syncJob', label: '同步任务', icon: Refresh })
  }
  if (jobChildren.length > 0) {
    groups.push({
      key: 'jobs',
      label: '任务管理',
      icon: Tickets,
      children: jobChildren,
    })
  }
  if (hasPermission(props.session, 'products.manage')) {
    groups.push({
      key: 'rakuten-shop',
      label: '商品管理',
      icon: ShoppingBag,
      children: [
        { path: '/ltShop/wjMerchantGoods', label: '待审核商品', icon: Document },
        { path: '/ltShop/wjMerchantGoodsTrue', label: '已审核商品', icon: Finished },
        { path: '/ltShop/wjMerchantGoodsError', label: '异常商品', icon: Warning },
      ],
    })
  }
  if (hasPermission(props.session, 'stores.manage')) {
    groups.push({
      key: 'stores',
      label: '店铺管理',
      icon: OfficeBuilding,
      children: [
        { path: '/ltHj/wjMerchant', label: '店铺信息', icon: Shop },
        { path: '/ltShop/GoodsUp', label: '店铺商品', icon: Sell },
      ],
    })
  }
  if (isSuperadmin.value) {
    groups.push({
      path: '/system/user',
      label: '用户管理',
      icon: UserFilled,
    })
  }
  if (hasPermission(props.session, 'settings.manage')) {
    groups.push({
      key: 'settings',
      label: '系统设置',
      icon: Setting,
      children: [
        { path: '/system/theme', label: '主题管理', icon: Setting },
      ],
    })
  }
  return groups
})

const sidebarCollapseIcon = computed(() => (sidebarCollapsed.value ? Expand : Fold))

async function handleMenuSelect(path: string) {
  if (path !== activePath.value) {
    await router.push(path)
  }
}

function toggleSidebarCollapsed() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function forwardLogout() {
  emit('logout')
}

function menuItemKey(item: MenuEntry | MenuGroup) {
  return 'path' in item ? item.path : item.key
}
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'app-shell-sidebar-collapsed': sidebarCollapsed }"
  >
    <aside
      class="shell-sidebar"
      :class="{ 'shell-sidebar-collapsed': sidebarCollapsed }"
    >
      <div class="shell-brand">
        <span class="brand-mark">
          <img src="/favicon.svg" alt="" />
        </span>
        <span class="brand-copy">
          <strong>商品采集系统</strong>
          <em>Product Collector</em>
        </span>
      </div>

      <el-menu
        class="shell-menu"
        :collapse="sidebarCollapsed"
        :collapse-transition="false"
        :default-active="activePath"
        @select="handleMenuSelect"
      >
        <template v-for="item in menuGroups" :key="menuItemKey(item)">
          <el-menu-item
            v-if="'path' in item"
            :index="item.path"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
          <el-sub-menu v-else :index="item.key">
            <template #title>
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.path"
              :index="child.path"
            >
              <el-icon>
                <component :is="child.icon" />
              </el-icon>
              <span>{{ child.label }}</span>
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>

      <footer class="shell-sidebar-footer">
        <button
          type="button"
          class="sidebar-collapse-button"
          :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleSidebarCollapsed"
        >
          <el-icon class="sidebar-collapse-icon">
            <component :is="sidebarCollapseIcon" />
          </el-icon>
          <span class="sidebar-collapse-label">{{ sidebarCollapsed ? '展开' : '收起' }}</span>
        </button>
      </footer>
    </aside>

    <div class="shell-main">
      <main class="shell-content">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :session="session"
            @logout="forwardLogout"
          />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  height: 100vh;
  min-height: 0;
  grid-template-columns: 196px minmax(0, 1fr);
  background: linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-strong) 100%);
  overflow: hidden;
  transition: grid-template-columns 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.app-shell-sidebar-collapsed {
  grid-template-columns: 72px minmax(0, 1fr);
}

.shell-sidebar {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--panel-border);
  background: var(--sidebar-bg);
  overflow: hidden;
  transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 72px;
  padding: 0 14px;
  border-bottom: 1px solid var(--panel-border);
  overflow: hidden;
  transition: justify-content 220ms ease, padding 220ms ease;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  flex: 0 0 auto;
}

.brand-mark img {
  display: block;
  width: 28px;
  height: 28px;
}

.brand-copy {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 1;
  max-width: 112px;
  transform: translateX(0);
  transition: opacity 180ms ease, max-width 220ms ease, transform 220ms ease;
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

.shell-sidebar-collapsed .shell-brand {
  justify-content: center;
  padding: 0 10px;
}

.shell-sidebar-collapsed .brand-copy {
  opacity: 0;
  max-width: 0;
  transform: translateX(-6px);
}

.shell-menu {
  flex: 1;
  min-height: 0;
  border-right: 0;
  background: transparent;
  padding: 12px 8px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.shell-menu::-webkit-scrollbar {
  width: 6px;
}

.shell-menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--sidebar-text), transparent 72%);
}

.shell-menu::-webkit-scrollbar-track {
  background: transparent;
}

.shell-sidebar-collapsed .shell-menu {
  width: auto;
  padding: 12px 8px;
}

.shell-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 2px 0;
  border-radius: 6px;
  color: var(--sidebar-text);
  font-weight: 700;
}

.shell-menu :deep(.el-menu-item .el-icon),
.shell-menu :deep(.el-sub-menu__title .el-icon) {
  flex: 0 0 auto;
}

.shell-menu :deep(.el-sub-menu__title) {
  height: 42px;
  margin: 2px 0;
  border-radius: 6px;
  color: var(--sidebar-text);
  font-weight: 800;
}

.shell-menu :deep(.el-sub-menu__title:hover),
.shell-menu :deep(.el-menu-item:hover) {
  background: var(--panel-muted);
  color: var(--text-main);
}

.shell-menu :deep(.el-sub-menu .el-menu-item) {
  height: 38px;
  padding-left: 38px !important;
  font-size: 13px;
}

.shell-menu :deep(.el-menu-item.is-active) {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
}

.shell-sidebar-collapsed .shell-menu :deep(.el-menu-item),
.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu__title) {
  justify-content: center;
  padding: 0 !important;
}

.shell-sidebar-collapsed .shell-menu :deep(.el-menu-item span),
.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu__title span),
.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu__icon-arrow) {
  display: none;
}

.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu .el-menu-item) {
  padding: 0 !important;
}

.shell-sidebar-footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--panel-border);
  padding: 12px 8px 14px;
}

.sidebar-collapse-button {
  display: inline-flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  justify-content: flex-start;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text);
  cursor: pointer;
  font: inherit;
  padding: 0 10px;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}

.sidebar-collapse-button:hover,
.sidebar-collapse-button:focus-visible {
  border-color: var(--panel-border);
  background: var(--panel-muted);
  color: var(--text-main);
  outline: none;
}

.sidebar-collapse-icon {
  flex: 0 0 auto;
  font-size: 18px;
}

.sidebar-collapse-label {
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  font-weight: 800;
  max-width: 80px;
  opacity: 1;
  text-overflow: ellipsis;
  transform: translateX(0);
  transition: opacity 180ms ease, max-width 220ms ease, transform 220ms ease;
  white-space: nowrap;
}

.shell-sidebar-collapsed .shell-sidebar-footer {
  padding: 12px 8px 14px;
}

.shell-sidebar-collapsed .sidebar-collapse-button {
  justify-content: center;
  padding-inline: 0;
}

.shell-sidebar-collapsed .sidebar-collapse-label {
  opacity: 0;
  max-width: 0;
  transform: translateX(-6px);
}

.shell-main {
  display: flex;
  height: 100vh;
  min-height: 0;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
}

.shell-content {
  flex: 1;
  min-height: 0;
  padding: 22px 24px 34px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .app-shell-sidebar-collapsed {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .shell-sidebar {
    height: 100%;
  }

  .shell-brand {
    justify-content: center;
    padding: 0 10px;
  }

  .shell-brand span:last-child {
    display: none;
  }

  .shell-menu {
    padding: 10px 8px;
  }

  .shell-menu :deep(.el-menu-item) {
    justify-content: center;
    padding: 0 !important;
  }

  .shell-menu :deep(.el-sub-menu__title) {
    justify-content: center;
    padding: 0 !important;
  }

  .shell-menu :deep(.el-sub-menu__icon-arrow),
  .shell-menu :deep(.el-menu-item span),
  .shell-menu :deep(.el-sub-menu__title span) {
    display: none;
  }

  .shell-menu :deep(.el-sub-menu .el-menu-item) {
    padding: 0 !important;
  }

  .shell-sidebar-footer {
    padding: 12px 8px 14px;
  }

  .sidebar-collapse-button {
    justify-content: center;
    padding-inline: 0;
  }

  .sidebar-collapse-label {
    display: none;
  }

  .shell-content {
    padding: 16px;
  }
}
</style>
