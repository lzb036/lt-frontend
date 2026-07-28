import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const expectedText of [
  '查看源店铺商品',
  '查看店铺商品页',
  'title="选择店铺商品页"',
  'v-for="link in detailListedStorePageLinks"',
  '@click="openListedStorePageDialog"',
  '@click="openSelectedListedStorePage"',
]) {
  if (!workflowSource.includes(expectedText)) {
    throw new Error(`expected listed-product detail link workflow: ${expectedText}`)
  }
}

if (!/v-if="status === 'listed_master'" class="detail-link-actions"/.test(workflowSource)) {
  throw new Error('listed master product details must expose source and store-page actions')
}

if (!/window\.open\(url, '_blank', 'noopener,noreferrer'\)/.test(workflowSource)) {
  throw new Error('selected listed-store product page must open safely in a new tab')
}
