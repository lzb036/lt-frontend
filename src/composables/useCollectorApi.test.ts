import type {
  SalesAnalysisConversation,
  SalesAnalysisMessagePage,
  SalesAnalysisStoreList,
  SalesAnalysisStreamHandlers,
  SalesAnalysisSyncState,
} from '../types/crawler'
import {
  normalizeSalesAnalysisEvent,
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
