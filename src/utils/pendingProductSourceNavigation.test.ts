import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const shellSource = readFileSync(resolve(sourceRoot, 'components/crawler/AppShell.vue'), 'utf8')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)
const apiSource = readFileSync(resolve(sourceRoot, 'composables/useCollectorApi.ts'), 'utf8')
const permissionSource = readFileSync(resolve(sourceRoot, 'utils/permissions.ts'), 'utf8')

for (const expectedText of [
  "name: 'manual-pending-products'",
  "collectionSource: 'manual'",
  "title: '手动采集待审核'",
  "name: 'scheduled-pending-products'",
  "collectionSource: 'scheduled'",
  "title: '定时采集待审核'",
]) {
  if (!routerSource.includes(expectedText)) {
    throw new Error(`missing pending product route contract: ${expectedText}`)
  }
}

for (const expectedText of [
  "label: '手动采集待审核'",
  "label: '定时采集待审核'",
]) {
  if (!shellSource.includes(expectedText)) {
    throw new Error(`missing pending product navigation contract: ${expectedText}`)
  }
}

for (const expectedText of [
  'collectionSource?: ProductCollectionSource',
  "collectionSource: props.status === 'pending' ? props.collectionSource : undefined",
  '() => [props.status, props.collectionSource]',
]) {
  if (!workflowSource.includes(expectedText)) {
    throw new Error(`missing pending product workflow contract: ${expectedText}`)
  }
}

if (!apiSource.includes('collectionSource?: ProductCollectionSource')) {
  throw new Error('product list API must support collectionSource')
}

if (!permissionSource.includes("path: '/ltShop/wjMerchantGoodsScheduled', permission: 'products.manage'")) {
  throw new Error('scheduled pending product route must require products.manage')
}
