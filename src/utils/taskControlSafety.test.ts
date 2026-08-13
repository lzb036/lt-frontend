import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/SystemMaintenanceManagementView.vue'),
  'utf8',
)
const composableSource = readFileSync(
  resolve(sourceRoot, 'composables/useMaintenance.ts'),
  'utf8',
)
const typesSource = readFileSync(
  resolve(sourceRoot, 'types/crawler.ts'),
  'utf8',
)

for (const contract of [
  'taskControlDeploySafe',
  '已静默，可以部署',
  '停止不完整',
  '当前禁止部署',
  "v-if=\"!taskControlDeploySafe\"",
  "taskControlPaused ? '重新停止并检查' : '停止所选用户任务'",
  'selectedUsernames',
  'selectionLocked',
  '全选',
  '恢复本次停止任务',
  '{ usernames }',
  "{ timeout: 150_000 }",
  'deploySafe: boolean',
  "'stop_failed'",
  "'resume_failed'",
]) {
  if (
    !viewSource.includes(contract)
    && !composableSource.includes(contract)
    && !typesSource.includes(contract)
  ) {
    throw new Error(`missing task-control safety contract: ${contract}`)
  }
}

if (viewSource.includes('v-if="taskControlPaused"\n          type="primary"')) {
  throw new Error('resume button must require deploySafe, not paused alone')
}

for (const removedContract of [
  'task-count-grid',
  'task-control-summary',
  'ElMessageBox.alert',
]) {
  if (viewSource.includes(removedContract)) {
    throw new Error(`obsolete task-control UI remains: ${removedContract}`)
  }
}
