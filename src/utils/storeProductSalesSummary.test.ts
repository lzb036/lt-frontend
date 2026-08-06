import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)
const storeManagerSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/StoreManagerView.vue'),
  'utf8',
)
const summarySource = readFileSync(
  resolve(sourceRoot, 'components/crawler/StoreProductSalesSummary.vue'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)

for (const expectedText of [
  '<StoreProductSalesSummaryView',
  ':summary="salesSummary"',
  'period-label="近一年销量"',
  'getStoreProductSalesSummary',
  '近一年销量',
]) {
  if (!storeManagerSource.includes(expectedText)) {
    throw new Error(`missing store product sales summary wiring: ${expectedText}`)
  }
}

for (const removedText of [
  ':period-label="salesPeriodLabel"',
  'result.salesSummary',
]) {
  if (workflowSource.includes(removedText)) {
    throw new Error(`store product sales summary must not remain in product workflow: ${removedText}`)
  }
}

for (const expectedText of [
  '全部有效销量',
  '当前商品销量',
  '列表外销量',
  '当前商品',
  '列表外商品',
  '该店铺尚未完成首次订单同步',
]) {
  if (!summarySource.includes(expectedText)) {
    throw new Error(`missing store product sales summary content: ${expectedText}`)
  }
}

if (!apiSource.includes('getStoreProductSalesSummary')) {
  throw new Error('missing store product sales summary API contract')
}
