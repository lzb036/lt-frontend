import type { SalesOrderSyncRun } from '../types/crawler'
import {
  canDeleteSalesOrderSyncRun,
  canRetrySalesOrderSyncRun,
  formatSalesOrderSyncDuration,
  salesOrderSyncRunNeedsPolling,
  salesOrderSyncStatusLabel,
  salesOrderSyncTaskName,
  salesOrderSyncTriggerLabel,
} from './salesOrderSyncHistoryState.ts'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const baseRun: SalesOrderSyncRun = {
  id: 'run-1',
  ownerUsername: 'owner',
  storeId: 7,
  storeName: '测试店铺',
  triggerType: 'automatic',
  parentRunId: null,
  status: 'success',
  initialSync: false,
  progressCurrent: 12,
  progressTotal: 12,
  totalOrderCount: 12,
  newOrderCount: 2,
  updatedOrderCount: 3,
  unchangedOrderCount: 7,
  failedOrderCount: 0,
  message: '完成',
  errorDetail: null,
  startedAt: '2026-07-17T10:00:00+08:00',
  finishedAt: '2026-07-17T10:01:05+08:00',
  createdAt: '2026-07-17T10:00:00+08:00',
  updatedAt: '2026-07-17T10:01:05+08:00',
}

if (salesOrderSyncTriggerLabel('automatic') !== '自动') {
  throw new Error('expected automatic trigger label')
}
if (salesOrderSyncTriggerLabel('manual') !== '手动') {
  throw new Error('expected manual trigger label')
}
if (salesOrderSyncTriggerLabel('retry') !== '重试') {
  throw new Error('expected retry trigger label')
}
if (salesOrderSyncStatusLabel('partial') !== '部分成功') {
  throw new Error('expected partial status label')
}
if (salesOrderSyncTaskName(baseRun) !== '销量订单同步（自动）- 测试店铺') {
  throw new Error('expected stable sales order sync task name')
}
if (formatSalesOrderSyncDuration(baseRun) !== '1分5秒') {
  throw new Error('expected completed run duration')
}

for (const status of ['failed', 'partial', 'cancelled'] as const) {
  if (!canRetrySalesOrderSyncRun({ ...baseRun, status })) {
    throw new Error(`expected ${status} runs to be retryable`)
  }
}
for (const status of ['queued', 'running'] as const) {
  const run = { ...baseRun, status }
  if (!salesOrderSyncRunNeedsPolling(run)) {
    throw new Error(`expected ${status} runs to trigger polling`)
  }
  if (canDeleteSalesOrderSyncRun(run)) {
    throw new Error(`expected ${status} runs not to be deletable`)
  }
}
if (!canDeleteSalesOrderSyncRun(baseRun)) {
  throw new Error('expected completed runs to be deletable')
}

const viewSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../components/crawler/SalesOrderSyncHistoryView.vue',
  ),
  'utf8',
)

for (const requiredMarkup of [
  '订单获取记录',
  'listSalesOrderSyncRuns',
  'retrySalesOrderSyncRun',
  'deleteSalesOrderSyncRuns',
  'getSalesOrderSyncGlobalSettings',
  'pageSize: 30',
  'POLL_INTERVAL_MS = 2_000',
  'triggerType',
  'createdAtFrom',
  'createdAtTo',
  ':selectable="canDeleteSalesOrderSyncRun"',
]) {
  if (!viewSource.includes(requiredMarkup)) {
    throw new Error(`expected order sync history workspace markup: ${requiredMarkup}`)
  }
}
