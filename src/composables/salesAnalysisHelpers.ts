import type {
  SalesAnalysisConversation,
  SalesAnalysisMessage,
  SalesAnalysisStore,
  SalesAnalysisStreamEvent,
  SalesAnalysisSyncState,
  SalesAnalysisToolResult,
} from '../types/crawler'

export const SALES_ANALYSIS_MESSAGE_MAX_LENGTH = 100_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeSalesAnalysisEvent(value: unknown): SalesAnalysisStreamEvent {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('销量分析事件格式无效')
  }
  if (value.type === 'status') {
    return { type: 'status', message: String(value.message || '') }
  }
  if (value.type === 'tool_call') {
    return {
      type: 'tool_call',
      toolName: String(value.toolName || ''),
      label: String(value.label || value.toolName || '分析工具'),
      arguments: isRecord(value.arguments) ? value.arguments : {},
    }
  }
  if (value.type === 'tool_result') {
    return {
      type: 'tool_result',
      toolName: String(value.toolName || ''),
      label: String(value.label || value.toolName || '分析结果'),
      result: isRecord(value.result) ? value.result as SalesAnalysisToolResult : {},
    }
  }
  if (value.type === 'delta') {
    return { type: 'delta', content: String(value.content || '') }
  }
  if (value.type === 'completed') {
    if (!isRecord(value.message)) {
      throw new Error('销量分析完成事件缺少消息数据')
    }
    return {
      type: 'completed',
      message: value.message as unknown as SalesAnalysisMessage,
    }
  }
  if (value.type === 'error') {
    return {
      type: 'error',
      message: String(value.message || '销量分析失败，请稍后重试。'),
    }
  }
  throw new Error('销量分析事件类型无效')
}

export function resolveSalesAnalysisDefaultStoreId(
  stores: readonly SalesAnalysisStore[],
  currentStoreId: number | null,
) {
  if (currentStoreId && stores.some((store) => store.id === currentStoreId)) {
    return currentStoreId
  }
  return stores.length === 1 ? stores[0]?.id || null : null
}

export function salesAnalysisConversationScopedStoreId(
  conversation: Pick<SalesAnalysisConversation, 'storeScope'> | null | undefined,
) {
  const scope = conversation?.storeScope || []
  return scope.length === 1 && Number.isInteger(scope[0]) && scope[0] > 0
    ? scope[0]
    : null
}

export function salesAnalysisConversationHasStoreScope(
  conversation: Pick<SalesAnalysisConversation, 'storeScope'> | null | undefined,
) {
  return Boolean(conversation?.storeScope && conversation.storeScope.length > 0)
}

export function salesAnalysisConversationStoreScopeUnavailable(
  conversation: Pick<SalesAnalysisConversation, 'storeScope'> | null | undefined,
  stores: readonly SalesAnalysisStore[],
) {
  if (!salesAnalysisConversationHasStoreScope(conversation)) {
    return false
  }
  const scopedStoreId = salesAnalysisConversationScopedStoreId(conversation)
  return scopedStoreId === null || !stores.some((store) => store.id === scopedStoreId)
}

export function resolveSalesAnalysisConversationStoreId(
  conversation: Pick<SalesAnalysisConversation, 'storeScope'> | null | undefined,
  stores: readonly SalesAnalysisStore[],
  currentStoreId: number | null,
) {
  const scopedStoreId = salesAnalysisConversationScopedStoreId(conversation)
  if (scopedStoreId !== null) {
    return stores.some((store) => store.id === scopedStoreId) ? scopedStoreId : null
  }
  if (conversation?.storeScope && conversation.storeScope.length > 0) {
    return null
  }
  return resolveSalesAnalysisDefaultStoreId(stores, currentStoreId)
}

export function salesAnalysisConversationStoreConflict(
  conversation: Pick<SalesAnalysisConversation, 'storeScope'> | null | undefined,
  stores: readonly SalesAnalysisStore[],
  selectedStoreId: number | null,
) {
  if (salesAnalysisConversationStoreScopeUnavailable(conversation, stores)) {
    return true
  }
  const scopedStoreId = salesAnalysisConversationScopedStoreId(conversation)
  if (scopedStoreId === null) {
    return false
  }
  return selectedStoreId !== scopedStoreId
}

export function mergeSalesAnalysisMessages(
  current: readonly SalesAnalysisMessage[],
  incoming: readonly SalesAnalysisMessage[],
) {
  const byId = new Map<number, SalesAnalysisMessage>()
  for (const message of [...current, ...incoming]) {
    byId.set(message.id, message)
  }
  return [...byId.values()].sort((left, right) => left.id - right.id)
}

export function recoverSalesAnalysisSyncStateAfterPollFailure<T extends {
  alreadyRunning: boolean
  lastError: string
  status: string
} | null>(
  state: T,
  message: string,
) {
  if (!state) {
    return null
  }
  return {
    ...state,
    status: 'error' as const,
    alreadyRunning: false,
    lastError: message,
  }
}

export function salesAnalysisSyncStateIsActive(
  state: Pick<SalesAnalysisSyncState, 'alreadyRunning' | 'status'> | null | undefined,
) {
  return (
    (state?.status === 'queued' || state?.status === 'running')
    && state.alreadyRunning !== false
  )
}

export function salesAnalysisSyncStateStaleMessage(
  state: Pick<SalesAnalysisSyncState, 'alreadyRunning' | 'status'> | null | undefined,
) {
  if (
    (state?.status === 'queued' || state?.status === 'running')
    && state.alreadyRunning === false
  ) {
    return '上次同步状态已恢复为可重试，请点击立即更新重新提交。'
  }
  return ''
}

export function salesAnalysisStoreRoutingSuffix(storeId: number) {
  return `\n\n店铺ID: ${storeId}`
}

export function salesAnalysisQuestionLimit(storeId: number | null) {
  if (!storeId) {
    return SALES_ANALYSIS_MESSAGE_MAX_LENGTH
  }
  return SALES_ANALYSIS_MESSAGE_MAX_LENGTH - salesAnalysisStoreRoutingSuffix(storeId).length
}

export function composeSalesAnalysisScopedMessage(question: string, storeId: number) {
  const normalizedQuestion = String(question || '').trim()
  const suffix = salesAnalysisStoreRoutingSuffix(storeId)
  const limit = SALES_ANALYSIS_MESSAGE_MAX_LENGTH - suffix.length
  if (normalizedQuestion.length > limit) {
    throw new Error(`分析问题最多 ${limit} 个字符，请缩短后再发送。`)
  }
  const message = `${normalizedQuestion}${suffix}`
  if (message.length > SALES_ANALYSIS_MESSAGE_MAX_LENGTH) {
    throw new Error('分析问题超过系统限制，请缩短后再发送。')
  }
  return message
}

function padDateTimePart(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTimeParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return `${year}/${padDateTimePart(month)}/${padDateTimePart(day)} ${padDateTimePart(hour)}:${padDateTimePart(minute)}`
}

export function formatSalesAnalysisDateTime(value?: string | null) {
  if (!value) {
    return '暂无'
  }
  const text = String(value).trim()
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:(Z)|([+-])(\d{2}):?(\d{2}))?)?$/u,
  )
  if (!match) {
    return text
  }

  const [, rawYear, rawMonth, rawDay, rawHour = '00', rawMinute = '00', rawSecond = '00', zulu, sign, rawOffsetHour, rawOffsetMinute] = match
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const second = Number(rawSecond)

  if (!zulu && !sign) {
    return formatDateTimeParts(year, month, day, hour, minute)
  }

  const offsetMinutes = zulu
    ? 0
    : (
      (sign === '-' ? -1 : 1)
      * (Number(rawOffsetHour) * 60 + Number(rawOffsetMinute))
    )
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000
  if (!Number.isFinite(utcMs)) {
    return text
  }
  const shanghai = new Date(utcMs + 8 * 60 * 60_000)
  return formatDateTimeParts(
    shanghai.getUTCFullYear(),
    shanghai.getUTCMonth() + 1,
    shanghai.getUTCDate(),
    shanghai.getUTCHours(),
    shanghai.getUTCMinutes(),
  )
}

export function salesAnalysisResultCompletenessWarning(result: SalesAnalysisToolResult) {
  if (result.dataIncomplete === true) {
    return '该结果来自尚未完成首次销量同步的数据，分析可能不完整。'
  }
  if (result.initialSyncCompleted === false) {
    return '该结果对应店铺尚未完成首次销量同步，分析可能不完整。'
  }
  return ''
}
