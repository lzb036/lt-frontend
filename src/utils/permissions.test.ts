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
  "{ path: '/ai/order-sync-history', label: '订单获取记录'",
  "{ path: '/system/order-sync', label: '订单同步设置'",
]) {
  if (appShellSource.includes(removedMenuEntry)) {
    throw new Error(`expected removed AI menu entry: ${removedMenuEntry}`)
  }
}

for (const requiredContract of [
  "{ path: '/ltJobs/orderSyncHistory', label: '订单获取记录'",
  "path: 'ltJobs/orderSyncHistory'",
  "name: 'order-sync-history'",
  "meta: { title: '订单获取记录', superadminOnly: true }",
  "path: 'system/order-sync'",
  "name: 'system-order-sync'",
  "meta: { title: '订单同步设置', superadminOnly: true }",
  "redirect: '/system/time'",
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
  permissionCodes: ['stores.manage'],
}
if (canAccessRouteMeta(ordinaryStoreSession, { superadminOnly: true })) {
  throw new Error('expected ordinary users to be denied order administration pages')
}

if (!canAccessRouteMeta(ordinaryStoreSession, { title: '主题管理' })) {
  throw new Error('expected ordinary users to access personal theme settings')
}

if (canAccessRouteMeta(ordinaryStoreSession, { title: '资源管理', superadminOnly: true })) {
  throw new Error('expected ordinary users to be denied global resource settings')
}

for (const requiredContract of [
  "meta: { title: '主题管理' }",
  "meta: { title: '资源管理', superadminOnly: true }",
  "{ path: '/system/time', superadminOnly: true }",
]) {
  const sources = [permissionsSource, routerSource, appShellSource]
  if (!sources.some((source) => source.includes(requiredContract))) {
    throw new Error(`missing fixed settings visibility contract: ${requiredContract}`)
  }
}

