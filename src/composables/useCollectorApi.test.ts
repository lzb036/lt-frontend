import type {
  SalesAnalysisCapability,
  SalesAnalysisConversation,
  SalesAnalysisConstraintSection,
  SalesAnalysisMessage,
  SalesAnalysisMessagePage,
  SalesAnalysisSettings,
  SalesAnalysisSettingsPayload,
  SalesAnalysisStore,
  SalesAnalysisStoreList,
  SalesAnalysisStreamHandlers,
  SalesAnalysisSyncState,
} from '../types/crawler'
import type { AxiosAdapter } from 'axios'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiClient } from '../utils/api.ts'
import {
  SALES_ANALYSIS_MESSAGE_MAX_LENGTH,
  composeSalesAnalysisScopedMessage,
  formatSalesAnalysisDateTime,
  mergeSalesAnalysisMessages,
  normalizeSalesAnalysisEvent,
  recoverSalesAnalysisSyncStateAfterPollFailure,
  resolveSalesAnalysisConversationStoreId,
  resolveSalesAnalysisDefaultStoreId,
  salesAnalysisSyncStateIsActive,
  salesAnalysisSyncStateStaleMessage,
  salesAnalysisConversationStoreConflict,
  salesAnalysisQuestionLimit,
  salesAnalysisResultCompletenessWarning,
  salesAnalysisStoreRoutingSuffix,
} from './salesAnalysisHelpers.ts'
import { useCollectorApi } from './useCollectorApi.ts'

const productSalesAnalysisViewSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../components/crawler/ProductSalesAnalysisView.vue',
  ),
  'utf8',
)

const api = useCollectorApi()

const getSettings: () => Promise<SalesAnalysisSettings> = api.getSalesAnalysisSettings
const updateSettings: (
  payload: SalesAnalysisSettingsPayload,
) => Promise<SalesAnalysisSettings> = api.updateSalesAnalysisSettings
const listCapabilities: () => Promise<SalesAnalysisCapability[]> = api.listSalesAnalysisCapabilities
const listConstraints: () => Promise<SalesAnalysisConstraintSection[]> = api.listSalesAnalysisConstraints
const listStores: () => Promise<SalesAnalysisStoreList> = api.listSalesAnalysisStores
const getSyncState: (storeId: number) => Promise<SalesAnalysisSyncState> = api.getSalesAnalysisSyncState
const queueSync: (storeId: number) => Promise<SalesAnalysisSyncState> = api.queueSalesAnalysisSync
const getSyncTask: (taskId: string) => Promise<SalesAnalysisSyncState> = api.getSalesAnalysisSyncTask
const listConversations: () => Promise<SalesAnalysisConversation[]> = api.listSalesAnalysisConversations
const createConversation: (title?: string) => Promise<SalesAnalysisConversation> = api.createSalesAnalysisConversation
const deleteConversation: (conversationId: number) => Promise<void> = api.deleteSalesAnalysisConversation
const listMessages: (
  conversationId: number,
  page?: number,
  limit?: number,
) => Promise<SalesAnalysisMessagePage> = api.listSalesAnalysisMessages
const streamMessage: (
  conversationId: number,
  message: string,
  handlers: SalesAnalysisStreamHandlers,
  signal?: AbortSignal,
) => Promise<void> = api.streamSalesAnalysisMessage

void [
  getSettings,
  updateSettings,
  listCapabilities,
  listConstraints,
  listStores,
  getSyncState,
  queueSync,
  getSyncTask,
  listConversations,
  createConversation,
  deleteConversation,
  listMessages,
  streamMessage,
]

const settings: SalesAnalysisSettings = {
  defaultPeriodDays: 30,
  defaultRankingLimit: 10,
  defaultMetric: 'effectiveUnits',
  defaultGrain: 'day',
  answerDetailLevel: 'standard',
  prioritizeAdjustmentRisk: true,
  showDataUpdatedAt: true,
  showMetricDefinition: true,
  customBusinessInstructions: '',
  createdAt: '2026-07-17T10:00:00',
  updatedAt: null,
}

const settingsPayload: SalesAnalysisSettingsPayload = {
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

const capability: SalesAnalysisCapability = {
  key: 'storeOverview',
  title: '店铺销量概览',
  description: '查看指定店铺的销量汇总。',
  example: '最近 30 天店铺销量表现如何？',
  metrics: ['有效销量', '订单数'],
  facts: [
    '首次同步默认覆盖最近 90 天。',
    '自动同步间隔约为 30 分钟。',
  ],
}

const constraintSection: SalesAnalysisConstraintSection = {
  key: 'data_permissions',
  title: '数据权限',
  items: ['只能分析当前用户拥有的店铺。'],
}

void [settingsPayload, capability, constraintSection]

const originalApiAdapter = apiClient.defaults.adapter
const apiCalls: Array<{ method: string; url: string; body?: unknown }> = []
const mockedCapabilities = [capability]
const mockedConstraints = [constraintSection]
const savedSettings: SalesAnalysisSettings = {
  ...settings,
  defaultRankingLimit: 25,
  updatedAt: '2026-07-17T10:30:00',
}

const settingsApiAdapter: AxiosAdapter = async (config) => {
  const method = String(config.method || 'get').toLowerCase()
  const url = String(config.url || '')
  const body = typeof config.data === 'string'
    ? JSON.parse(config.data)
    : config.data
  apiCalls.push({ method, url, body })

  let data: unknown
  if (method === 'get' && url === '/crawler/settings/sales-analysis') {
    data = { settings }
  } else if (method === 'put' && url === '/crawler/settings/sales-analysis') {
    data = { settings: savedSettings }
  } else if (method === 'get' && url === '/crawler/settings/sales-analysis/capabilities') {
    data = { capabilities: mockedCapabilities }
  } else if (method === 'get' && url === '/crawler/settings/sales-analysis/constraints') {
    data = { constraints: mockedConstraints }
  } else {
    throw new Error(`unexpected mocked API request: ${method.toUpperCase()} ${url}`)
  }

  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }
}

apiClient.defaults.adapter = settingsApiAdapter
try {
  const loadedSettings = await api.getSalesAnalysisSettings()
  const updatedSettings = await api.updateSalesAnalysisSettings({
    ...settingsPayload,
    defaultRankingLimit: 25,
  })
  const loadedCapabilities = await api.listSalesAnalysisCapabilities()
  const loadedConstraints = await api.listSalesAnalysisConstraints()

  if (loadedSettings !== settings) {
    throw new Error('expected settings response to be unwrapped')
  }
  if (updatedSettings !== savedSettings) {
    throw new Error('expected updated settings response to be unwrapped')
  }
  if (loadedCapabilities !== mockedCapabilities) {
    throw new Error('expected capabilities response to be unwrapped')
  }
  if (loadedConstraints !== mockedConstraints) {
    throw new Error('expected constraints response to be unwrapped')
  }
} finally {
  apiClient.defaults.adapter = originalApiAdapter
}

const expectedSettingsUpdate = {
  ...settingsPayload,
  defaultRankingLimit: 25,
}
const expectedApiCalls = [
  { method: 'get', url: '/crawler/settings/sales-analysis', body: undefined },
  { method: 'put', url: '/crawler/settings/sales-analysis', body: expectedSettingsUpdate },
  { method: 'get', url: '/crawler/settings/sales-analysis/capabilities', body: undefined },
  { method: 'get', url: '/crawler/settings/sales-analysis/constraints', body: undefined },
]

if (JSON.stringify(apiCalls) !== JSON.stringify(expectedApiCalls)) {
  throw new Error(`unexpected sales analysis settings API calls: ${JSON.stringify(apiCalls)}`)
}

const originalFetch = globalThis.fetch
const encoder = new TextEncoder()

function salesAnalysisStreamResponse(chunks: string[]) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

const terminalMessage: SalesAnalysisMessage = {
  id: 99,
  conversationId: 7,
  question: 'terminal',
  answer: 'done',
  toolName: '',
  toolArguments: [],
  resultSummary: [],
  modelName: '',
  storeScope: [1],
  statisticsWindow: {},
  status: 'completed',
  errorCode: '',
  errorMessage: '',
}

try {
  const completedEvents: number[] = []
  globalThis.fetch = async () => salesAnalysisStreamResponse([
    `data: ${JSON.stringify({ type: 'completed', message: terminalMessage })}\n\n`,
  ])
  await api.streamSalesAnalysisMessage(7, 'normal', {
    onCompleted(message) {
      completedEvents.push(message.id)
    },
  })
  if (completedEvents.join(',') !== '99') {
    throw new Error('expected normal SSE stream to require and emit completed terminal')
  }

  const chunkedDeltas: string[] = []
  const chunkedTerminal = `data: ${JSON.stringify({ type: 'completed', message: terminalMessage })}\n\n`
  globalThis.fetch = async () => salesAnalysisStreamResponse([
    'data: {"type":"delta","content":"分',
    '块"}\n\n',
    chunkedTerminal.slice(0, 17),
    chunkedTerminal.slice(17),
  ])
  await api.streamSalesAnalysisMessage(7, 'chunked', {
    onDelta(content) {
      chunkedDeltas.push(content)
    },
  })
  if (chunkedDeltas.join('') !== '分块') {
    throw new Error('expected SSE parser to preserve events split across chunks')
  }

  let trailingCompleted = false
  let controlledStreamError = ''
  globalThis.fetch = async () => salesAnalysisStreamResponse([
    'data: {"type":"error","message":"受控失败"}\n\n',
    `data: ${JSON.stringify({ type: 'completed', message: terminalMessage })}\n\n`,
  ])
  try {
    await api.streamSalesAnalysisMessage(7, 'error', {
      onCompleted() {
        trailingCompleted = true
      },
      onError(message) {
        controlledStreamError = message
      },
    })
  } catch (error) {
    if (!(error instanceof Error) || error.message !== '受控失败') {
      throw error
    }
  }
  if (controlledStreamError !== '受控失败' || trailingCompleted) {
    throw new Error('expected error terminal to reject or ignore trailing completed events')
  }

  globalThis.fetch = async () => salesAnalysisStreamResponse([
    'data: {"type":"delta","content":"partial"}\n\n',
  ])
  let eofWithoutTerminalRejected = false
  try {
    await api.streamSalesAnalysisMessage(7, 'interrupted', {})
  } catch (error) {
    eofWithoutTerminalRejected = (
      error instanceof Error
      && error.message.includes('未收到完成或错误事件')
    )
  }
  if (!eofWithoutTerminalRejected) {
    throw new Error('expected EOF without an explicit terminal SSE event to fail')
  }
} finally {
  globalThis.fetch = originalFetch
}

const toolResult = normalizeSalesAnalysisEvent({
  type: 'tool_result',
  toolName: 'get_product_sales_ranking',
  label: '商品销量排行',
  result: {
    unresolvedAdjustmentCount: 2,
    rows: [{ manageNumber: 'item-1', effectiveUnits: 12 }],
  },
})

if (
  toolResult.type !== 'tool_result'
  || toolResult.result.unresolvedAdjustmentCount !== 2
  || toolResult.result.rows?.[0]?.manageNumber !== 'item-1'
) {
  throw new Error('expected tool result normalization to preserve safe analysis data')
}

let invalidEventRejected = false
try {
  normalizeSalesAnalysisEvent({ type: 'internal_debug' })
} catch {
  invalidEventRejected = true
}

if (!invalidEventRejected) {
  throw new Error('expected unknown sales analysis events to be rejected')
}

const ownedStores: SalesAnalysisStore[] = [
  { id: 1, name: 'Store A', code: 'A', enabled: true },
  { id: 2, name: 'Store B', code: 'B', enabled: true },
]

if (resolveSalesAnalysisDefaultStoreId(ownedStores, null) !== null) {
  throw new Error('expected multiple enabled stores to require explicit selection')
}

if (resolveSalesAnalysisDefaultStoreId(ownedStores.slice(0, 1), null) !== 1) {
  throw new Error('expected one enabled store to remain auto-selected')
}

if (
  resolveSalesAnalysisDefaultStoreId(
    [
      ownedStores[0] as SalesAnalysisStore,
      { ...ownedStores[1] as SalesAnalysisStore, enabled: false },
    ],
    null,
  ) !== null
) {
  throw new Error('expected multiple owned stores to require explicit selection even when one is disabled')
}

if (
  resolveSalesAnalysisDefaultStoreId(
    [{ id: 3, name: 'Disabled Store', code: 'C', enabled: false }],
    null,
  ) !== 3
) {
  throw new Error('expected the only owned disabled store to remain selectable for history')
}

if (resolveSalesAnalysisDefaultStoreId(ownedStores, 2) !== 2) {
  throw new Error('expected an explicit enabled selection to survive store refresh')
}

const scopedConversation = {
  id: 3,
  title: 'Scoped',
  storeScope: [2],
} as SalesAnalysisConversation

if (resolveSalesAnalysisConversationStoreId(scopedConversation, ownedStores, 1) !== 2) {
  throw new Error('expected conversation storeScope to restore the selector')
}

if (
  resolveSalesAnalysisConversationStoreId(
    { ...scopedConversation, storeScope: [99] },
    ownedStores,
    1,
  ) !== null
) {
  throw new Error('expected unavailable scoped stores to block the scoped conversation')
}

if (!salesAnalysisConversationStoreConflict(scopedConversation, ownedStores, 1)) {
  throw new Error('expected a scoped conversation to reject another selected store')
}

if (salesAnalysisConversationStoreConflict(scopedConversation, ownedStores, 2)) {
  throw new Error('expected the scoped store selection to be accepted')
}

if (!salesAnalysisConversationStoreConflict({ ...scopedConversation, storeScope: [99] }, ownedStores, 1)) {
  throw new Error('expected unavailable scoped stores to block sending in that conversation')
}

function message(id: number): SalesAnalysisMessage {
  return {
    id,
    conversationId: 7,
    question: `question-${id}`,
    answer: `answer-${id}`,
    toolName: '',
    toolArguments: [],
    resultSummary: [],
    modelName: '',
    storeScope: [],
    statisticsWindow: {},
    status: 'completed',
    errorCode: '',
    errorMessage: '',
  }
}

const mergedMessages = mergeSalesAnalysisMessages(
  [message(51), message(52)],
  [message(1), message(2), message(51)],
)

if (mergedMessages.map((item) => item.id).join(',') !== '1,2,51,52') {
  throw new Error('expected history pages to merge without duplicates in chronological order')
}

const failedSyncState = recoverSalesAnalysisSyncStateAfterPollFailure(
  {
    id: 'sales-1',
    storeId: 1,
    status: 'running',
    alreadyRunning: true,
    initialSyncCompleted: true,
    progressCurrent: 3,
    progressTotal: 10,
    lastError: '',
  },
  '同步状态刷新失败',
)

if (
  failedSyncState?.status !== 'error'
  || failedSyncState.alreadyRunning
  || failedSyncState.lastError !== '同步状态刷新失败'
) {
  throw new Error('expected poll failure recovery to clear stale active sync state')
}

const staleQueuedState: SalesAnalysisSyncState = {
  id: 'sales-stale',
  storeId: 1,
  status: 'queued',
  alreadyRunning: false,
  initialSyncCompleted: true,
  progressCurrent: 0,
  progressTotal: 0,
  lastError: '',
}

const staleRunningState: SalesAnalysisSyncState = {
  ...staleQueuedState,
  status: 'running',
}

if (salesAnalysisSyncStateIsActive(staleQueuedState) || salesAnalysisSyncStateIsActive(staleRunningState)) {
  throw new Error('expected queued/running states with alreadyRunning false to be recoverable stale states')
}

if (!salesAnalysisSyncStateIsActive({ ...staleRunningState, alreadyRunning: true })) {
  throw new Error('expected queued/running states with alreadyRunning true to remain active')
}

if (!salesAnalysisSyncStateStaleMessage(staleQueuedState).includes('立即更新')) {
  throw new Error('expected stale sync states to explain that immediate update is recoverable')
}

const routingSuffix = salesAnalysisStoreRoutingSuffix(123)
const maxQuestion = 'x'.repeat(salesAnalysisQuestionLimit(123))
const scopedMessage = composeSalesAnalysisScopedMessage(maxQuestion, 123)
if (
  !scopedMessage.endsWith(routingSuffix)
  || scopedMessage.length !== SALES_ANALYSIS_MESSAGE_MAX_LENGTH
) {
  throw new Error('expected scoped message composition to reserve routing metadata space')
}

let oversizedQuestionRejected = false
try {
  composeSalesAnalysisScopedMessage(`${maxQuestion}x`, 123)
} catch {
  oversizedQuestionRejected = true
}

if (!oversizedQuestionRejected) {
  throw new Error('expected oversized scoped messages to be rejected before sending')
}

if (formatSalesAnalysisDateTime('2026-07-16T14:30:00+08:00') !== '2026/07/16 14:30') {
  throw new Error('expected explicit Shanghai offsets to render without local timezone drift')
}

if (formatSalesAnalysisDateTime('2026-07-16T15:30:00+09:00') !== '2026/07/16 14:30') {
  throw new Error('expected non-Shanghai explicit offsets to normalize to Shanghai display time')
}

if (formatSalesAnalysisDateTime('2026-07-16T14:30:00') !== '2026/07/16 14:30') {
  throw new Error('expected offset-less backend timestamps to be treated as backend-local display time')
}

if (
  salesAnalysisResultCompletenessWarning({ dataIncomplete: true })
  !== '该结果来自尚未完成首次销量同步的数据，分析可能不完整。'
) {
  throw new Error('expected persisted dataIncomplete metadata to render a warning')
}

if (
  salesAnalysisResultCompletenessWarning({ initialSyncCompleted: false })
  !== '该结果对应店铺尚未完成首次销量同步，分析可能不完整。'
) {
  throw new Error('expected persisted initialSyncCompleted metadata to render a warning')
}

for (const requiredMarkup of [
  'for="sales-analysis-store"',
  'aria-label="分析店铺"',
  'for="sales-analysis-question"',
  'aria-label="分析问题"',
  'aria-label="加载更早的分析记录"',
  'role="status"',
  'aria-live="polite"',
  'role="alert"',
  'recordCompletenessWarning(record.result)',
  ':maxlength="composerMaxLength"',
]) {
  if (!productSalesAnalysisViewSource.includes(requiredMarkup)) {
    throw new Error(`expected accessible sales analysis markup: ${requiredMarkup}`)
  }
}

for (const forbiddenMarkup of [
  ':disabled="!store.enabled"',
  '同步销量',
  '近 30 天概览',
  '销量前 10',
  '头部商品趋势',
  '退款退货影响',
]) {
  if (productSalesAnalysisViewSource.includes(forbiddenMarkup)) {
    throw new Error(`expected final sales analysis UI to remove stale markup: ${forbiddenMarkup}`)
  }
}

if (!productSalesAnalysisViewSource.includes('立即更新')) {
  throw new Error('expected immediate sync action text to be exactly 立即更新')
}

for (const requiredSalesAmountCopy of [
  '预估有效销售额',
  '预估有效销售额占比',
  'effectiveSalesAmountDefinition',
  '不含优惠券、折扣、退款分摊和税费分摊',
  '请新建会话后重新选择店铺',
]) {
  if (!productSalesAnalysisViewSource.includes(requiredSalesAmountCopy)) {
    throw new Error(`expected final gate 2 sales analysis copy: ${requiredSalesAmountCopy}`)
  }
}
