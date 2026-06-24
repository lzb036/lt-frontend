<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import {
  Calendar,
  DataBoard,
  Goods,
  Key,
  List,
  Management,
  Operation,
  Search,
  Setting,
  Shop,
  SwitchButton,
  Upload,
  User,
} from '@element-plus/icons-vue'

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

type ThemeMode = 'system' | 'light' | 'dark'
type ThemePresetKey = 'default' | 'anthropic' | 'large-simple' | 'night' | 'rose-garden' | 'lagoon' | 'sunset' | 'forest' | 'sea-breeze' | 'wisteria'
type ThemeFontMode = 'auto' | 'sans' | 'microsoft' | 'pingfang' | 'noto' | 'serif' | 'japanese' | 'mono'
type ThemeRadiusMode = 'auto' | '0' | '0.3' | '0.5' | '0.75' | '1.0'
type ThemeDensityMode = 'compact' | 'default' | 'relaxed' | 'large'
type ThemeSurfaceMode = 'standard' | 'soft' | 'glass' | 'line'

interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePresetKey
  font: ThemeFontMode
  radius: ThemeRadiusMode
  density: ThemeDensityMode
  surface: ThemeSurfaceMode
}

interface ThemeOption<T extends string> {
  key: T
  label: string
}

interface ThemePresetOption extends ThemeOption<ThemePresetKey> {
  primary: string
  accent: string
  surface: string
}

const THEME_SETTINGS_STORAGE_KEY = 'lt_product_collector_theme_settings'

const defaultThemeSettings: ThemeSettings = {
  mode: 'light',
  preset: 'default',
  font: 'sans',
  radius: '0.5',
  density: 'default',
  surface: 'standard',
}

const themeModeOptions: ThemeOption<ThemeMode>[] = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
]

const themePresetOptions: ThemePresetOption[] = [
  { key: 'default', label: '默认', primary: '#4f5df7', accent: '#c7d2fe', surface: '#f4f7ff' },
  { key: 'anthropic', label: '陶土', primary: '#d97757', accent: '#f2c5b2', surface: '#f8f4f1' },
  { key: 'large-simple', label: '简洁', primary: '#111827', accent: '#cbd5e1', surface: '#f5f6f8' },
  { key: 'night', label: '夜航', primary: '#3f7ee8', accent: '#1c2f4b', surface: '#0f1b2d' },
  { key: 'rose-garden', label: '玫瑰', primary: '#e83f74', accent: '#ffc1d2', surface: '#fbf4f7' },
  { key: 'lagoon', label: '湖光', primary: '#0f9f8b', accent: '#a9e8dd', surface: '#f1fbfa' },
  { key: 'sunset', label: '日落', primary: '#df5f47', accent: '#ffc3aa', surface: '#fbf5ef' },
  { key: 'forest', label: '森林', primary: '#2f7a67', accent: '#b5dcd0', surface: '#f2f8f5' },
  { key: 'sea-breeze', label: '海风', primary: '#4f5df7', accent: '#c5d0ff', surface: '#f1f6ff' },
  { key: 'wisteria', label: '藤紫', primary: '#8b5fd3', accent: '#d6c6f6', surface: '#f7f4fc' },
]

const themeFontOptions: ThemeOption<ThemeFontMode>[] = [
  { key: 'sans', label: '系统黑体' },
  { key: 'microsoft', label: '微软雅黑' },
  { key: 'pingfang', label: '苹方' },
  { key: 'noto', label: '思源黑体' },
  { key: 'serif', label: '宋体' },
  { key: 'mono', label: '等宽' },
]

const themeRadiusOptions: ThemeOption<ThemeRadiusMode>[] = [
  { key: '0', label: '0' },
  { key: '0.3', label: '0.3' },
  { key: '0.5', label: '0.5' },
  { key: '0.75', label: '0.75' },
  { key: '1.0', label: '1.0' },
]

const themeDensityOptions: ThemeOption<ThemeDensityMode>[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'default', label: '默认' },
  { key: 'relaxed', label: '宽松' },
  { key: 'large', label: '大号' },
]

const themeSurfaceOptions: ThemeOption<ThemeSurfaceMode>[] = [
  { key: 'standard', label: '标准' },
  { key: 'soft', label: '柔和' },
  { key: 'glass', label: '透亮' },
  { key: 'line', label: '细线' },
]

const themeStorageKey = computed(() => {
  const identity = props.session?.username || 'guest'
  return `${THEME_SETTINGS_STORAGE_KEY}:${identity}`
})
const themeDrawerOpen = ref(false)
const systemPrefersDark = ref(false)
const themeSettings = reactive<ThemeSettings>(readStoredThemeSettings())
const themeModeSegmentOptions = themeModeOptions.map((option) => ({
  label: option.label,
  value: option.key,
}))

let themeMediaQuery: MediaQueryList | null = null

const effectiveThemeMode = computed<'light' | 'dark'>(() => {
  if (themeSettings.mode === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light'
  }
  return themeSettings.mode
})

const menuGroups = computed(() => {
  const groups = [
    {
      path: '/dashboard',
      label: '首页',
      icon: DataBoard,
    },
    {
      key: 'jobs',
      label: '任务管理',
      icon: List,
      children: [
        { path: '/ltJobs/wjJobs', label: '手动采集', icon: Search },
        { path: '/ltJobs/upGoodsJob', label: '上架任务', icon: Upload },
        { path: '/ltJobs/wjProductJob', label: '定时采集', icon: Calendar },
      ],
    },
    {
      key: 'rakuten-shop',
      label: '乐天店铺管理',
      icon: Goods,
      children: [
        { path: '/ltShop/wjMerchantGoods', label: '待审核商品', icon: Goods },
        { path: '/ltShop/wjMerchantGoodsTrue', label: '已审核商品', icon: Operation },
        { path: '/ltShop/wjMerchantGoodsError', label: '异常商品', icon: Setting },
        { path: '/ltShop/GoodsUp', label: '上架商品', icon: Upload },
      ],
    },
    {
      key: 'stores',
      label: '店铺管理',
      icon: Shop,
      children: [
        { path: '/ltHj/wjMerchant', label: '店铺信息', icon: Shop },
      ],
    },
    {
      key: 'profile',
      label: '个人中心',
      icon: Key,
      children: [
        { path: '/user/profile', label: '密钥配置', icon: Key },
        { path: '/sources', label: '采集源配置', icon: Management },
      ],
    },
  ]
  if (isSuperadmin.value) {
    groups.push({
      key: 'system',
      label: '系统管理',
      icon: User,
      children: [
        { path: '/system/user', label: '用户管理', icon: User },
        { path: '/system/role', label: '角色管理', icon: Management },
      ],
    })
  }
  return groups
})

async function handleMenuSelect(path: string) {
  if (path !== activePath.value) {
    await router.push(path)
  }
}

function optionExists<T extends string>(options: ThemeOption<T>[], value: unknown): value is T {
  return typeof value === 'string' && options.some((option) => option.key === value)
}

function presetExists(value: unknown): value is ThemePresetKey {
  return typeof value === 'string' && themePresetOptions.some((option) => option.key === value)
}

function readStoredThemeSettings(storageKey = themeStorageKey.value): ThemeSettings {
  if (typeof window === 'undefined') {
    return { ...defaultThemeSettings }
  }
  try {
    const rawValue = window.localStorage.getItem(storageKey)
    if (!rawValue) {
      return { ...defaultThemeSettings }
    }
    const stored = JSON.parse(rawValue) as Partial<ThemeSettings>
    return {
      mode: optionExists(themeModeOptions, stored.mode) ? stored.mode : defaultThemeSettings.mode,
      preset: presetExists(stored.preset) ? stored.preset : defaultThemeSettings.preset,
      font: optionExists(themeFontOptions, stored.font) ? stored.font : defaultThemeSettings.font,
      radius: optionExists(themeRadiusOptions, stored.radius) ? stored.radius : defaultThemeSettings.radius,
      density: optionExists(themeDensityOptions, stored.density) ? stored.density : defaultThemeSettings.density,
      surface: optionExists(themeSurfaceOptions, stored.surface) ? stored.surface : defaultThemeSettings.surface,
    }
  } catch {
    return { ...defaultThemeSettings }
  }
}

function persistThemeSettings() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(themeStorageKey.value, JSON.stringify({ ...themeSettings }))
}

function applyThemeSettings() {
  if (typeof document === 'undefined') {
    return
  }
  const root = document.documentElement
  root.dataset.themeMode = effectiveThemeMode.value
  root.dataset.themePreset = themeSettings.preset
  root.dataset.themeFont = themeSettings.font
  root.dataset.themeRadius = themeSettings.radius
  root.dataset.themeDensity = themeSettings.density
  root.dataset.themeSurface = themeSettings.surface
}

function updateThemeSetting<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
  themeSettings[key] = value
}

function resetThemeSettings() {
  Object.assign(themeSettings, defaultThemeSettings)
}

function handleThemeMediaChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

onMounted(() => {
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = themeMediaQuery.matches
  themeMediaQuery.addEventListener('change', handleThemeMediaChange)
  applyThemeSettings()
})

onUnmounted(() => {
  themeMediaQuery?.removeEventListener('change', handleThemeMediaChange)
})

watch(themeStorageKey, (storageKey) => {
  Object.assign(themeSettings, readStoredThemeSettings(storageKey))
})

watch(
  themeSettings,
  () => {
    persistThemeSettings()
    applyThemeSettings()
  },
  { deep: true },
)

watch(effectiveThemeMode, () => {
  applyThemeSettings()
})
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
}

.shell-sidebar {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--panel-border);
  background: var(--sidebar-bg);
  overflow: hidden;
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
  min-height: 0;
  border-right: 0;
  background: transparent;
  padding: 12px 10px;
  overflow: hidden;
}

.shell-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 2px 0;
  border-radius: 6px;
  color: var(--sidebar-text);
  font-weight: 700;
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

.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
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

  .shell-header {
    align-items: stretch;
    flex-direction: column;
    padding: 14px 16px;
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
