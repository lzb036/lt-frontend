import type {
  SalesAnalysisCapability,
  SalesAnalysisConstraintSection,
  SalesAnalysisSettings,
  SalesAnalysisSettingsPayload,
} from '../types/crawler'
import {
  createCatalogState,
  createSettingsDraftState,
  loadCatalogState,
  loadSettingsDraftState,
  saveSettingsDraftState,
  shouldConfirmSettingsLeave,
} from './salesAnalysisSettingsState.ts'

const defaults: SalesAnalysisSettingsPayload = {
  defaultPeriodDays: 30,
  defaultRankingLimit: 10,
  defaultMetric: 'effectiveUnits',
  defaultGrain: 'day',
  answerDetailLevel: 'standard',
  prioritizeAdjustmentRisk: true,
  showDataUpdatedAt: true,
  showMetricDefinition: true,
  customBusinessInstructions: '',
}

const loadedSettings: SalesAnalysisSettings = {
  ...defaults,
  defaultRankingLimit: 20,
}

const draftState = createSettingsDraftState(defaults)
const putPayloads: SalesAnalysisSettingsPayload[] = []
const putCallCount = () => Number(putPayloads.length)

if (putCallCount() !== 0) {
  throw new Error('expected creating a draft to avoid persistence')
}

await loadSettingsDraftState(draftState, loadedSettings)
draftState.draft.defaultRankingLimit = 35
draftState.restoreDefaults()

if (putCallCount() !== 0) {
  throw new Error('expected restoring defaults to change only the draft')
}
if (draftState.draft.defaultRankingLimit !== 10 || !draftState.isDirty()) {
  throw new Error('expected restored defaults to remain an unsaved dirty draft')
}
if (!shouldConfirmSettingsLeave(draftState)) {
  throw new Error('expected dirty settings to require leave confirmation')
}

const saved = await saveSettingsDraftState(draftState, async (payload) => {
  putPayloads.push(payload)
  return { ...payload, updatedAt: '2026-07-17T20:00:00+08:00' }
})

if (!saved || putCallCount() !== 1 || draftState.isDirty()) {
  throw new Error('expected save success to persist once and refresh the saved snapshot')
}
if (shouldConfirmSettingsLeave(draftState)) {
  throw new Error('expected a saved draft to allow navigation without confirmation')
}

draftState.draft.defaultRankingLimit = 45
const snapshotBeforeFailure = JSON.stringify(draftState.savedSnapshot)
const failed = await saveSettingsDraftState(draftState, async (payload) => {
  putPayloads.push(payload)
  throw new Error('save unavailable')
})

if (failed || putCallCount() !== 2) {
  throw new Error('expected save failure to be reported without a false success')
}
if (
  JSON.stringify(draftState.savedSnapshot) !== snapshotBeforeFailure
  || !draftState.isDirty()
) {
  throw new Error('expected save failure to preserve the previous snapshot and dirty draft')
}
if (draftState.error !== 'save unavailable') {
  throw new Error('expected save failure to remain available to the component')
}

const settingsState = createSettingsDraftState(defaults)
const capabilityState = createCatalogState<SalesAnalysisCapability>()
const constraintState = createCatalogState<SalesAnalysisConstraintSection>()

await Promise.all([
  loadSettingsDraftState(settingsState, Promise.resolve(loadedSettings)),
  loadCatalogState(capabilityState, async () => {
    throw new Error('capabilities unavailable')
  }),
  loadCatalogState(constraintState, async () => []),
])

if (settingsState.loading || settingsState.error || settingsState.draft.defaultRankingLimit !== 20) {
  throw new Error('expected catalog failures not to block personal settings loading')
}
if (!capabilityState.error || capabilityState.items.length !== 0) {
  throw new Error('expected a failed catalog to expose its error separately')
}
if (constraintState.error || constraintState.items.length !== 0) {
  throw new Error('expected a successful empty catalog to remain distinct from failure')
}

settingsState.draft.defaultRankingLimit = 25
const savedAfterPartialFailure = await saveSettingsDraftState(
  settingsState,
  async (payload) => ({ ...payload }),
)
if (!savedAfterPartialFailure || settingsState.isDirty()) {
  throw new Error('expected personal settings to remain editable and saveable after catalog failure')
}
