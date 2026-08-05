import { computed, reactive, ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ThemePresetKey = 'default' | 'anthropic' | 'large-simple' | 'night' | 'rose-garden' | 'lagoon' | 'sunset' | 'forest' | 'sea-breeze' | 'wisteria'
export type ThemeFontMode = 'sans' | 'microsoft' | 'serif' | 'mono'
export type ThemeRadiusMode = 'auto' | '0' | '0.3' | '0.5' | '0.75' | '1.0'
export type ThemeDensityMode = 'compact' | 'default' | 'relaxed' | 'large'
export type ThemeSurfaceMode = 'standard' | 'soft' | 'glass' | 'line'
export type ThemeNavigationMode = 'blend' | 'solid' | 'accent'
export type ThemeContentWidthMode = 'fluid' | 'wide' | 'focused'
export type ThemeTableMode = 'plain' | 'striped' | 'grid'
export type ThemeContrastMode = 'soft' | 'standard' | 'high'
export type ThemeShadowMode = 'flat' | 'subtle' | 'elevated'
export type ThemeMotionMode = 'full' | 'reduced' | 'none'

export interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePresetKey
  font: ThemeFontMode
  radius: ThemeRadiusMode
  density: ThemeDensityMode
  surface: ThemeSurfaceMode
  navigation: ThemeNavigationMode
  contentWidth: ThemeContentWidthMode
  table: ThemeTableMode
  contrast: ThemeContrastMode
  shadow: ThemeShadowMode
  motion: ThemeMotionMode
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

interface ThemeFontOption extends ThemeOption<ThemeFontMode> {
  fontFamily: string
  sample: string
}

const THEME_SETTINGS_STORAGE_KEY = 'lt_product_collector_theme_settings'

export const defaultThemeSettings: ThemeSettings = {
  mode: 'dark',
  preset: 'large-simple',
  font: 'microsoft',
  radius: '0',
  density: 'default',
  surface: 'standard',
  navigation: 'blend',
  contentWidth: 'fluid',
  table: 'plain',
  contrast: 'standard',
  shadow: 'subtle',
  motion: 'full',
}

export const themeModeOptions: ThemeOption<ThemeMode>[] = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
]

export const themePresetOptions: ThemePresetOption[] = [
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

export const themeFontOptions: ThemeFontOption[] = [
  {
    key: 'sans',
    label: '现代黑体',
    fontFamily: '"DengXian", "Segoe UI Variable", "Microsoft YaHei", sans-serif',
    sample: 'Aa 采集 128',
  },
  {
    key: 'microsoft',
    label: '微软雅黑',
    fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    sample: 'Aa 采集 128',
  },
  {
    key: 'serif',
    label: '传统宋体',
    fontFamily: '"Songti SC", "SimSun", Georgia, serif',
    sample: 'Aa 采集 128',
  },
  {
    key: 'mono',
    label: '等宽字体',
    fontFamily: '"Cascadia Mono", "Consolas", "NSimSun", monospace',
    sample: 'Aa 采集 128',
  },
]

export const themeRadiusOptions: ThemeOption<ThemeRadiusMode>[] = [
  { key: '0', label: '0' },
  { key: '0.3', label: '0.3' },
  { key: '0.5', label: '0.5' },
  { key: '0.75', label: '0.75' },
  { key: '1.0', label: '1.0' },
]

export const themeDensityOptions: ThemeOption<ThemeDensityMode>[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'default', label: '默认' },
  { key: 'relaxed', label: '宽松' },
  { key: 'large', label: '大号' },
]

export const themeSurfaceOptions: ThemeOption<ThemeSurfaceMode>[] = [
  { key: 'standard', label: '标准' },
  { key: 'soft', label: '柔和' },
  { key: 'glass', label: '透亮' },
  { key: 'line', label: '细线' },
]

export const themeNavigationOptions: ThemeOption<ThemeNavigationMode>[] = [
  { key: 'blend', label: '融合' },
  { key: 'solid', label: '沉稳' },
  { key: 'accent', label: '强调' },
]

export const themeContentWidthOptions: ThemeOption<ThemeContentWidthMode>[] = [
  { key: 'fluid', label: '铺满' },
  { key: 'wide', label: '宽屏' },
  { key: 'focused', label: '聚焦' },
]

export const themeTableOptions: ThemeOption<ThemeTableMode>[] = [
  { key: 'plain', label: '简洁' },
  { key: 'striped', label: '斑马纹' },
  { key: 'grid', label: '网格' },
]

export const themeContrastOptions: ThemeOption<ThemeContrastMode>[] = [
  { key: 'soft', label: '柔和' },
  { key: 'standard', label: '标准' },
  { key: 'high', label: '清晰' },
]

export const themeShadowOptions: ThemeOption<ThemeShadowMode>[] = [
  { key: 'flat', label: '平面' },
  { key: 'subtle', label: '轻盈' },
  { key: 'elevated', label: '悬浮' },
]

export const themeMotionOptions: ThemeOption<ThemeMotionMode>[] = [
  { key: 'full', label: '流畅' },
  { key: 'reduced', label: '克制' },
  { key: 'none', label: '关闭' },
]

export const themeModeSegmentOptions = themeModeOptions.map((option) => ({
  label: option.label,
  value: option.key,
}))

const systemPrefersDark = ref(false)
const themeSettings = reactive<ThemeSettings>({ ...defaultThemeSettings })
const effectiveThemeMode = computed<'light' | 'dark'>(() => {
  if (themeSettings.mode === 'system') {
    return systemPrefersDark.value ? 'dark' : 'light'
  }
  return themeSettings.mode
})

let initialized = false
let themeMediaQuery: MediaQueryList | null = null

export function useTheme() {
  initializeTheme()

  return {
    defaultThemeSettings,
    themeSettings,
    themeModeSegmentOptions,
    themePresetOptions,
    themeFontOptions,
    themeRadiusOptions,
    themeDensityOptions,
    themeSurfaceOptions,
    themeNavigationOptions,
    themeContentWidthOptions,
    themeTableOptions,
    themeContrastOptions,
    themeShadowOptions,
    themeMotionOptions,
    updateThemeSetting,
    resetThemeSettings,
  }
}

export function initializeTheme() {
  if (!initialized) {
    Object.assign(themeSettings, readStoredThemeSettings())
    bindSystemThemeListener()
    watch(themeSettings, syncThemeSettings, { deep: true })
    watch(effectiveThemeMode, applyThemeSettings)
    initialized = true
  }
  applyThemeSettings()
}

function syncThemeSettings() {
  persistThemeSettings()
  applyThemeSettings()
}

function updateThemeSetting<K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) {
  themeSettings[key] = value
}

function resetThemeSettings() {
  Object.assign(themeSettings, defaultThemeSettings)
}

function bindSystemThemeListener() {
  if (typeof window === 'undefined' || themeMediaQuery) {
    return
  }
  themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = themeMediaQuery.matches
  themeMediaQuery.addEventListener('change', handleThemeMediaChange)
}

function handleThemeMediaChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

function readStoredThemeSettings(): ThemeSettings {
  if (typeof window === 'undefined') {
    return { ...defaultThemeSettings }
  }
  try {
    const rawValue = window.localStorage.getItem(THEME_SETTINGS_STORAGE_KEY)
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
      navigation: optionExists(themeNavigationOptions, stored.navigation) ? stored.navigation : defaultThemeSettings.navigation,
      contentWidth: optionExists(themeContentWidthOptions, stored.contentWidth) ? stored.contentWidth : defaultThemeSettings.contentWidth,
      table: optionExists(themeTableOptions, stored.table) ? stored.table : defaultThemeSettings.table,
      contrast: optionExists(themeContrastOptions, stored.contrast) ? stored.contrast : defaultThemeSettings.contrast,
      shadow: optionExists(themeShadowOptions, stored.shadow) ? stored.shadow : defaultThemeSettings.shadow,
      motion: optionExists(themeMotionOptions, stored.motion) ? stored.motion : defaultThemeSettings.motion,
    }
  } catch {
    return { ...defaultThemeSettings }
  }
}

function persistThemeSettings() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify({ ...themeSettings }))
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
  root.dataset.themeNavigation = themeSettings.navigation
  root.dataset.themeContentWidth = themeSettings.contentWidth
  root.dataset.themeTable = themeSettings.table
  root.dataset.themeContrast = themeSettings.contrast
  root.dataset.themeShadow = themeSettings.shadow
  root.dataset.themeMotion = themeSettings.motion
  root.style.colorScheme = effectiveThemeMode.value
}

function optionExists<T extends string>(options: ThemeOption<T>[], value: unknown): value is T {
  return typeof value === 'string' && options.some((option) => option.key === value)
}

function presetExists(value: unknown): value is ThemePresetKey {
  return typeof value === 'string' && themePresetOptions.some((option) => option.key === value)
}
