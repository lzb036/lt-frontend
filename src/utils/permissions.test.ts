import {
  canAccessRouteMeta,
  getDefaultRoutePath,
} from './permissions.ts'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const permissionsSource = readFileSync(
  resolve(sourceRoot, 'utils/permissions.ts'),
  'utf8',
)
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const appShellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)

const aiSession = {
  role: 'operator',
  permissionCodes: ['ai.manage'],
}

if (getDefaultRoutePath(aiSession) !== '/ai/title-optimization') {
  throw new Error('expected AI-only users to enter title optimization')
}

if (!canAccessRouteMeta(aiSession, { permission: 'ai.manage' })) {
  throw new Error('expected ai.manage to allow title optimization')
}

for (const removedMenuEntry of [
  "{ path: '/ai/product-analysis', label: '商品分析'",
  "{ path: '/ai/product-analysis-settings', label: '商品分析设置'",
  "{ path: '/ai/order-sync-history', label: '订单获取记录'",
]) {
  if (appShellSource.includes(removedMenuEntry)) {
    throw new Error(`expected removed AI menu entry: ${removedMenuEntry}`)
  }
}

for (const requiredContract of [
  "{ path: '/ltJobs/orderSyncHistory', label: '订单获取记录'",
  "{ path: '/system/order-sync', label: '订单同步设置'",
  "path: 'ltJobs/orderSyncHistory'",
  "name: 'order-sync-history'",
  "meta: { title: '订单获取记录', superadminOnly: true }",
  "path: 'system/order-sync'",
  "name: 'system-order-sync'",
  "meta: { title: '订单同步设置', superadminOnly: true }",
  "{ path: '/ltJobs/orderSyncHistory', superadminOnly: true }",
  "{ path: '/system/order-sync', superadminOnly: true }",
]) {
  const sources = [permissionsSource, routerSource, appShellSource]
  if (!sources.some((source) => source.includes(requiredContract))) {
    throw new Error(`missing relocated order feature contract: ${requiredContract}`)
  }
}

const ordinaryStoreSession = {
  role: 'operator',
  permissionCodes: ['stores.manage', 'settings.manage'],
}
if (canAccessRouteMeta(ordinaryStoreSession, { superadminOnly: true })) {
  throw new Error('expected ordinary users to be denied order administration pages')
}

for (const legacyRedirect of [
  "{ path: 'ai/product-analysis', redirect: '/ltShop/GoodsUp' }",
  "{ path: 'ai/product-analysis-settings', redirect: '/system/order-sync' }",
  "{ path: 'ai/order-sync-history', redirect: '/ltJobs/orderSyncHistory' }",
]) {
  if (!routerSource.includes(legacyRedirect)) {
    throw new Error(`missing legacy redirect: ${legacyRedirect}`)
  }
}
