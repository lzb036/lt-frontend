import type {
  SalesAnalysisConversation,
  SalesAnalysisMessage,
  SalesAnalysisMessagePage,
  SalesAnalysisStore,
  SalesAnalysisStoreList,
  SalesAnalysisStreamHandlers,
  SalesAnalysisSyncState,
} from '../types/crawler'
import productSalesAnalysisViewSource from '../components/crawler/ProductSalesAnalysisView.vue?raw'
import {
  mergeSalesAnalysisMessages,
  normalizeSalesAnalysisEvent,
  recoverSalesAnalysisSyncStateAfterPollFailure,
  resolveSalesAnalysisDefaultStoreId,
  useCollectorApi,
} from './useCollectorApi'

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
  ) !== 1
) {
  throw new Error('expected disabled stores to be excluded from automatic selection')
}

if (resolveSalesAnalysisDefaultStoreId(ownedStores, 2) !== 2) {
  throw new Error('expected an explicit enabled selection to survive store refresh')
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

for (const requiredMarkup of [
  'for="sales-analysis-store"',
  'aria-label="分析店铺"',
  'for="sales-analysis-question"',
  'aria-label="分析问题"',
  'aria-label="加载更早的分析记录"',
]) {
  if (!productSalesAnalysisViewSource.includes(requiredMarkup)) {
    throw new Error(`expected accessible sales analysis markup: ${requiredMarkup}`)
  }
}
