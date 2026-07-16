<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  ChatDotRound,
  CircleClose,
  CirclePlus,
  Clock,
  DataAnalysis,
  Delete,
  Promotion,
  Refresh,
  Shop,
  TrendCharts,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import {
  composeSalesAnalysisScopedMessage,
  formatSalesAnalysisDateTime,
  mergeSalesAnalysisMessages,
  recoverSalesAnalysisSyncStateAfterPollFailure,
  resolveSalesAnalysisConversationStoreId,
  resolveSalesAnalysisDefaultStoreId,
  salesAnalysisConversationHasStoreScope,
  salesAnalysisConversationStoreScopeUnavailable,
  salesAnalysisConversationStoreConflict,
  salesAnalysisQuestionLimit,
  salesAnalysisResultCompletenessWarning,
  salesAnalysisSyncStateIsActive,
  salesAnalysisSyncStateStaleMessage,
  useCollectorApi,
} from '../../composables/useCollectorApi'
import type {
  SalesAnalysisConversation,
  SalesAnalysisMessage,
  SalesAnalysisMessagePage,
  SalesAnalysisStore,
  SalesAnalysisSyncState,
  SalesAnalysisToolRecord,
  SalesAnalysisToolResult,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

type ResultValueKind = 'text' | 'number' | 'money' | 'percent' | 'boolean'

type ResultColumn = {
  key: string
  label: string
  minWidth?: number
  width?: number
  kind?: ResultValueKind
}

type ActiveTool = {
  toolName: string
  label: string
  arguments: Record<string, unknown>
  status: 'running' | 'completed'
  result?: SalesAnalysisToolResult
}

type ActiveTurn = {
  question: string
  status: string
  answer: string
  error: string
  tools: ActiveTool[]
}

type TrendPoint = {
  key: string
  label: string
  value: number
  width: string
}

const TOOL_LABELS: Record<string, string> = {
  list_owned_stores: '店铺列表',
  get_store_sales_overview: '店铺销量概览',
  get_product_sales_ranking: '商品销量排行',
  get_product_sales_trend: '商品销量趋势',
  compare_product_sales: '商品销量对比',
  get_sku_sales_breakdown: 'SKU 销量明细',
  get_slow_moving_products: '低销量商品',
  get_sales_adjustment_summary: '销量调整汇总',
}

const RESULT_LABELS: Record<string, string> = {
  id: 'ID',
  name: '名称',
  code: '店铺编号',
  enabled: '启用',
  manageNumber: '商品管理编号',
  itemNumber: '商品编号',
  itemName: '商品名称',
  skuKey: 'SKU',
  period: '统计周期',
  orderCount: '订单数',
  orderedUnits: '下单件数',
  effectiveUnits: '有效销量',
  grossSalesAmount: '下单金额',
  effectiveSalesAmount: '预估有效销售额',
  metricValue: '指标值',
  adjustmentRate: '调整比例',
  unitShare: '销量占比',
  salesShare: '预估有效销售额占比',
  listedAt: '上架日期',
  listedDays: '上架天数',
  adjustmentType: '调整类型',
  status: '状态',
  adjustmentCount: '涉及订单',
  units: '调整件数',
  amount: '调整金额',
}

const RESULT_COLUMNS: Record<string, ResultColumn[]> = {
  list_owned_stores: [
    { key: 'name', label: '店铺名称', minWidth: 150 },
    { key: 'code', label: '店铺编号', minWidth: 130 },
    { key: 'enabled', label: '启用状态', width: 100, kind: 'boolean' },
  ],
  get_product_sales_ranking: [
    { key: 'manageNumber', label: '商品管理编号', minWidth: 150 },
    { key: 'itemNumber', label: '商品编号', minWidth: 130 },
    { key: 'itemName', label: '商品名称', minWidth: 220 },
    { key: 'skuKey', label: 'SKU', minWidth: 120 },
    { key: 'orderCount', label: '订单数', width: 90, kind: 'number' },
    { key: 'orderedUnits', label: '下单件数', width: 100, kind: 'number' },
    { key: 'effectiveUnits', label: '有效销量', width: 100, kind: 'number' },
    { key: 'grossSalesAmount', label: '下单金额', width: 120, kind: 'money' },
    { key: 'effectiveSalesAmount', label: '预估有效销售额', width: 150, kind: 'money' },
  ],
  get_product_sales_trend: [
    { key: 'period', label: '统计周期', minWidth: 130 },
    { key: 'orderedUnits', label: '下单件数', width: 100, kind: 'number' },
    { key: 'effectiveUnits', label: '有效销量', width: 100, kind: 'number' },
    { key: 'effectiveSalesAmount', label: '预估有效销售额', width: 150, kind: 'money' },
  ],
  compare_product_sales: [
    { key: 'manageNumber', label: '商品管理编号', minWidth: 150 },
    { key: 'itemName', label: '商品名称', minWidth: 220 },
    { key: 'orderedUnits', label: '下单件数', width: 100, kind: 'number' },
    { key: 'effectiveUnits', label: '有效销量', width: 100, kind: 'number' },
    { key: 'effectiveSalesAmount', label: '预估有效销售额', width: 150, kind: 'money' },
    { key: 'adjustmentRate', label: '调整比例', width: 110, kind: 'percent' },
  ],
  get_sku_sales_breakdown: [
    { key: 'skuKey', label: 'SKU', minWidth: 150 },
    { key: 'itemName', label: '商品名称', minWidth: 220 },
    { key: 'orderedUnits', label: '下单件数', width: 100, kind: 'number' },
    { key: 'effectiveUnits', label: '有效销量', width: 100, kind: 'number' },
    { key: 'effectiveSalesAmount', label: '预估有效销售额', width: 150, kind: 'money' },
    { key: 'unitShare', label: '销量占比', width: 110, kind: 'percent' },
    { key: 'salesShare', label: '预估有效销售额占比', width: 150, kind: 'percent' },
  ],
  get_slow_moving_products: [
    { key: 'manageNumber', label: '商品管理编号', minWidth: 150 },
    { key: 'itemName', label: '商品名称', minWidth: 220 },
    { key: 'listedAt', label: '上架日期', width: 120 },
    { key: 'listedDays', label: '上架天数', width: 100, kind: 'number' },
    { key: 'effectiveUnits', label: '有效销量', width: 100, kind: 'number' },
    { key: 'effectiveSalesAmount', label: '预估有效销售额', width: 150, kind: 'money' },
  ],
  get_sales_adjustment_summary: [
    { key: 'adjustmentType', label: '调整类型', minWidth: 130 },
    { key: 'status', label: '状态', width: 110 },
    { key: 'adjustmentCount', label: '涉及订单', width: 100, kind: 'number' },
    { key: 'units', label: '调整件数', width: 100, kind: 'number' },
    { key: 'amount', label: '调整金额', width: 120, kind: 'money' },
  ],
}

const OVERVIEW_METRICS = [
  { key: 'orderCount', label: '订单数', kind: 'number' as const },
  { key: 'orderedUnits', label: '下单件数', kind: 'number' as const },
  { key: 'effectiveUnits', label: '有效销量', kind: 'number' as const },
  { key: 'grossSalesAmount', label: '下单金额', kind: 'money' as const },
  { key: 'effectiveSalesAmount', label: '预估有效销售额', kind: 'money' as const },
  { key: 'canceledUnits', label: '取消件数', kind: 'number' as const },
  { key: 'refundedUnits', label: '退款件数', kind: 'number' as const },
  { key: 'returnedUnits', label: '退货件数', kind: 'number' as const },
]

const QUICK_QUESTIONS = [
  '最近 30 天销量最高的 10 个商品',
  '本月销量和上月相比怎么样',
  '最近 30 天没有销量的上架商品',
  '哪些商品退款退货最多',
  '查看某个商品最近 90 天趋势',
]

const HISTORY_PAGE_SIZE = 50
const EFFECTIVE_SALES_AMOUNT_FALLBACK_DEFINITION = (
  '预估有效销售额不含优惠券、折扣、退款分摊和税费分摊，仅用于商品分析参考。'
)

const api = useCollectorApi()
const messageStreamRef = useTemplateRef<HTMLElement>('messageStream')

const stores = shallowRef<SalesAnalysisStore[]>([])
const selectedStoreId = shallowRef<number | null>(null)
const storeListUpdatedAt = shallowRef<string | null>(null)
const storesLoading = shallowRef(false)
const syncState = shallowRef<SalesAnalysisSyncState | null>(null)
const syncLoading = shallowRef(false)

const conversations = shallowRef<SalesAnalysisConversation[]>([])
const selectedConversationId = shallowRef<number | null>(null)
const conversationsLoading = shallowRef(false)
const messages = shallowRef<SalesAnalysisMessage[]>([])
const messagesLoading = shallowRef(false)
const historyTruncated = shallowRef(false)
const historyPage = shallowRef(1)
const historyTotal = shallowRef(0)
const historyLoadingOlder = shallowRef(false)
const historyLoadError = shallowRef('')

const composer = shallowRef('')
const streaming = shallowRef(false)
const activeTurn = shallowRef<ActiveTurn | null>(null)
const streamController = shallowRef<AbortController | null>(null)
const syncPollError = shallowRef('')

let syncPollTimer: number | null = null
let messageRequestId = 0

const selectedStore = computed(() => (
  stores.value.find((store) => store.id === selectedStoreId.value) || null
))
const selectedConversation = computed(() => (
  conversations.value.find((conversation) => conversation.id === selectedConversationId.value) || null
))
const selectedConversationHasStoreScope = computed(() => (
  salesAnalysisConversationHasStoreScope(selectedConversation.value)
))
const selectedConversationStoreUnavailable = computed(() => (
  salesAnalysisConversationStoreScopeUnavailable(selectedConversation.value, stores.value)
))
const currentConversationStoreConflict = computed(() => (
  salesAnalysisConversationStoreConflict(
    selectedConversation.value,
    stores.value,
    selectedStoreId.value,
  )
))
const selectedStoreDisabled = computed(() => Boolean(selectedStore.value && !selectedStore.value.enabled))
const canSend = computed(() => Boolean(
  selectedConversation.value
  && selectedStore.value
  && composer.value.trim()
  && !streaming.value
  && !selectedConversationStoreUnavailable.value
  && !currentConversationStoreConflict.value
))
const syncIsActive = computed(() => salesAnalysisSyncStateIsActive(syncState.value))
const syncStaleMessage = computed(() => salesAnalysisSyncStateStaleMessage(syncState.value))
const syncProgress = computed(() => {
  const current = syncState.value?.progressCurrent || 0
  const total = syncState.value?.progressTotal || 0
  return total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
})
const syncStatusLabel = computed(() => {
  if (!selectedStoreId.value) return '请选择店铺'
  if (syncPollError.value) return '状态刷新失败'
  if (syncStaleMessage.value) return '可重新更新'
  const status = syncState.value?.status
  if (status === 'queued') return '等待同步'
  if (status === 'running') return '同步中'
  if (status === 'completed') return '同步完成'
  if (status === 'error') return '同步失败'
  return syncState.value?.initialSyncCompleted ? '已同步' : '尚未同步'
})
const syncStatusType = computed(() => {
  if (syncPollError.value) return 'danger'
  if (syncStaleMessage.value) return 'warning'
  const status = syncState.value?.status
  if (status === 'completed') return 'success'
  if (status === 'error') return 'danger'
  if (syncIsActive.value) return 'warning'
  return 'info'
})
const syncDisabledReason = computed(() => {
  if (!selectedStore.value) return '请先选择分析店铺'
  if (selectedStoreDisabled.value) return '店铺已停用，仍可查看历史销量分析，不能立即更新。'
  if (syncIsActive.value) return '销量更新正在执行'
  return ''
})
const canQueueSync = computed(() => Boolean(
  selectedStore.value
  && !selectedStoreDisabled.value
  && !syncIsActive.value,
))
const composerMaxLength = computed(() => salesAnalysisQuestionLimit(selectedStoreId.value))
const displayedDataUpdatedAt = computed(() => (
  selectedStore.value
    ? (
      syncState.value?.lastRemoteUpdatedAt
      || syncState.value?.lastSuccessfulSyncAt
      || storeListUpdatedAt.value
      || null
    )
    : null
))
const hasOlderMessages = computed(() => messages.value.length < historyTotal.value)
const visibleSyncError = computed(() => syncPollError.value || syncState.value?.lastError || '')
const visibleSyncNotice = computed(() => syncStaleMessage.value)
const activeToolRecords = computed<SalesAnalysisToolRecord[]>(() => (
  activeTurn.value?.tools
    .filter((tool): tool is ActiveTool & { result: SalesAnalysisToolResult } => Boolean(tool.result))
    .map((tool) => ({
      toolName: tool.toolName,
      label: tool.label,
      arguments: tool.arguments,
      result: tool.result,
    })) || []
))
const unresolvedAdjustmentCount = computed(() => {
  const historyCounts = messages.value.flatMap((message) => (
    message.resultSummary.map((record) => Number(record.result.unresolvedAdjustmentCount || 0))
  ))
  const activeCounts = activeToolRecords.value.map(
    (record) => Number(record.result.unresolvedAdjustmentCount || 0),
  )
  return Math.max(0, ...historyCounts, ...activeCounts)
})
const liveStatusText = computed(() => {
  if (activeTurn.value?.error) {
    return activeTurn.value.error
  }
  if (activeTurn.value?.status) {
    return activeTurn.value.status
  }
  const latest = messages.value[messages.value.length - 1]
  return latest ? `分析完成：${displayQuestion(latest.question)}` : ''
})

onMounted(() => {
  void initializePage()
})

watch(selectedStoreId, (storeId) => {
  stopSyncPolling()
  syncState.value = null
  syncPollError.value = ''
  if (storeId) {
    void loadSyncState(storeId)
  }
})

onBeforeRouteLeave(() => {
  cleanupAsyncWork()
})

onBeforeUnmount(() => {
  cleanupAsyncWork()
})

async function initializePage() {
  await loadStores()
  await loadInitialConversation()
}

function applySelectedConversationStoreScope(
  conversation: SalesAnalysisConversation | null = selectedConversation.value,
) {
  selectedStoreId.value = conversation
    ? resolveSalesAnalysisConversationStoreId(
      conversation,
      stores.value,
      selectedStoreId.value,
    )
    : resolveSalesAnalysisDefaultStoreId(stores.value, selectedStoreId.value)
}

async function loadStores() {
  storesLoading.value = true
  try {
    const result = await api.listSalesAnalysisStores()
    stores.value = result.stores
    storeListUpdatedAt.value = result.dataUpdatedAt || null
    applySelectedConversationStoreScope()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载可分析店铺失败'))
  } finally {
    storesLoading.value = false
  }
}

async function loadInitialConversation() {
  conversationsLoading.value = true
  try {
    let values = await api.listSalesAnalysisConversations()
    if (values.length === 0) {
      const created = await api.createSalesAnalysisConversation()
      values = [created]
    }
    conversations.value = values
    selectedConversationId.value = values[0]?.id || null
    applySelectedConversationStoreScope()
    if (selectedConversationId.value) {
      await loadMessages(selectedConversationId.value)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载分析会话失败'))
  } finally {
    conversationsLoading.value = false
  }
}

async function refreshConversationList() {
  try {
    conversations.value = await api.listSalesAnalysisConversations()
    applySelectedConversationStoreScope()
  } catch {
  }
}

async function createConversation() {
  if (streaming.value) {
    return
  }
  conversationsLoading.value = true
  try {
    const conversation = await api.createSalesAnalysisConversation()
    conversations.value = [conversation, ...conversations.value]
    selectedConversationId.value = conversation.id
    applySelectedConversationStoreScope(conversation)
    messages.value = []
    resetHistoryState()
    activeTurn.value = null
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '新建分析会话失败'))
  } finally {
    conversationsLoading.value = false
  }
}

async function selectConversation(conversationId: number) {
  if (streaming.value || conversationId === selectedConversationId.value) {
    return
  }
  selectedConversationId.value = conversationId
  applySelectedConversationStoreScope(
    conversations.value.find((conversation) => conversation.id === conversationId) || null,
  )
  activeTurn.value = null
  await loadMessages(conversationId)
}

async function deleteConversation(conversation: SalesAnalysisConversation) {
  if (streaming.value) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除会话「${conversation.title}」及其全部分析记录？`,
      '删除分析会话',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  conversationsLoading.value = true
  try {
    await api.deleteSalesAnalysisConversation(conversation.id)
    const remaining = conversations.value.filter((item) => item.id !== conversation.id)
    if (remaining.length > 0) {
      conversations.value = remaining
      if (selectedConversationId.value === conversation.id) {
        selectedConversationId.value = remaining[0]?.id || null
        applySelectedConversationStoreScope()
        if (selectedConversationId.value) {
          await loadMessages(selectedConversationId.value)
        }
      }
    } else {
      const created = await api.createSalesAnalysisConversation()
      conversations.value = [created]
      selectedConversationId.value = created.id
      applySelectedConversationStoreScope(created)
      messages.value = []
      resetHistoryState()
    }
    ElMessage.success('分析会话已删除')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '删除分析会话失败'))
  } finally {
    conversationsLoading.value = false
  }
}

async function loadMessages(conversationId: number): Promise<SalesAnalysisMessagePage | null> {
  const requestId = ++messageRequestId
  messages.value = []
  resetHistoryState()
  messagesLoading.value = true
  try {
    const page = await api.listSalesAnalysisMessages(
      conversationId,
      1,
      HISTORY_PAGE_SIZE,
    )
    if (requestId !== messageRequestId || conversationId !== selectedConversationId.value) {
      return null
    }
    messages.value = page.messages
    historyTruncated.value = page.truncated
    historyPage.value = page.page
    historyTotal.value = page.total
    await scrollMessagesToBottom()
    return page
  } catch (error) {
    if (requestId === messageRequestId) {
      ElMessage.error(toApiErrorMessage(error, '加载分析记录失败'))
    }
    return null
  } finally {
    if (requestId === messageRequestId) {
      messagesLoading.value = false
    }
  }
}

async function loadOlderMessages() {
  const conversationId = selectedConversationId.value
  if (
    !conversationId
    || historyLoadingOlder.value
    || !hasOlderMessages.value
  ) {
    return
  }
  const element = messageStreamRef.value
  const previousScrollHeight = element?.scrollHeight || 0
  const previousScrollTop = element?.scrollTop || 0
  historyLoadingOlder.value = true
  historyLoadError.value = ''
  try {
    const page = await api.listSalesAnalysisMessages(
      conversationId,
      historyPage.value + 1,
      HISTORY_PAGE_SIZE,
    )
    if (conversationId !== selectedConversationId.value) {
      return
    }
    messages.value = mergeSalesAnalysisMessages(messages.value, page.messages)
    historyPage.value = page.page
    historyTotal.value = page.total
    historyTruncated.value = historyTruncated.value || page.truncated
    await nextTick()
    if (element) {
      element.scrollTop = previousScrollTop + Math.max(
        0,
        element.scrollHeight - previousScrollHeight,
      )
    }
  } catch (error) {
    historyLoadError.value = toApiErrorMessage(error, '加载更早记录失败')
  } finally {
    historyLoadingOlder.value = false
  }
}

async function refreshLatestMessages(
  conversationId: number,
): Promise<SalesAnalysisMessagePage | null> {
  try {
    const page = await api.listSalesAnalysisMessages(
      conversationId,
      1,
      HISTORY_PAGE_SIZE,
    )
    if (conversationId !== selectedConversationId.value) {
      return null
    }
    messages.value = mergeSalesAnalysisMessages(messages.value, page.messages)
    historyTotal.value = page.total
    historyTruncated.value = historyTruncated.value || page.truncated
    await scrollMessagesToBottom()
    return page
  } catch {
    return null
  }
}

function resetHistoryState() {
  historyTruncated.value = false
  historyPage.value = 1
  historyTotal.value = 0
  historyLoadError.value = ''
  historyLoadingOlder.value = false
}

async function loadSyncState(storeId: number, silent = false) {
  if (!silent) {
    syncLoading.value = true
  }
  try {
    const state = await api.getSalesAnalysisSyncState(storeId)
    applySyncState(state)
  } catch (error) {
    const message = toApiErrorMessage(error, '销量同步状态刷新失败')
    syncPollError.value = message
    syncState.value = recoverSalesAnalysisSyncStateAfterPollFailure(
      syncState.value,
      message,
    )
    if (!silent) {
      ElMessage.error(message)
    }
  } finally {
    if (!silent) {
      syncLoading.value = false
    }
  }
}

async function queueSync() {
  const storeId = selectedStoreId.value
  if (!storeId) {
    ElMessage.warning('请先选择分析店铺')
    return
  }
  if (selectedStoreDisabled.value) {
    ElMessage.warning('店铺已停用，仍可查看历史销量分析，不能立即更新。')
    return
  }
  if (syncIsActive.value) {
    return
  }
  syncLoading.value = true
  syncPollError.value = ''
  try {
    const state = await api.queueSalesAnalysisSync(storeId)
    applySyncState(state)
    ElMessage.success(state.alreadyRunning ? '销量同步正在执行' : '销量同步任务已提交')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '提交销量同步失败'))
  } finally {
    syncLoading.value = false
  }
}

function applySyncState(state: SalesAnalysisSyncState) {
  if (state.storeId !== selectedStoreId.value) {
    return
  }
  const previousStatus = syncState.value?.status
  syncPollError.value = ''
  syncState.value = state
  stopSyncPolling()
  if (salesAnalysisSyncStateIsActive(state)) {
    syncPollTimer = window.setTimeout(() => {
      void pollSyncTask(state.id)
    }, 2000)
    return
  }
  if (
    state.status === 'completed'
    && previousStatus
    && previousStatus !== 'completed'
  ) {
    void loadStores()
  }
}

async function pollSyncTask(taskId: string) {
  try {
    const state = await api.getSalesAnalysisSyncTask(taskId)
    applySyncState(state)
  } catch (error) {
    stopSyncPolling()
    const message = toApiErrorMessage(error, '同步状态刷新失败，请手动刷新')
    syncPollError.value = message
    syncState.value = recoverSalesAnalysisSyncStateAfterPollFailure(
      syncState.value,
      message,
    )
  }
}

async function refreshSyncState() {
  const storeId = selectedStoreId.value
  if (!storeId) {
    ElMessage.warning('请先选择分析店铺')
    return
  }
  syncPollError.value = ''
  await loadSyncState(storeId)
}

function stopSyncPolling() {
  if (syncPollTimer !== null) {
    window.clearTimeout(syncPollTimer)
    syncPollTimer = null
  }
}

async function sendQuestion(questionValue?: string) {
  if (streaming.value) {
    return
  }
  const question = (questionValue ?? composer.value).trim()
  const store = selectedStore.value
  const conversationId = selectedConversationId.value
  if (!store) {
    ElMessage.warning('请先选择分析店铺')
    return
  }
  if (!conversationId) {
    ElMessage.warning('请先选择分析会话')
    return
  }
  if (currentConversationStoreConflict.value) {
    ElMessage.warning('该会话已绑定店铺上下文，请新建会话后重新选择店铺。')
    return
  }
  if (!question) {
    ElMessage.warning('请输入分析问题')
    return
  }
  let scopedQuestion = ''
  try {
    scopedQuestion = composeSalesAnalysisScopedMessage(question, store.id)
  } catch (error) {
    ElMessage.warning(toApiErrorMessage(error, '分析问题超过系统限制，请缩短后再发送。'))
    return
  }

  composer.value = ''
  activeTurn.value = {
    question,
    status: '正在连接分析服务。',
    answer: '',
    error: '',
    tools: [],
  }
  streaming.value = true
  const controller = new AbortController()
  streamController.value = controller
  let completedMessage: SalesAnalysisMessage | null = null
  await scrollMessagesToBottom()

  try {
    await api.streamSalesAnalysisMessage(
      conversationId,
      scopedQuestion,
      {
        onStatus(message) {
          updateActiveTurn({ status: message })
        },
        onToolCall(event) {
          const turn = activeTurn.value
          if (!turn) return
          updateActiveTurn({
            status: `正在执行：${event.label}`,
            tools: [
              ...turn.tools,
              {
                toolName: event.toolName,
                label: event.label,
                arguments: event.arguments,
                status: 'running',
              },
            ],
          })
        },
        onToolResult(event) {
          const turn = activeTurn.value
          if (!turn) return
          let matched = false
          const tools = turn.tools.map((tool) => {
            if (!matched && tool.toolName === event.toolName && tool.status === 'running') {
              matched = true
              return {
                ...tool,
                label: event.label,
                status: 'completed' as const,
                result: event.result,
              }
            }
            return tool
          })
          if (!matched) {
            tools.push({
              toolName: event.toolName,
              label: event.label,
              arguments: {},
              status: 'completed',
              result: event.result,
            })
          }
          updateActiveTurn({
            status: `${event.label}已完成，正在整理结论。`,
            tools,
          })
        },
        onDelta(content) {
          const turn = activeTurn.value
          if (!turn) return
          updateActiveTurn({ answer: turn.answer + content })
        },
        onCompleted(message) {
          completedMessage = message
          updateActiveTurn({ status: '分析完成。' })
        },
        onError(message) {
          updateActiveTurn({ status: '分析未完成。', error: message })
        },
      },
      controller.signal,
    )

    if (completedMessage) {
      const completed = completedMessage as SalesAnalysisMessage
      const alreadyLoaded = messages.value.some((message) => message.id === completed.id)
      messages.value = mergeSalesAnalysisMessages(messages.value, [completed])
      historyTotal.value = Math.max(
        messages.value.length,
        historyTotal.value + (alreadyLoaded ? 0 : 1),
      )
      activeTurn.value = null
      await scrollMessagesToBottom()
    } else {
      await refreshAfterInterruptedStream(conversationId, scopedQuestion)
    }
    await refreshConversationList()
  } catch (error) {
    if (!isAbortError(error)) {
      const message = toApiErrorMessage(error, '销量分析失败，请稍后重试')
      updateActiveTurn({ status: '分析未完成。', error: message })
      await refreshAfterInterruptedStream(conversationId, scopedQuestion)
      ElMessage.error(message)
    }
  } finally {
    if (streamController.value === controller) {
      streamController.value = null
    }
    streaming.value = false
  }
}

async function refreshAfterInterruptedStream(
  conversationId: number,
  scopedQuestion: string,
) {
  const page = await refreshLatestMessages(conversationId)
  const persisted = page?.messages.some((message) => message.question === scopedQuestion)
  if (persisted) {
    activeTurn.value = null
  }
}

function updateActiveTurn(patch: Partial<ActiveTurn>) {
  if (!activeTurn.value) {
    return
  }
  activeTurn.value = {
    ...activeTurn.value,
    ...patch,
  }
  void scrollMessagesToBottom()
}

function cancelCurrentAnalysis() {
  if (!streamController.value) {
    return
  }
  updateActiveTurn({
    status: '分析已停止。',
    error: activeToolRecords.value.length > 0 ? '分析已停止，已完成的工具结果仍保留。' : '',
  })
  streamController.value.abort()
}

function cleanupAsyncWork() {
  stopSyncPolling()
  streamController.value?.abort()
  streamController.value = null
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

async function scrollMessagesToBottom() {
  await nextTick()
  const element = messageStreamRef.value
  if (element) {
    element.scrollTop = element.scrollHeight
  }
}

function displayQuestion(question: string) {
  return question.replace(/\n\n店铺ID:\s*\d+\s*$/u, '').trim()
}

function displayAnswer(answer: string) {
  const prose = answer.split('【分析依据】', 1)[0]?.trim() || ''
  return prose || '结构化分析结果如下。'
}

function conversationTime(conversation: SalesAnalysisConversation) {
  return formatDateTime(
    conversation.lastMessageAt
    || conversation.updatedAt
    || conversation.createdAt,
  )
}

function formatDateTime(value?: string | null) {
  return formatSalesAnalysisDateTime(value)
}

function toolLabel(record: SalesAnalysisToolRecord) {
  return record.label || TOOL_LABELS[record.toolName] || '分析结果'
}

function resultRangeText(result: SalesAnalysisToolResult) {
  if (!result.range?.start || !result.range?.end) {
    return ''
  }
  return `${result.range.start} 至 ${result.range.end}`
}

function resultColumns(record: SalesAnalysisToolRecord): ResultColumn[] {
  const configured = RESULT_COLUMNS[record.toolName]
  if (configured) {
    return configured
  }
  const row = record.result.rows?.[0]
  if (!row) {
    return []
  }
  return Object.keys(row)
    .slice(0, 8)
    .map<ResultColumn>((key) => ({
      key,
      label: RESULT_LABELS[key] || key,
      minWidth: 120,
      kind: inferValueKind(key),
    }))
}

function inferValueKind(key: string): ResultValueKind {
  if (/amount|sales/i.test(key)) return 'money'
  if (/rate|share/i.test(key)) return 'percent'
  if (/count|units|days/i.test(key)) return 'number'
  if (/enabled/i.test(key)) return 'boolean'
  return 'text'
}

function resultRows(record: SalesAnalysisToolRecord) {
  return record.result.rows || []
}

function recordCompletenessWarning(result: SalesAnalysisToolResult) {
  return salesAnalysisResultCompletenessWarning(result)
}

function effectiveSalesAmountDefinition(result: SalesAnalysisToolResult) {
  return String(
    result.effectiveSalesAmountDefinition
    || EFFECTIVE_SALES_AMOUNT_FALLBACK_DEFINITION,
  )
}

function overviewMetrics(result: SalesAnalysisToolResult) {
  const row = result.rows?.[0] || {}
  return OVERVIEW_METRICS.map((metric) => ({
    ...metric,
    value: row[metric.key],
  }))
}

function comparisonMetrics(result: SalesAnalysisToolResult) {
  const comparison = result.comparison
  if (!comparison || typeof comparison !== 'object') {
    return []
  }
  const changes = (
    comparison.changes
    && typeof comparison.changes === 'object'
    && !Array.isArray(comparison.changes)
  )
    ? comparison.changes as Record<string, unknown>
    : {}
  return [
    { key: 'orderCount', label: '订单数环比', value: changes.orderCount },
    { key: 'effectiveUnits', label: '有效销量环比', value: changes.effectiveUnits },
    { key: 'effectiveSalesAmount', label: '预估有效销售额环比', value: changes.effectiveSalesAmount },
  ]
}

function isTrendTool(toolName: string) {
  return toolName === 'get_product_sales_trend' || toolName === 'compare_product_sales'
}

function trendPoints(result: SalesAnalysisToolResult): TrendPoint[] {
  const rows = (
    result.series?.length
      ? result.series
      : result.rows
  ) || []
  const values = rows.map((row) => numberValue(row.effectiveUnits))
  const maximum = Math.max(0, ...values)
  return rows.map((row, index) => {
    const period = String(row.period || '')
    const manageNumber = String(row.manageNumber || result.manageNumber || '')
    const value = values[index] || 0
    return {
      key: `${manageNumber}-${period}-${index}`,
      label: manageNumber ? `${period} · ${manageNumber}` : period,
      value,
      width: maximum > 0 ? `${Math.max(3, Math.round((value / maximum) * 100))}%` : '0%',
    }
  })
}

function formatResultValue(value: unknown, kind: ResultValueKind = 'text') {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  if (kind === 'money') {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(numberValue(value))
  }
  if (kind === 'percent') {
    return new Intl.NumberFormat('zh-CN', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(numberValue(value))
  }
  if (kind === 'number') {
    return new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 2,
    }).format(numberValue(value))
  }
  if (kind === 'boolean') {
    return value ? '是' : '否'
  }
  return String(value)
}

function numberValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function adjustmentTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    cancel: '取消',
    refund: '退款',
    return: '退货',
    unattributed: '未归属调整',
  }
  return labels[String(value || '')] || String(value || '-')
}

function adjustmentStatusLabel(value: unknown) {
  const labels: Record<string, string> = {
    confirmed: '已确认',
    unresolved: '未归属',
  }
  return labels[String(value || '')] || String(value || '-')
}
</script>

<template>
  <section class="page-stack analysis-page">
    <div class="page-head">
      <div>
        <p class="eyebrow">AI Management</p>
        <h1>商品分析</h1>
      </div>
      <div class="head-actions">
        <div class="store-control">
          <label class="control-label" for="sales-analysis-store">分析店铺</label>
          <el-select
            id="sales-analysis-store"
            v-model="selectedStoreId"
            class="store-select"
            aria-label="分析店铺"
            :loading="storesLoading"
            filterable
            placeholder="选择自有店铺"
            :disabled="streaming || selectedConversationHasStoreScope"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="`${store.name}（${store.code}）`"
              :value="store.id"
            >
              <span>{{ store.name }}</span>
              <span class="store-option-code">
                {{ store.enabled ? store.code : `${store.code} · 已停用` }}
              </span>
            </el-option>
          </el-select>
        </div>
        <el-tag :type="syncStatusType">
          {{ syncStatusLabel }}
        </el-tag>
        <el-tooltip
          :content="syncDisabledReason"
          placement="bottom"
          :disabled="!syncDisabledReason"
        >
          <span class="sync-button-wrap">
            <el-button
              type="primary"
              :icon="Refresh"
              :loading="syncLoading"
              :disabled="!canQueueSync"
              @click="queueSync"
            >
              立即更新
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <div
      class="visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ liveStatusText }}
    </div>

    <el-alert
      v-if="unresolvedAdjustmentCount > 0"
      class="unresolved-alert"
      type="warning"
      :closable="false"
      show-icon
    >
      <template #title>
        存在 {{ unresolvedAdjustmentCount }} 笔退款或退货调整尚未明确归属，当前有效销量未扣减这些未确认调整。
      </template>
    </el-alert>

    <el-alert
      v-if="selectedStoreDisabled"
      class="store-disabled-alert"
      title="店铺已停用，仍可查看历史销量分析，不能立即更新。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-alert
      v-if="selectedConversationStoreUnavailable"
      class="store-disabled-alert"
      title="该会话原绑定店铺当前不可用。会话店铺范围不可更改，请新建会话后重新选择店铺。"
      type="warning"
      :closable="false"
      show-icon
    />

    <el-alert
      v-if="currentConversationStoreConflict && !selectedConversationStoreUnavailable"
      class="store-disabled-alert"
      title="该会话已有店铺上下文，不能选择其他店铺，请新建会话后重新选择店铺。"
      type="warning"
      :closable="false"
      show-icon
    />

    <section class="analysis-workspace">
      <aside class="conversation-pane">
        <div class="pane-heading">
          <div class="pane-title">
            <el-icon><ChatDotRound /></el-icon>
            <span>分析会话</span>
          </div>
          <el-tooltip content="新建会话" placement="top">
            <el-button
              circle
              :icon="CirclePlus"
              :disabled="streaming"
              :loading="conversationsLoading"
              aria-label="新建会话"
              @click="createConversation"
            />
          </el-tooltip>
        </div>

        <div v-loading="conversationsLoading" class="conversation-list">
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="conversation-item"
            :class="{ 'is-active': conversation.id === selectedConversationId }"
          >
            <button
              type="button"
              class="conversation-select"
              :disabled="streaming"
              @click="selectConversation(conversation.id)"
            >
              <span class="conversation-copy">
                <strong>{{ conversation.title }}</strong>
                <small>{{ conversationTime(conversation) }}</small>
              </span>
            </button>
            <el-tooltip content="删除会话" placement="top">
              <button
                type="button"
                class="conversation-delete"
                aria-label="删除会话"
                :disabled="streaming"
                @click.stop="deleteConversation(conversation)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </el-tooltip>
          </div>
          <el-empty
            v-if="!conversationsLoading && conversations.length === 0"
            description="暂无分析会话"
            :image-size="72"
          />
        </div>
      </aside>

      <section class="chat-pane">
        <header class="chat-heading">
          <div>
            <strong>{{ selectedConversation?.title || '分析会话' }}</strong>
            <span v-if="historyTruncated">部分历史结果已截断</span>
          </div>
          <el-tag v-if="streaming" type="warning" effect="plain">分析中</el-tag>
        </header>

        <div
          ref="messageStream"
          v-loading="messagesLoading"
          class="message-stream"
          aria-live="polite"
        >
          <div
            v-if="historyTotal > 0 || historyLoadError"
            class="history-pagination"
            aria-live="polite"
          >
            <el-button
              v-if="hasOlderMessages && !historyLoadError"
              size="small"
              plain
              aria-label="加载更早的分析记录"
              :loading="historyLoadingOlder"
              @click="loadOlderMessages"
            >
              加载更早记录
            </el-button>
            <span
              v-else-if="!hasOlderMessages && historyTotal > 0"
              class="history-end"
            >
              已加载全部 {{ historyTotal }} 条记录
            </span>
            <span v-if="historyLoadError" class="history-error">
              {{ historyLoadError }}
              <el-button
                link
                type="primary"
                aria-label="重试加载更早的分析记录"
                @click="loadOlderMessages"
              >
                重试
              </el-button>
            </span>
          </div>
          <el-empty
            v-if="!messagesLoading && messages.length === 0 && !activeTurn"
            description="暂无分析记录"
            :image-size="88"
          />

          <article
            v-for="message in messages"
            :key="message.id"
            class="message-group"
          >
            <div class="user-message">
              <span class="message-role">问题</span>
              <p>{{ displayQuestion(message.question) }}</p>
            </div>
            <div class="assistant-message">
              <div class="assistant-heading">
                <span class="message-role">分析</span>
                <span>{{ formatDateTime(message.updatedAt || message.createdAt) }}</span>
              </div>
              <p
                class="assistant-answer"
                role="status"
                aria-live="polite"
              >
                {{ displayAnswer(message.answer) }}
              </p>
              <el-alert
                v-if="message.fallback"
                class="fallback-alert"
                title="模型解释未通过校验，以下展示受控工具结果。"
                type="info"
                :closable="false"
                show-icon
              />
              <div
                v-for="(record, recordIndex) in message.resultSummary"
                :key="`${message.id}-${record.toolName}-${recordIndex}`"
                class="tool-result"
              >
                <div class="tool-result-heading">
                  <div>
                    <el-icon><DataAnalysis /></el-icon>
                    <strong>{{ toolLabel(record) }}</strong>
                  </div>
                  <span>{{ resultRangeText(record.result) }}</span>
                </div>
                <div class="result-meta">
                  <span v-if="record.result.store?.name">
                    店铺：{{ record.result.store.name }}
                  </span>
                  <span v-if="record.result.dataUpdatedAt">
                    数据更新：{{ formatDateTime(record.result.dataUpdatedAt) }}
                  </span>
                  <span>
                    预估有效销售额口径：{{ effectiveSalesAmountDefinition(record.result) }}
                  </span>
                  <span>
                    说明：预估有效销售额不含优惠券、折扣、退款分摊和税费分摊。
                  </span>
                </div>
                <el-alert
                  v-if="Number(record.result.unresolvedAdjustmentCount || 0) > 0"
                  class="result-warning"
                  type="warning"
                  :closable="false"
                  show-icon
                  :title="`有 ${record.result.unresolvedAdjustmentCount} 笔未归属调整未从有效销量中扣减。`"
                />
                <el-alert
                  v-if="recordCompletenessWarning(record.result)"
                  class="result-warning"
                  type="warning"
                  :closable="false"
                  show-icon
                  :title="recordCompletenessWarning(record.result)"
                />

                <div
                  v-if="record.toolName === 'get_store_sales_overview'"
                  class="metric-grid"
                >
                  <div
                    v-for="metric in overviewMetrics(record.result)"
                    :key="metric.key"
                    class="metric-item"
                  >
                    <span>{{ metric.label }}</span>
                    <strong>{{ formatResultValue(metric.value, metric.kind) }}</strong>
                  </div>
                </div>
                <div
                  v-if="comparisonMetrics(record.result).length > 0"
                  class="comparison-strip"
                >
                  <div
                    v-for="metric in comparisonMetrics(record.result)"
                    :key="metric.key"
                  >
                    <span>{{ metric.label }}</span>
                    <strong>{{ formatResultValue(metric.value, 'percent') }}</strong>
                  </div>
                </div>

                <div
                  v-if="isTrendTool(record.toolName) && trendPoints(record.result).length > 0"
                  class="trend-panel"
                >
                  <div class="trend-title">
                    <el-icon><TrendCharts /></el-icon>
                    <span>有效销量趋势</span>
                  </div>
                  <div class="trend-list">
                    <div
                      v-for="point in trendPoints(record.result)"
                      :key="point.key"
                      class="trend-row"
                    >
                      <span class="trend-label">{{ point.label }}</span>
                      <span class="trend-track">
                        <span class="trend-fill" :style="{ width: point.width }" />
                      </span>
                      <strong>{{ formatResultValue(point.value, 'number') }}</strong>
                    </div>
                  </div>
                </div>

                <el-table
                  v-if="record.toolName !== 'get_store_sales_overview' && resultRows(record).length > 0"
                  :data="resultRows(record)"
                  size="small"
                  max-height="360"
                  class="result-table"
                >
                  <el-table-column
                    v-if="record.toolName === 'get_product_sales_ranking'"
                    type="index"
                    label="排名"
                    width="68"
                  />
                  <el-table-column
                    v-for="column in resultColumns(record)"
                    :key="column.key"
                    :prop="column.key"
                    :label="column.label"
                    :width="column.width"
                    :min-width="column.minWidth"
                    show-overflow-tooltip
                  >
                    <template #default="scope">
                      <template v-if="column.key === 'adjustmentType'">
                        {{ adjustmentTypeLabel(scope.row[column.key]) }}
                      </template>
                      <template v-else-if="column.key === 'status' && record.toolName === 'get_sales_adjustment_summary'">
                        {{ adjustmentStatusLabel(scope.row[column.key]) }}
                      </template>
                      <template v-else>
                        {{ formatResultValue(scope.row[column.key], column.kind) }}
                      </template>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </article>

          <article v-if="activeTurn" class="message-group active-message-group">
            <div class="user-message">
              <span class="message-role">问题</span>
              <p>{{ activeTurn.question }}</p>
            </div>
            <div class="assistant-message">
              <div class="assistant-heading">
                <span class="message-role">分析</span>
                <span
                  class="stream-status"
                  role="status"
                  aria-live="polite"
                >
                  {{ activeTurn.status }}
                </span>
              </div>
              <p
                v-if="activeTurn.answer"
                class="assistant-answer"
                role="status"
                aria-live="polite"
              >
                {{ displayAnswer(activeTurn.answer) }}
              </p>
              <el-alert
                v-if="activeTurn.error"
                class="fallback-alert"
                role="alert"
                :title="activeTurn.error"
                type="warning"
                :closable="false"
                show-icon
              />
              <div
                v-if="activeTurn.tools.length > 0"
                class="tool-progress-list"
                role="status"
                aria-live="polite"
              >
                <div
                  v-for="(tool, index) in activeTurn.tools"
                  :key="`${tool.toolName}-${index}`"
                  class="tool-progress-item"
                >
                  <el-icon :class="{ 'is-spinning': tool.status === 'running' }">
                    <Refresh v-if="tool.status === 'running'" />
                    <DataAnalysis v-else />
                  </el-icon>
                  <span>{{ tool.label }}</span>
                  <el-tag
                    size="small"
                    :type="tool.status === 'completed' ? 'success' : 'warning'"
                    effect="plain"
                  >
                    {{ tool.status === 'completed' ? '已完成' : '执行中' }}
                  </el-tag>
                </div>
              </div>
              <div
                v-for="(record, recordIndex) in activeToolRecords"
                :key="`active-${record.toolName}-${recordIndex}`"
                class="tool-result"
              >
                <div class="tool-result-heading">
                  <div>
                    <el-icon><DataAnalysis /></el-icon>
                    <strong>{{ toolLabel(record) }}</strong>
                  </div>
                  <span>{{ resultRangeText(record.result) }}</span>
                </div>
                <div class="result-meta">
                  <span v-if="record.result.store?.name">
                    店铺：{{ record.result.store.name }}
                  </span>
                  <span v-if="record.result.dataUpdatedAt">
                    数据更新：{{ formatDateTime(record.result.dataUpdatedAt) }}
                  </span>
                  <span>
                    预估有效销售额口径：{{ effectiveSalesAmountDefinition(record.result) }}
                  </span>
                  <span>
                    说明：预估有效销售额不含优惠券、折扣、退款分摊和税费分摊。
                  </span>
                </div>
                <el-alert
                  v-if="Number(record.result.unresolvedAdjustmentCount || 0) > 0"
                  class="result-warning"
                  type="warning"
                  :closable="false"
                  show-icon
                  :title="`有 ${record.result.unresolvedAdjustmentCount} 笔未归属调整未从有效销量中扣减。`"
                />
                <el-alert
                  v-if="recordCompletenessWarning(record.result)"
                  class="result-warning"
                  type="warning"
                  :closable="false"
                  show-icon
                  :title="recordCompletenessWarning(record.result)"
                />
                <div
                  v-if="record.toolName === 'get_store_sales_overview'"
                  class="metric-grid"
                >
                  <div
                    v-for="metric in overviewMetrics(record.result)"
                    :key="metric.key"
                    class="metric-item"
                  >
                    <span>{{ metric.label }}</span>
                    <strong>{{ formatResultValue(metric.value, metric.kind) }}</strong>
                  </div>
                </div>
                <div
                  v-if="comparisonMetrics(record.result).length > 0"
                  class="comparison-strip"
                >
                  <div
                    v-for="metric in comparisonMetrics(record.result)"
                    :key="metric.key"
                  >
                    <span>{{ metric.label }}</span>
                    <strong>{{ formatResultValue(metric.value, 'percent') }}</strong>
                  </div>
                </div>
                <div
                  v-if="isTrendTool(record.toolName) && trendPoints(record.result).length > 0"
                  class="trend-panel"
                >
                  <div class="trend-title">
                    <el-icon><TrendCharts /></el-icon>
                    <span>有效销量趋势</span>
                  </div>
                  <div class="trend-list">
                    <div
                      v-for="point in trendPoints(record.result)"
                      :key="point.key"
                      class="trend-row"
                    >
                      <span class="trend-label">{{ point.label }}</span>
                      <span class="trend-track">
                        <span class="trend-fill" :style="{ width: point.width }" />
                      </span>
                      <strong>{{ formatResultValue(point.value, 'number') }}</strong>
                    </div>
                  </div>
                </div>
                <el-table
                  v-if="record.toolName !== 'get_store_sales_overview' && resultRows(record).length > 0"
                  :data="resultRows(record)"
                  size="small"
                  max-height="300"
                  class="result-table"
                >
                  <el-table-column
                    v-if="record.toolName === 'get_product_sales_ranking'"
                    type="index"
                    label="排名"
                    width="68"
                  />
                  <el-table-column
                    v-for="column in resultColumns(record)"
                    :key="column.key"
                    :prop="column.key"
                    :label="column.label"
                    :width="column.width"
                    :min-width="column.minWidth"
                    show-overflow-tooltip
                  >
                    <template #default="scope">
                      <template v-if="column.key === 'adjustmentType'">
                        {{ adjustmentTypeLabel(scope.row[column.key]) }}
                      </template>
                      <template v-else-if="column.key === 'status' && record.toolName === 'get_sales_adjustment_summary'">
                        {{ adjustmentStatusLabel(scope.row[column.key]) }}
                      </template>
                      <template v-else>
                        {{ formatResultValue(scope.row[column.key], column.kind) }}
                      </template>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </article>
        </div>

        <footer class="composer">
          <label
            class="visually-hidden"
            for="sales-analysis-question"
          >
            分析问题
          </label>
          <el-input
            id="sales-analysis-question"
            v-model="composer"
            type="textarea"
            aria-label="分析问题"
            :rows="3"
            :maxlength="composerMaxLength"
            resize="none"
            placeholder="输入销量、销售额、排行、趋势或退款退货相关问题"
            :disabled="!selectedConversation"
          />
          <div class="composer-actions">
            <el-button
              v-if="streaming"
              :icon="CircleClose"
              type="danger"
              plain
              @click="cancelCurrentAnalysis"
            >
              停止
            </el-button>
            <el-button
              type="primary"
              :icon="Promotion"
              :disabled="!canSend"
              :loading="streaming"
              @click="sendQuestion()"
            >
              发送
            </el-button>
          </div>
        </footer>
      </section>

      <aside class="context-pane">
        <section class="context-section">
          <div class="context-title context-title-actions">
            <span>
              <el-icon><Shop /></el-icon>
              <span>数据状态</span>
            </span>
            <el-button
              link
              type="primary"
              :icon="Refresh"
              :loading="syncLoading"
              aria-label="刷新销量同步状态"
              @click="refreshSyncState"
            >
              刷新
            </el-button>
          </div>
          <dl class="data-state-list">
            <div>
              <dt>当前店铺</dt>
              <dd>{{ selectedStore?.name || '未选择' }}</dd>
            </div>
            <div>
              <dt>数据更新时间</dt>
              <dd>{{ formatDateTime(displayedDataUpdatedAt) }}</dd>
            </div>
            <div>
              <dt>上次同步</dt>
              <dd>{{ formatDateTime(syncState?.lastSuccessfulSyncAt) }}</dd>
            </div>
          </dl>
          <div v-if="syncIsActive" class="sync-progress">
            <el-progress
              :percentage="syncProgress"
              :indeterminate="!syncState?.progressTotal"
              :duration="2"
              :stroke-width="8"
            />
            <span>
              {{ syncState?.progressCurrent || 0 }} / {{ syncState?.progressTotal || '待确认' }}
            </span>
          </div>
          <el-alert
            v-if="syncState && !syncState.initialSyncCompleted && !syncIsActive"
            title="该店铺尚未完成首次销量同步。"
            type="warning"
            :closable="false"
            show-icon
          />
          <el-alert
            v-if="visibleSyncNotice"
            :title="visibleSyncNotice"
            type="warning"
            :closable="false"
            show-icon
          />
          <el-alert
            v-if="visibleSyncError"
            :title="visibleSyncError"
            type="error"
            :closable="false"
            show-icon
          />
        </section>

        <section class="context-section quick-section">
          <div class="context-title">
            <el-icon><Clock /></el-icon>
            <span>快捷问题</span>
          </div>
          <button
            v-for="item in QUICK_QUESTIONS"
            :key="item"
            type="button"
            class="quick-question"
            :disabled="streaming || !selectedConversation"
            @click="sendQuestion(item)"
          >
            <span>{{ item }}</span>
            <el-icon><Promotion /></el-icon>
          </button>
        </section>

        <section class="context-section definition-section">
          <div class="context-title">
            <el-icon><WarningFilled /></el-icon>
            <span>统计口径</span>
          </div>
          <p>有效销量 = 下单数量 - 取消数量 - 已确认退款数量 - 已确认退货数量</p>
        </section>
      </aside>
    </section>
  </section>
</template>

<style scoped>
.analysis-page {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.store-control {
  display: grid;
  gap: 4px;
}

.control-label {
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 700;
}

.store-select {
  width: min(360px, 34vw);
}

.store-option-code {
  float: right;
  margin-left: 20px;
  color: var(--text-faint);
  font-size: 12px;
}

.sync-button-wrap {
  display: inline-flex;
}

.unresolved-alert {
  border: 1px solid color-mix(in srgb, var(--warning), transparent 55%);
}

.store-disabled-alert {
  border: 1px solid var(--panel-border);
}

.analysis-workspace {
  display: grid;
  min-height: max(680px, calc(100vh - 178px));
  grid-template-columns: 232px minmax(520px, 1fr) 278px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.conversation-pane,
.context-pane,
.chat-pane {
  min-width: 0;
  min-height: 0;
}

.conversation-pane {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel-muted), var(--panel-bg) 45%);
}

.pane-heading,
.chat-heading {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid var(--panel-border);
  padding: 10px 14px;
}

.pane-title,
.context-title,
.trend-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 800;
}

.conversation-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  width: 100%;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--panel-border);
  background: transparent;
  color: var(--text-main);
  padding-right: 10px;
}

.conversation-item:hover {
  background: var(--panel-muted);
}

.conversation-item.is-active {
  box-shadow: inset 3px 0 0 var(--accent);
  background: var(--accent-soft);
}

.conversation-select {
  align-self: stretch;
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 10px 4px 10px 14px;
  text-align: left;
}

.conversation-select:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: -2px;
}

.conversation-select:disabled {
  cursor: default;
}

.conversation-copy {
  min-width: 0;
}

.conversation-copy strong,
.conversation-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-copy strong {
  font-size: 13px;
}

.conversation-copy small {
  margin-top: 5px;
  color: var(--text-faint);
  font-size: 11px;
}

.conversation-delete {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 5px;
  border: 0;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  flex: 0 0 auto;
  padding: 0;
}

.conversation-delete:hover,
.conversation-delete:focus-visible {
  background: var(--danger-soft);
  color: var(--danger);
  outline: none;
}

.conversation-delete:disabled {
  cursor: default;
  opacity: 0.45;
}

.chat-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: var(--panel-bg);
}

.chat-heading strong,
.chat-heading span {
  display: block;
}

.chat-heading strong {
  color: var(--text-main);
  font-size: 15px;
}

.chat-heading div > span {
  margin-top: 3px;
  color: var(--warning);
  font-size: 11px;
}

.message-stream {
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px 28px;
  scroll-behavior: smooth;
}

.history-pagination {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
  color: var(--text-faint);
  font-size: 12px;
}

.history-end {
  color: var(--text-faint);
}

.history-error {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--danger);
}

.message-group + .message-group {
  margin-top: 28px;
}

.user-message {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
}

.user-message p {
  max-width: min(78%, 720px);
  margin: 0;
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--text-main);
  line-height: 1.7;
  padding: 10px 13px;
  white-space: pre-wrap;
}

.message-role {
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 800;
  line-height: 24px;
}

.assistant-message {
  margin-top: 16px;
  border-left: 3px solid var(--panel-border);
  padding-left: 14px;
}

.active-message-group .assistant-message {
  border-left-color: var(--accent);
}

.assistant-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-faint);
  font-size: 11px;
}

.stream-status {
  color: var(--accent);
  font-weight: 700;
}

.assistant-answer {
  margin: 8px 0 0;
  color: var(--text-main);
  line-height: 1.75;
  white-space: pre-wrap;
}

.fallback-alert,
.result-warning {
  margin-top: 12px;
}

.tool-progress-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.tool-progress-item {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: var(--text-soft);
  font-size: 13px;
}

.is-spinning {
  animation: analysis-spin 1s linear infinite;
}

.tool-result {
  margin-top: 16px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--panel-bg), var(--panel-muted) 18%);
  overflow: hidden;
  padding: 14px;
}

.tool-result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tool-result-heading > div {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
}

.tool-result-heading > span,
.result-meta {
  color: var(--text-faint);
  font-size: 11px;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 7px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(112px, 1fr));
  gap: 1px;
  margin-top: 14px;
  border: 1px solid var(--panel-border);
  background: var(--panel-border);
}

.metric-item {
  min-width: 0;
  background: var(--panel-bg);
  padding: 11px 12px;
}

.metric-item span,
.metric-item strong {
  display: block;
}

.metric-item span {
  color: var(--text-faint);
  font-size: 11px;
}

.metric-item strong {
  margin-top: 5px;
  overflow: hidden;
  color: var(--text-main);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comparison-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.comparison-strip > div {
  border-left: 2px solid var(--accent-border);
  padding-left: 10px;
}

.comparison-strip span,
.comparison-strip strong {
  display: block;
}

.comparison-strip span {
  color: var(--text-faint);
  font-size: 11px;
}

.comparison-strip strong {
  margin-top: 3px;
  color: var(--text-main);
  font-size: 14px;
}

.trend-panel {
  margin-top: 14px;
  border-top: 1px solid var(--panel-border);
  padding-top: 12px;
}

.trend-list {
  display: grid;
  gap: 7px;
  max-height: 260px;
  margin-top: 10px;
  overflow-y: auto;
}

.trend-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 2fr) 56px;
  align-items: center;
  gap: 9px;
  font-size: 11px;
}

.trend-label {
  overflow: hidden;
  color: var(--text-soft);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trend-track {
  display: block;
  height: 8px;
  background: var(--panel-muted);
}

.trend-fill {
  display: block;
  height: 100%;
  background: var(--accent);
}

.trend-row strong {
  color: var(--text-main);
  text-align: right;
}

.result-table {
  margin-top: 14px;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  border-top: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel-bg), var(--panel-muted) 16%);
  padding: 12px 14px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.composer-actions {
  display: flex;
  gap: 8px;
}

.context-pane {
  border-left: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel-muted), var(--panel-bg) 55%);
  overflow-y: auto;
}

.context-section {
  padding: 16px;
}

.context-section + .context-section {
  border-top: 1px solid var(--panel-border);
}

.context-title-actions {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.context-title-actions > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.data-state-list {
  margin: 13px 0 0;
}

.data-state-list > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 8px;
  padding: 7px 0;
}

.data-state-list dt {
  color: var(--text-faint);
  font-size: 12px;
}

.data-state-list dd {
  margin: 0;
  overflow: hidden;
  color: var(--text-main);
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-progress {
  margin: 10px 0;
}

.sync-progress > span {
  display: block;
  margin-top: 5px;
  color: var(--text-faint);
  font-size: 11px;
  text-align: right;
}

.quick-section {
  display: grid;
  gap: 8px;
}

.quick-section .context-title {
  margin-bottom: 4px;
}

.quick-question {
  display: grid;
  width: 100%;
  min-height: 38px;
  grid-template-columns: minmax(0, 1fr) 18px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--panel-border);
  border-radius: 5px;
  background: var(--panel-bg);
  color: var(--text-soft);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 8px 10px;
  text-align: left;
}

.quick-question:hover:not(:disabled),
.quick-question:focus-visible {
  border-color: var(--accent-border);
  color: var(--accent);
  outline: none;
}

.quick-question:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.definition-section p {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 12px;
  line-height: 1.65;
}

@keyframes analysis-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1280px) {
  .analysis-workspace {
    grid-template-columns: 210px minmax(480px, 1fr) 250px;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(112px, 1fr));
  }
}

@media (max-width: 1050px) {
  .analysis-workspace {
    min-height: 0;
    grid-template-columns: 210px minmax(0, 1fr);
  }

  .context-pane {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: 1px solid var(--panel-border);
    border-left: 0;
  }

  .context-section + .context-section {
    border-top: 0;
    border-left: 1px solid var(--panel-border);
  }

  .message-stream {
    min-height: 560px;
  }
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .head-actions {
    width: 100%;
  }

  .store-select {
    width: 100%;
  }

  .store-control {
    width: 100%;
  }

  .analysis-workspace {
    display: block;
  }

  .conversation-pane {
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
  }

  .conversation-list {
    max-height: 200px;
  }

  .message-stream {
    min-height: 520px;
    padding: 14px 12px 22px;
  }

  .user-message p {
    max-width: 88%;
  }

  .composer {
    grid-template-columns: 1fr;
  }

  .composer-actions {
    justify-content: flex-end;
  }

  .context-pane {
    display: block;
  }

  .context-section + .context-section {
    border-top: 1px solid var(--panel-border);
    border-left: 0;
  }

  .metric-grid,
  .comparison-strip {
    grid-template-columns: 1fr 1fr;
  }

  .trend-row {
    grid-template-columns: minmax(100px, 1fr) minmax(90px, 1fr) 48px;
  }
}
</style>
