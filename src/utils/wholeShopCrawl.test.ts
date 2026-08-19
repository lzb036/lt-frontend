import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ManualCrawlView.vue'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)
const typeSource = readFileSync(resolve(sourceRoot, 'types/crawler.ts'), 'utf8')

for (const expectedText of [
  "{ label: '整店采集', value: 'whole_shop' }",
  "{ label: '全店采集', value: 'all' }",
  "{ label: '评论采集', value: 'reviewed' }",
  'label="过滤方式"',
  `v-if="form.sourceType === 'shop' || form.sourceType === 'whole_shop'" label="采集数量"`,
  `v-if="form.sourceType !== 'product_url'" label="采集价格"`,
  '<el-table-column label="过滤方式" width="120">',
  'wholeShopFilterLabel(row)',
  'label="价格选择"',
  'crawlPriceRule',
  '预采集',
  "row.sourceType !== 'whole_shop'",
  '.split(/[,，\\r\\n]+/)',
  '多个内容请使用中英文逗号隔开',
  'createTasksWithConcurrency(payloads)',
  'concurrency = 3',
  'wholeShopPreviews.length',
  'crawlPriceRule,',
]) {
  if (!viewSource.replace(/\s+/g, ' ').includes(expectedText.replace(/\s+/g, ' '))) {
    throw new Error(`missing whole-shop crawl view contract: ${expectedText}`)
  }
}

for (const removedText of [
  '新增输入框',
  'form.targets',
  'addProductInput',
  'removeProductInput',
  'ManualCrawlImportResult',
  'downloadImportTemplate',
  'openImportFilePicker',
  'handleImportFileChange',
  'manual-import-input',
  '下载模板',
  '导入表格',
]) {
  if (viewSource.includes(removedText)) {
    throw new Error(`obsolete manual-crawl multi-input contract remains: ${removedText}`)
  }
}

for (const removedText of [
  'ManualCrawlImportResult',
  'downloadManualCrawlImportTemplate',
  'importManualCrawlTasks',
]) {
  if (apiSource.includes(removedText)) {
    throw new Error(`obsolete manual-crawl spreadsheet API contract remains: ${removedText}`)
  }
}

const previewButtonIndex = viewSource.indexOf('预采集')
const createButtonIndex = viewSource.indexOf('新增采集任务', previewButtonIndex)
if (previewButtonIndex < 0 || createButtonIndex < 0 || previewButtonIndex >= createButtonIndex) {
  throw new Error('preview button must be immediately before the create-task action')
}

for (const expectedText of [
  "'whole_shop'",
  "export type WholeShopFilter = 'all' | 'reviewed'",
  'wholeShopFilter?: WholeShopFilter | null',
  'crawlPriceRule?: CrawlPriceRule | null',
  'export interface WholeShopPreview',
]) {
  if (!typeSource.includes(expectedText)) {
    throw new Error(`missing whole-shop crawl type contract: ${expectedText}`)
  }
}

for (const expectedText of [
  'async function previewWholeShopTask',
  "'/crawler/tasks/preview'",
  'crawlPriceRule?: CrawlPriceRule | null',
  'previewWholeShopTask,',
]) {
  if (!apiSource.includes(expectedText)) {
    throw new Error(`missing whole-shop preview API contract: ${expectedText}`)
  }
}
