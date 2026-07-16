import type {
  SalesAnalysisConversation,
  SalesAnalysisMessage,
  SalesAnalysisMessagePage,
  SalesAnalysisStore,
  SalesAnalysisStoreList,
  SalesAnalysisStreamHandlers,
  SalesAnalysisSyncState,
} from '../types/crawler'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SALES_ANALYSIS_MESSAGE_MAX_LENGTH,
  composeSalesAnalysisScopedMessage,
  formatSalesAnalysisDateTime,
  mergeSalesAnalysisMessages,
  normalizeSalesAnalysisEvent,
  recoverSalesAnalysisSyncStateAfterPollFailure,
  resolveSalesAnalysisConversationStoreId,
  resolveSalesAnalysisDefaultStoreId,
  salesAnalysisConversationStoreConflict,
  salesAnalysisQuestionLimit,
  salesAnalysisResultCompletenessWarning,
  salesAnalysisStoreRoutingSuffix,
} from './salesAnalysisHelpers.ts'
import type { useCollectorApi } from './useCollectorApi.ts'

const productSalesAnalysisViewSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../components/crawler/ProductSalesAnalysisView.vue',
  ),
  'utf8',
)

const api = {} as ReturnType<typeof useCollectorApi>

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
  throw new Error('expected unavailable scoped stores to require an explicit choice')
}

if (!salesAnalysisConversationStoreConflict(scopedConversation, ownedStores, 1)) {
  throw new Error('expected a scoped conversation to reject another selected store')
}

if (salesAnalysisConversationStoreConflict(scopedConversation, ownedStores, 2)) {
  throw new Error('expected the scoped store selection to be accepted')
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

for (const quickQuestion of [
  '最近 30 天销量最高的 10 个商品',
  '本月销量和上月相比怎么样',
  '最近 30 天没有销量的上架商品',
  '哪些商品退款退货最多',
  '查看某个商品最近 90 天趋势',
]) {
  if (!productSalesAnalysisViewSource.includes(quickQuestion)) {
    throw new Error(`expected exact quick question: ${quickQuestion}`)
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
