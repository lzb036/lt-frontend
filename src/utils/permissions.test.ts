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
  "path: 'ai/product-analysis-settings'",
  "name: 'ai-product-analysis-settings'",
  "meta: { title: '商品分析设置', permission: 'ai.manage' }",
  "{ path: '/ai/product-analysis-settings', label: '商品分析设置'",
]) {
  const sources = [permissionsSource, routerSource, appShellSource]
  if (!sources.some((source) => source.includes(requiredPermissionContract))) {
    throw new Error(`expected sales analysis settings permission contract: ${requiredPermissionContract}`)
  }
}
