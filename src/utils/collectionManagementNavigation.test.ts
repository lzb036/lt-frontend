import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)
const manualSource = readFileSync(resolve(sourceRoot, 'utils/operatorManual.ts'), 'utf8')

for (const expectedText of [
  "key: 'collection-management'",
  "label: '采集管理'",
  "{ path: '/ltJobs/wjJobs', label: '手动采集', icon: Pointer }",
  "{ path: '/ltJobs/wjProductJob', label: '定时采集', icon: AlarmClock }",
  "{ path: '/ltHj/collectionShops', label: '采集店铺', icon: MapLocation }",
  "{ path: '/system/collection-genres', label: '采集品类', icon: CollectionTag }",
  "{ path: '/system/sensitive-words', label: '敏感词管理', icon: NoSmoking }",
]) {
  if (!shellSource.includes(expectedText)) {
    throw new Error(`missing collection management navigation contract: ${expectedText}`)
  }
}

const collectionGroupStart = shellSource.indexOf('const collectionChildren')
const collectionGroupEnd = shellSource.indexOf('const jobChildren', collectionGroupStart)
const collectionGroupSource = shellSource.slice(collectionGroupStart, collectionGroupEnd)
const expectedOrder = ['手动采集', '定时采集', '采集店铺', '采集品类', '敏感词管理']
let previousIndex = -1
for (const label of expectedOrder) {
  const currentIndex = collectionGroupSource.indexOf(`label: '${label}'`)
  if (currentIndex <= previousIndex) {
    throw new Error(`collection management navigation order is incorrect: ${label}`)
  }
  previousIndex = currentIndex
}

for (const expectedText of [
  "route: '采集管理 > 手动采集'",
  "route: '采集管理 > 采集店铺；采集管理 > 定时采集'",
]) {
  if (!manualSource.includes(expectedText)) {
    throw new Error(`operator manual uses stale collection navigation path: ${expectedText}`)
  }
}
