import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const contract of [
  "const TASK_CONTROL_STOP_MESSAGE = '系统维护期间由超级管理员停止'",
  'function isTaskControlStopped',
  'function taskControlStoppedMessage',
  '上架任务已由全局任务管控暂停',
  '恢复本次停止任务后将继续执行未完成商品',
  'taskControlStoppedMessage([task])',
  'taskControlStoppedMessage(tasks)',
]) {
  if (!source.includes(contract)) {
    throw new Error(`missing listing task-control message contract: ${contract}`)
  }
}
