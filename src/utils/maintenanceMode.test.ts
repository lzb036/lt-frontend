import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appSource = readFileSync(resolve(sourceRoot, 'App.vue'), 'utf8')
const noticeSource = readFileSync(
  resolve(sourceRoot, 'components/maintenance/MaintenanceNoticeView.vue'),
  'utf8',
)

for (const removedContract of [
  '管理员登录',
  '刷新状态',
  'maintenanceLoginVisible',
  'adminLogin',
]) {
  if (noticeSource.includes(removedContract) || appSource.includes(removedContract)) {
    throw new Error(`maintenance flow must not include: ${removedContract}`)
  }
}

for (const requiredContract of [
  'authenticated.value',
  'await fetchSession()',
  'await refreshMaintenance()',
  'if (!session.value)',
  '退出登录',
]) {
  if (!appSource.includes(requiredContract) && !noticeSource.includes(requiredContract)) {
    throw new Error(`missing maintenance flow contract: ${requiredContract}`)
  }
}

if (appSource.includes('fetchSession(),\n    fetchMaintenanceStatus()')) {
  throw new Error('maintenance status must not be fetched before login is confirmed')
}
