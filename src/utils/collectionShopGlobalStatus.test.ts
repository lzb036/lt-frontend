import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/CollectionShopView.vue'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)

for (const expectedText of [
  '全部启用',
  '全部停用',
  'updateAllScheduleStatus(true)',
  'updateAllScheduleStatus(false)',
  '不受当前筛选条件和分页影响',
  '已开始的采集任务不会被终止',
  'api.updateAllScheduleStatuses(enabled)',
]) {
  if (!viewSource.includes(expectedText)) {
    throw new Error(`missing collection-shop global status contract: ${expectedText}`)
  }
}

for (const expectedText of [
  'async function updateAllScheduleStatuses',
  "'/crawler/schedules/status/all'",
  'updateAllScheduleStatuses,',
]) {
  if (!apiSource.includes(expectedText)) {
    throw new Error(`missing collection-shop global status API contract: ${expectedText}`)
  }
}
