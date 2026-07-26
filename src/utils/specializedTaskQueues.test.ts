import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGINATION_PREFERENCE_KEYS } from './paginationPreferenceKeys.ts'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const appShellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)
const taskViewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/SyncTaskView.vue'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)

for (const requiredContract of [
  "path: 'ltJobs/titleOptimizationJob'",
  "name: 'title-optimization-jobs'",
  "taskGroup: 'title_optimization'",
  "meta: { title: '标题优化任务', permission: 'ai.manage' }",
  "path: 'ltJobs/imageCleanupJob'",
  "name: 'image-cleanup-jobs'",
  "taskGroup: 'image_cleanup'",
  "meta: { title: '图片清理任务', superadminOnly: true }",
]) {
  if (!routerSource.includes(requiredContract)) {
    throw new Error(`missing specialized task route contract: ${requiredContract}`)
  }
}

for (const requiredContract of [
  "{ path: '/ltJobs/titleOptimizationJob', label: '标题优化任务'",
  "{ path: '/ltJobs/imageCleanupJob', label: '图片清理任务'",
]) {
  if (!appShellSource.includes(requiredContract)) {
    throw new Error(`missing specialized task menu contract: ${requiredContract}`)
  }
}

for (const requiredContract of [
  "type TaskGroup = 'sync' | 'title_optimization' | 'image_cleanup'",
  'taskGroup?: TaskGroup',
  'title?: string',
  'emptyText?: string',
  'actionLabel?: string',
  'const taskGroup = props.taskGroup',
  "v-if=\"taskGroup === 'sync'\"",
  '() => props.taskGroup',
  'loadRequestId += 1',
]) {
  if (!taskViewSource.includes(requiredContract)) {
    throw new Error(`missing reusable task view contract: ${requiredContract}`)
  }
}

if (!apiSource.includes("taskGroup?: 'sync' | 'title_optimization' | 'image_cleanup'")) {
  throw new Error('expected taskGroup to be sent by the task list API')
}

const paginationKeys = new Set<string>([
  PAGINATION_PREFERENCE_KEYS.syncTasks,
  PAGINATION_PREFERENCE_KEYS.titleOptimizationTasks,
  PAGINATION_PREFERENCE_KEYS.imageCleanupTasks,
])
if (paginationKeys.size !== 3) {
  throw new Error('expected all task pages to persist pagination independently')
}
