import type {
  AuthSession,
  SalesAnalysisCapability,
  SalesAnalysisConstraintSection,
  SalesAnalysisSettings,
  SalesAnalysisSettingsPayload,
  SalesOrderSyncGlobalSettings,
  SalesOrderSyncGlobalSettingsPayload,
} from '../types/crawler'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canManageSalesOrderSyncSettings,
  createCatalogState,
  createSalesOrderSyncSettingsDraftState,
  createSettingsDraftState,
  loadCatalogState,
  loadSalesOrderSyncSettingsDraftState,
  loadSettingsDraftState,
  saveSalesOrderSyncSettingsDraftState,
  saveSettingsDraftState,
  shouldConfirmAnySettingsLeave,
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

const concurrentState = createSettingsDraftState(defaults)
await loadSettingsDraftState(concurrentState, loadedSettings)
let resolvePendingSave!: (settings: SalesAnalysisSettings) => void
const pendingSave = saveSettingsDraftState(
  concurrentState,
  (payload) => new Promise<SalesAnalysisSettings>((resolve) => {
    putPayloads.push(payload)
    resolvePendingSave = resolve
  }),
)
concurrentState.draft.customBusinessInstructions = '保存请求期间新增的编辑'
resolvePendingSave({
  ...loadedSettings,
  customBusinessInstructions: '',
})
const concurrentSaved = await pendingSave

if (!concurrentSaved) {
  throw new Error('expected pending settings save to complete successfully')
}
if (concurrentState.draft.customBusinessInstructions !== '保存请求期间新增的编辑') {
  throw new Error('expected edits made during pending save not to be overwritten')
}
if (!concurrentState.isDirty()) {
  throw new Error('expected edits made after the save snapshot to remain unsaved')
}

const operatorSession = {
  role: 'operator',
} as AuthSession
const superadminSession = {
  role: 'superadmin',
} as AuthSession

if (canManageSalesOrderSyncSettings(operatorSession)) {
  throw new Error('expected ordinary users not to see sales order sync settings')
}
if (!canManageSalesOrderSyncSettings(superadminSession)) {
  throw new Error('expected superadmins to see sales order sync settings')
}

const salesOrderSyncDefaults: SalesOrderSyncGlobalSettingsPayload = {
  enabled: true,
  intervalMinutes: 30,
  successRetentionDays: 30,
}
const loadedSalesOrderSyncSettings: SalesOrderSyncGlobalSettings = {
  enabled: false,
  intervalMinutes: 120,
  successRetentionDays: 90,
}
const salesOrderSyncState = createSalesOrderSyncSettingsDraftState(
  salesOrderSyncDefaults,
)
const globalPutPayloads: SalesOrderSyncGlobalSettingsPayload[] = []
const globalPutCallCount = () => Number(globalPutPayloads.length)

await loadSalesOrderSyncSettingsDraftState(
  salesOrderSyncState,
  loadedSalesOrderSyncSettings,
)
salesOrderSyncState.draft.intervalMinutes = 15
salesOrderSyncState.restoreDefaults()

if (globalPutCallCount() !== 0) {
  throw new Error('expected restoring global defaults to avoid persistence')
}
if (
  !salesOrderSyncState.isDirty()
  || salesOrderSyncState.draft.enabled !== true
  || salesOrderSyncState.draft.intervalMinutes !== 30
  || salesOrderSyncState.draft.successRetentionDays !== 30
) {
  throw new Error('expected restoring global defaults to leave an unsaved draft')
}
if (!shouldConfirmAnySettingsLeave(draftState, salesOrderSyncState)) {
  throw new Error('expected either dirty settings draft to require leave confirmation')
}

const globalSaved = await saveSalesOrderSyncSettingsDraftState(
  salesOrderSyncState,
  async (payload) => {
    globalPutPayloads.push(payload)
    return { ...payload }
  },
)

if (!globalSaved || globalPutCallCount() !== 1 || salesOrderSyncState.isDirty()) {
  throw new Error('expected explicit global settings save to persist once')
}

const settingsViewSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../components/crawler/ProductSalesAnalysisSettingsView.vue',
  ),
  'utf8',
)

for (const requiredMarkup of [
  'v-if="canManageSalesOrderSync"',
  'label="订单同步设置"',
  'v-model="salesOrderSyncDraft.enabled"',
  ':min="5"',
  ':max="1440"',
  ':min="1"',
  ':max="365"',
  '@click="restoreSalesOrderSyncDefaults"',
  '@click="saveSalesOrderSyncSettings"',
]) {
  if (!settingsViewSource.includes(requiredMarkup)) {
    throw new Error(`expected sales order sync settings markup: ${requiredMarkup}`)
  }
}
