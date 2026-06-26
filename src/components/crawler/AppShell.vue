<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
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
  Postcard,
  Sell,
  Setting,
  Shop,
  ShoppingBag,
  ShoppingCartFull,
  SwitchButton,
  Tickets,
  Tools,
  UserFilled,
  Warning,
} from '@element-plus/icons-vue'

import { useTheme } from '../../composables/useTheme'
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
const themeDrawerOpen = ref(false)
const sidebarCollapsed = ref(false)
const systemNow = ref(new Date())
const {
  themeSettings,
  themeModeSegmentOptions,
  themePresetOptions,
  themeFontOptions,
  themeRadiusOptions,
  themeDensityOptions,
  themeSurfaceOptions,
  updateThemeSetting,
  resetThemeSettings,
} = useTheme()

const menuGroups = computed(() => {
  const groups = [
    {
      path: '/dashboard',
      label: '仪表盘',
      icon: House,
    },
    {
      key: 'jobs',
      label: '任务管理',
      icon: Tickets,
      children: [
        { path: '/ltJobs/wjJobs', label: '手动采集', icon: Aim },
        { path: '/ltJobs/upGoodsJob', label: '上架任务', icon: ShoppingCartFull },
        { path: '/ltJobs/wjProductJob', label: '定时采集', icon: AlarmClock },
      ],
    },
    {
      key: 'rakuten-shop',
      label: '商品管理',
      icon: ShoppingBag,
      children: [
        { path: '/ltShop/wjMerchantGoods', label: '待审核商品', icon: Document },
        { path: '/ltShop/wjMerchantGoodsTrue', label: '已审核商品', icon: Finished },
        { path: '/ltShop/wjMerchantGoodsError', label: '异常商品', icon: Warning },
      ],
    },
    {
      key: 'stores',
      label: '店铺管理',
      icon: OfficeBuilding,
      children: [
        { path: '/ltHj/wjMerchant', label: '店铺信息', icon: Shop },
        { path: '/ltShop/GoodsUp', label: '店铺商品', icon: Sell },
      ],
    },
  ]
  if (isSuperadmin.value) {
    groups.push({
      key: 'system',
      label: '系统管理',
      icon: Tools,
      children: [
        { path: '/system/user', label: '用户管理', icon: UserFilled },
        { path: '/system/role', label: '角色管理', icon: Postcard },
      ],
    })
  }
  return groups
})

const sidebarCollapseIcon = computed(() => (sidebarCollapsed.value ? Expand : Fold))
const formattedSystemTime = computed(() => formatSystemDateTime(systemNow.value))

let systemClockTimer: number | undefined

onMounted(() => {
  systemNow.value = new Date()
  systemClockTimer = window.setInterval(() => {
    systemNow.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (systemClockTimer !== undefined) {
    window.clearInterval(systemClockTimer)
  }
})

async function handleMenuSelect(path: string) {
  if (path !== activePath.value) {
    await router.push(path)
  }
}

function toggleSidebarCollapsed() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function formatSystemDateTime(value: Date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const year = value.getFullYear()
  const month = padDatePart(value.getMonth() + 1)
  const day = padDatePart(value.getDate())
  const hours = padDatePart(value.getHours())
  const minutes = padDatePart(value.getMinutes())
  const seconds = padDatePart(value.getSeconds())
  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds} ${weekdays[value.getDay()]}`
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

async function confirmLogout() {
  try {
    await ElMessageBox.confirm('确认退出当前账号？', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true,
    })
    emit('logout')
  } catch {
  }
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
        <template v-for="item in menuGroups" :key="item.path || item.key">
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
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
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
      <header class="shell-header">
        <div class="header-left">
          <span class="system-clock">{{ formattedSystemTime }}</span>
        </div>
        <div class="header-user">
          <span class="role-tag">{{ isSuperadmin ? '超级管理员' : '运营用户' }}</span>
          <span class="user-name">{{ displayName }}</span>
          <el-tooltip content="主题设置" placement="bottom">
            <el-button
              class="theme-trigger"
              :icon="Setting"
              plain
              @click="themeDrawerOpen = true"
            >
              主题
            </el-button>
          </el-tooltip>
          <el-button
            :icon="SwitchButton"
            plain
            @click="confirmLogout"
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

    <el-drawer
      v-model="themeDrawerOpen"
      class="theme-settings-drawer"
      title="主题设置"
      size="380px"
      append-to-body
    >
      <section class="theme-settings-panel" aria-label="主题设置">
        <div class="theme-settings-section">
          <h3>模式</h3>
          <el-segmented
            v-model="themeSettings.mode"
            class="theme-mode-switch"
            :options="themeModeSegmentOptions"
          />
        </div>

        <div class="theme-settings-section">
          <h3>色彩</h3>
          <div class="theme-preset-grid">
            <button
              v-for="option in themePresetOptions"
              :key="option.key"
              class="theme-choice theme-preset-choice"
              :class="{ 'theme-choice-active': themeSettings.preset === option.key }"
              type="button"
              @click="updateThemeSetting('preset', option.key)"
            >
              <span
                class="theme-preset-swatch"
                :style="{
                  '--preset-primary': option.primary,
                  '--preset-accent': option.accent,
                  '--preset-surface': option.surface,
                }"
              />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="theme-settings-section">
          <h3>字体</h3>
          <div class="theme-option-grid">
            <button
              v-for="option in themeFontOptions"
              :key="option.key"
              class="theme-choice"
              :class="{ 'theme-choice-active': themeSettings.font === option.key }"
              type="button"
              @click="updateThemeSetting('font', option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="theme-settings-section">
          <h3>密度</h3>
          <div class="theme-option-grid">
            <button
              v-for="option in themeDensityOptions"
              :key="option.key"
              class="theme-choice"
              :class="{ 'theme-choice-active': themeSettings.density === option.key }"
              type="button"
              @click="updateThemeSetting('density', option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="theme-settings-section">
          <h3>圆角</h3>
          <div class="theme-option-grid">
            <button
              v-for="option in themeRadiusOptions"
              :key="option.key"
              class="theme-choice"
              :class="{ 'theme-choice-active': themeSettings.radius === option.key }"
              type="button"
              @click="updateThemeSetting('radius', option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="theme-settings-section">
          <h3>表面</h3>
          <div class="theme-option-grid">
            <button
              v-for="option in themeSurfaceOptions"
              :key="option.key"
              class="theme-choice"
              :class="{ 'theme-choice-active': themeSettings.surface === option.key }"
              type="button"
              @click="updateThemeSetting('surface', option.key)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <footer class="theme-settings-footer">
          <el-button plain @click="resetThemeSettings">恢复默认</el-button>
        </footer>
      </section>
    </el-drawer>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  height: 100vh;
  min-height: 0;
  grid-template-columns: 238px minmax(0, 1fr);
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
  gap: 12px;
  min-height: 72px;
  padding: 0 18px;
  border-bottom: 1px solid var(--panel-border);
  overflow: hidden;
  transition: justify-content 220ms ease, padding 220ms ease;
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
  flex: 0 0 auto;
}

.brand-mark img {
  display: block;
  width: 30px;
  height: 30px;
}

.brand-copy {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 1;
  max-width: 150px;
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
  padding: 12px 10px;
  overflow: hidden;
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
  padding-left: 42px !important;
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
  padding: 12px 10px 14px;
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

.shell-header {
  flex: 0 0 auto;
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

.header-left {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-start;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.system-clock {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
  color: var(--text-main);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  padding: 0 10px;
  white-space: nowrap;
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
  flex: 1;
  min-height: 0;
  padding: 22px 24px 34px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.theme-trigger {
  flex: 0 0 auto;
}

.theme-settings-panel {
  display: grid;
  gap: 22px;
  color: var(--text-main);
}

.theme-settings-section {
  display: grid;
  gap: 12px;
}

.theme-settings-section h3 {
  margin: 0;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 800;
}

.theme-mode-switch {
  width: 100%;
}

.theme-preset-grid,
.theme-option-grid {
  display: grid;
  gap: 8px;
}

.theme-preset-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.theme-option-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.theme-choice {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  color: var(--text-soft);
  cursor: pointer;
  font-weight: 700;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.theme-choice:hover,
.theme-choice:focus-visible {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
  outline: none;
}

.theme-choice-active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent), transparent 74%);
}

.theme-preset-choice {
  justify-content: flex-start;
  padding: 0 10px;
}

.theme-preset-swatch {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--preset-primary), #ffffff 32%);
  border-radius: var(--radius-xs);
  background:
    linear-gradient(135deg, var(--preset-primary) 0 45%, var(--preset-accent) 45% 72%, var(--preset-surface) 72% 100%);
}

.theme-settings-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--panel-border);
  padding-top: 14px;
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

  .shell-header {
    align-items: stretch;
    flex-direction: column;
    padding: 14px 16px;
  }

  .header-left {
    justify-content: flex-start;
  }

  .header-user {
    justify-content: flex-start;
  }

  .shell-content {
    padding: 16px;
  }

  .theme-preset-grid,
  .theme-option-grid {
    grid-template-columns: 1fr;
  }
}
</style>
