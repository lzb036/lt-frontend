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
  '预采集',
  "row.sourceType !== 'whole_shop'",
]) {
  if (!viewSource.replace(/\s+/g, ' ').includes(expectedText.replace(/\s+/g, ' '))) {
    throw new Error(`missing whole-shop crawl view contract: ${expectedText}`)
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
  'export interface WholeShopPreview',
]) {
  if (!typeSource.includes(expectedText)) {
    throw new Error(`missing whole-shop crawl type contract: ${expectedText}`)
  }
}

for (const expectedText of [
  'async function previewWholeShopTask',
  "'/crawler/tasks/preview'",
  'previewWholeShopTask,',
]) {
  if (!apiSource.includes(expectedText)) {
    throw new Error(`missing whole-shop preview API contract: ${expectedText}`)
  }
}
