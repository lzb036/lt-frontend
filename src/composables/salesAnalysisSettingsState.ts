import type {
  SalesAnalysisSettings,
  SalesAnalysisSettingsPayload,
} from '../types/crawler'

export type SettingsDraftState = {
  draft: SalesAnalysisSettingsPayload
  defaults: SalesAnalysisSettingsPayload
  savedSnapshot: SalesAnalysisSettingsPayload | null
  loading: boolean
  saving: boolean
  error: string
  isDirty: () => boolean
  restoreDefaults: () => void
}

export type CatalogState<T> = {
  items: T[]
  loading: boolean
  error: string
}

export function copySettingsPayload(
  settings: SalesAnalysisSettingsPayload,
): SalesAnalysisSettingsPayload {
  return {
    defaultPeriodDays: settings.defaultPeriodDays,
    defaultRankingLimit: settings.defaultRankingLimit,
    defaultMetric: settings.defaultMetric,
    defaultGrain: settings.defaultGrain,
    answerDetailLevel: settings.answerDetailLevel,
    prioritizeAdjustmentRisk: settings.prioritizeAdjustmentRisk,
    showDataUpdatedAt: settings.showDataUpdatedAt,
    showMetricDefinition: settings.showMetricDefinition,
    customBusinessInstructions: settings.customBusinessInstructions,
  }
}

export function createSettingsDraftState(
  defaults: SalesAnalysisSettingsPayload,
): SettingsDraftState {
  return {
    draft: copySettingsPayload(defaults),
    defaults: copySettingsPayload(defaults),
    savedSnapshot: null,
    loading: false,
    saving: false,
    error: '',
    isDirty() {
      return this.savedSnapshot !== null
        && JSON.stringify(this.draft) !== JSON.stringify(this.savedSnapshot)
    },
    restoreDefaults() {
      Object.assign(this.draft, this.defaults)
    },
  }
}

export function createCatalogState<T>(): CatalogState<T> {
  return {
    items: [],
    loading: false,
    error: '',
  }
}

export function loadSettingsDraftState(
  state: SettingsDraftState,
  settingsOrRequest: SalesAnalysisSettings | Promise<SalesAnalysisSettings>,
): Promise<boolean> {
  state.loading = true
  state.error = ''
  return Promise.resolve(settingsOrRequest)
    .then((settings) => {
      const snapshot = copySettingsPayload(settings)
      Object.assign(state.draft, snapshot)
      state.savedSnapshot = snapshot
      return true
    })
    .catch((error: unknown) => {
      state.error = errorMessage(error)
      return false
    })
    .finally(() => {
      state.loading = false
    })
}

export async function saveSettingsDraftState(
  state: SettingsDraftState,
  save: (payload: SalesAnalysisSettingsPayload) => Promise<SalesAnalysisSettings>,
): Promise<boolean> {
  state.saving = true
  state.error = ''
  try {
    const settings = await save(copySettingsPayload(state.draft))
    const snapshot = copySettingsPayload(settings)
    Object.assign(state.draft, snapshot)
    state.savedSnapshot = snapshot
    return true
  } catch (error) {
    state.error = errorMessage(error)
    return false
  } finally {
    state.saving = false
  }
}

export async function loadCatalogState<T>(
  state: CatalogState<T>,
  load: () => Promise<T[]>,
): Promise<boolean> {
  state.loading = true
  state.error = ''
  try {
    state.items = await load()
    return true
  } catch (error) {
    state.error = errorMessage(error)
    return false
  } finally {
    state.loading = false
  }
}

export function shouldConfirmSettingsLeave(state: SettingsDraftState) {
  return state.isDirty()
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : '请求失败'
}
