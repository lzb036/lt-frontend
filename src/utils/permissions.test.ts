import {
  canAccessRouteMeta,
  getDefaultRoutePath,
} from './permissions.ts'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const permissionsSource = readFileSync(resolve(sourceRoot, 'utils/permissions.ts'), 'utf8')
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const appShellSource = readFileSync(resolve(sourceRoot, 'components/crawler/AppShell.vue'), 'utf8')

const aiSession = {
  role: 'operator',
  permissionCodes: ['ai.manage'],
}

if (getDefaultRoutePath(aiSession) !== '/ai/product-analysis') {
  throw new Error('expected AI-only users to enter the product analysis workspace')
}

if (!canAccessRouteMeta(aiSession, { permission: 'ai.manage' })) {
  throw new Error('expected ai.manage to allow the product analysis route')
}

if (canAccessRouteMeta({ role: 'operator', permissionCodes: [] }, { permission: 'ai.manage' })) {
  throw new Error('expected users without ai.manage to be denied')
}

for (const requiredPermissionContract of [
  "{ path: '/ai/product-analysis-settings', permission: 'ai.manage' }",
  "{ path: '/ai/order-sync-history', permission: 'ai.manage' }",
  "path: 'ai/product-analysis-settings'",
  "path: 'ai/order-sync-history'",
  "name: 'ai-product-analysis-settings'",
  "name: 'ai-order-sync-history'",
  "meta: { title: '商品分析设置', permission: 'ai.manage' }",
  "meta: { title: '订单获取记录', permission: 'ai.manage' }",
  "{ path: '/ai/product-analysis-settings', label: '商品分析设置'",
  "{ path: '/ai/order-sync-history', label: '订单获取记录'",
]) {
  const sources = [permissionsSource, routerSource, appShellSource]
  if (!sources.some((source) => source.includes(requiredPermissionContract))) {
    throw new Error(`expected sales analysis settings permission contract: ${requiredPermissionContract}`)
  }
}

const titleOptimizationMenuIndex = appShellSource.indexOf(
  "{ path: '/ai/title-optimization', label: '标题优化'",
)
const productAnalysisMenuIndex = appShellSource.indexOf(
  "{ path: '/ai/product-analysis', label: '商品分析'",
)
const productAnalysisSettingsMenuIndex = appShellSource.indexOf(
  "{ path: '/ai/product-analysis-settings', label: '商品分析设置'",
)
const orderSyncHistoryMenuIndex = appShellSource.indexOf(
  "{ path: '/ai/order-sync-history', label: '订单获取记录'",
)

if (
  titleOptimizationMenuIndex < 0
  || productAnalysisMenuIndex <= titleOptimizationMenuIndex
  || productAnalysisSettingsMenuIndex <= productAnalysisMenuIndex
  || orderSyncHistoryMenuIndex <= productAnalysisSettingsMenuIndex
) {
  throw new Error('expected AI menu order to include 订单获取记录 after 商品分析设置')
}
