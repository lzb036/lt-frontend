import type {
  SalesOrderSyncRun,
  SalesOrderSyncRunStatus,
  SalesOrderSyncTriggerType,
} from '../types/crawler'

const TRIGGER_LABELS: Record<SalesOrderSyncTriggerType, string> = {
  automatic: '自动',
  manual: '手动',
  retry: '重试',
}

const STATUS_LABELS: Record<SalesOrderSyncRunStatus, string> = {
  queued: '排队中',
  running: '运行中',
  success: '成功',
  partial: '部分成功',
  failed: '失败',
  cancelled: '已终止',
}

export function salesOrderSyncTriggerLabel(triggerType: SalesOrderSyncTriggerType) {
  return TRIGGER_LABELS[triggerType]
}

export function salesOrderSyncStatusLabel(status: SalesOrderSyncRunStatus) {
  return STATUS_LABELS[status]
}

export function salesOrderSyncTaskName(run: SalesOrderSyncRun) {
  return `销量订单同步（${salesOrderSyncTriggerLabel(run.triggerType)}）- ${run.storeName}`
}

export function salesOrderSyncRunNeedsPolling(run: SalesOrderSyncRun) {
  return run.status === 'queued' || run.status === 'running'
}

export function canRetrySalesOrderSyncRun(run: SalesOrderSyncRun) {
  return run.status === 'failed'
    || run.status === 'partial'
    || run.status === 'cancelled'
}

export function canDeleteSalesOrderSyncRun(run: SalesOrderSyncRun) {
  return !salesOrderSyncRunNeedsPolling(run)
}

export function formatSalesOrderSyncDuration(run: SalesOrderSyncRun) {
  if (!run.startedAt || !run.finishedAt) {
    return '-'
  }
  const durationSeconds = Math.max(
    0,
    Math.floor(
      (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
        / 1000,
    ),
  )
  if (!Number.isFinite(durationSeconds)) {
    return '-'
  }
  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60
  if (!minutes) {
    return `${seconds}秒`
  }
  return `${minutes}分${seconds}秒`
}
