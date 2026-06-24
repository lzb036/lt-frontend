import { computed, reactive, ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ThemePresetKey = 'default' | 'anthropic' | 'large-simple' | 'night' | 'rose-garden' | 'lagoon' | 'sunset' | 'forest' | 'sea-breeze' | 'wisteria'
export type ThemeFontMode = 'auto' | 'sans' | 'microsoft' | 'pingfang' | 'noto' | 'serif' | 'japanese' | 'mono'
export type ThemeRadiusMode = 'auto' | '0' | '0.3' | '0.5' | '0.75' | '1.0'
export type ThemeDensityMode = 'compact' | 'default' | 'relaxed' | 'large'
export type ThemeSurfaceMode = 'standard' | 'soft' | 'glass' | 'line'

export interface ThemeSettings {
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

export const defaultThemeSettings: ThemeSettings = {
  mode: 'light',
  preset: 'forest',
  font: 'microsoft',
  radius: '0',
  density: 'default',
  surface: 'standard',
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

export const themeFontOptions: ThemeOption<ThemeFontMode>[] = [
  { key: 'sans', label: '系统黑体' },
  { key: 'microsoft', label: '微软雅黑' },
  { key: 'pingfang', label: '苹方' },
  { key: 'noto', label: '思源黑体' },
  { key: 'serif', label: '宋体' },
  { key: 'mono', label: '等宽' },
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
}

function optionExists<T extends string>(options: ThemeOption<T>[], value: unknown): value is T {
  return typeof value === 'string' && options.some((option) => option.key === value)
}

function presetExists(value: unknown): value is ThemePresetKey {
  return typeof value === 'string' && themePresetOptions.some((option) => option.key === value)
}
