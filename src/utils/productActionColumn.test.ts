import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const expectedText of [
  'label-class-name="table-action-header"',
  'width="176"',
  'gap: 8px;',
  'font-size: 16px;',
  'font-size: 18px;',
  'min-height: 26px;',
]) {
  if (!workflowSource.includes(expectedText)) {
    throw new Error(`expected enlarged product action column styling: ${expectedText}`)
  }
}

if (!/\.row-action-stack :deep\(\.el-button \.el-icon\)\s*\{[^}]*font-size:\s*18px;/s.test(workflowSource)) {
  throw new Error('product action icons must be enlarged')
}

if (!/\.pending-action-price\s*\{[^}]*font-size:\s*18px;[^}]*line-height:\s*1\.4;/s.test(workflowSource)) {
  throw new Error('pending product action price must be enlarged')
}
