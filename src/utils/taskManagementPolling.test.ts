import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewPaths = [
  'components/crawler/SyncTaskView.vue',
  'components/crawler/ManualCrawlView.vue',
  'components/crawler/AutoListingScheduleView.vue',
  'components/crawler/AutoDeletionManagementView.vue',
  'components/crawler/DeletedProductImageCleanupView.vue',
  'components/crawler/ScheduledCrawlView.vue',
  'components/crawler/SalesOrderSyncHistoryView.vue',
]

for (const relativePath of viewPaths) {
  const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8')
  if (/setInterval|progressTimer|syncProgressPolling|pollTimer|POLL_INTERVAL_MS|salesOrderSyncRunNeedsPolling/.test(source)) {
    throw new Error(`${relativePath} must not poll task data automatically`)
  }
}
