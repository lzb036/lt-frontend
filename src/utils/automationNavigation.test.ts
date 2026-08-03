import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appShellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const approvedSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const contract of [
  "label: '自动化管理'",
  "{ path: '/automation/auto-listing', label: '自动上架管理'",
  "{ path: '/system/time', label: '其他定时管理', icon: AlarmClock }",
  "{ path: '/system/deleted-product-images', label: '待清理图片', icon: Delete }",
  "path: 'automation/auto-listing'",
  "name: 'auto-listing-management'",
  "meta: { title: '自动上架管理', permission: 'products.manage' }",
]) {
  if (!appShellSource.includes(contract) && !routerSource.includes(contract)) {
    throw new Error(`missing automation navigation contract: ${contract}`)
  }
}

for (const removedText of [
  "{ path: '/system/time', label: '资源管理'",
  "meta: { title: '资源管理' }",
  "key: 'settings'",
  "label: '系统设置'",
  "{ path: '/system/theme', label: '主题管理'",
]) {
  if (appShellSource.includes(removedText) || routerSource.includes(removedText)) {
    throw new Error(`stale resource management navigation remains: ${removedText}`)
  }
}

for (const expectedText of [
  "label: '任务日志'",
  "path: '/system/theme'",
  "label: '主题设置'",
  "meta: { title: '主题设置' }",
]) {
  if (!appShellSource.includes(expectedText) && !routerSource.includes(expectedText)) {
    throw new Error(`missing reorganized navigation contract: ${expectedText}`)
  }
}

for (const removedApprovedEntry of [
  'AutoListingScheduleDialog',
  'autoListingScheduleVisible',
  '>自动上架<',
]) {
  if (approvedSource.includes(removedApprovedEntry)) {
    throw new Error(`approved products still contain auto-listing entry: ${removedApprovedEntry}`)
  }
}
