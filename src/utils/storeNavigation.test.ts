import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const storeViewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/StoreManagerView.vue'),
  'utf8',
)
const manualSource = readFileSync(resolve(sourceRoot, 'utils/operatorManual.ts'), 'utf8')

for (const expectedText of [
  "{ path: '/ltShop/GoodsUp', label: '店铺商品', icon: Shop }",
  "path: '/ltHj/wjMerchant'",
  "label: '店铺管理'",
  "name: 'store-manager'",
  "meta: { title: '店铺管理', permission: 'stores.manage' }",
  '<h1>店铺管理</h1>',
  "route: '商品管理 > 店铺商品'",
  "route: '店铺管理'",
]) {
  if (
    !shellSource.includes(expectedText)
    && !routerSource.includes(expectedText)
    && !storeViewSource.includes(expectedText)
    && !manualSource.includes(expectedText)
  ) {
    throw new Error(`missing store navigation contract: ${expectedText}`)
  }
}

for (const removedText of [
  "key: 'stores'",
  "{ path: '/ltHj/wjMerchant', label: '店铺信息'",
  "meta: { title: '店铺信息', permission: 'stores.manage' }",
  '<h1>店铺信息</h1>',
  "route: '店铺管理 > 店铺商品'",
  "route: '店铺管理 > 店铺信息'",
]) {
  if (
    shellSource.includes(removedText)
    || routerSource.includes(removedText)
    || storeViewSource.includes(removedText)
    || manualSource.includes(removedText)
  ) {
    throw new Error(`stale store navigation contract remains: ${removedText}`)
  }
}

const productGroupStart = shellSource.indexOf('const productChildren')
const productGroupEnd = shellSource.indexOf("key: 'rakuten-shop'", productGroupStart)
const productGroupSource = shellSource.slice(productGroupStart, productGroupEnd)
const storeProductIndex = productGroupSource.indexOf("label: '店铺商品'")
const errorProductIndex = productGroupSource.indexOf("label: '异常商品'")
if (storeProductIndex < 0 || errorProductIndex < 0 || storeProductIndex >= errorProductIndex) {
  throw new Error('store products must appear immediately before error products')
}
