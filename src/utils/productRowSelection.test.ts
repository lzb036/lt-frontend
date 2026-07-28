import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const expectedText of [
  '@row-click="handleProductRowClick"',
  'toggleRowSelection(row, !selectedIds.value.includes(row.id))',
  'class-name="product-selection-column"',
  'label-class-name="product-selection-column"',
  'width="58"',
  "'.el-checkbox'",
  "'textarea'",
  "'[role=\"button\"]'",
]) {
  if (!workflowSource.includes(expectedText)) {
    throw new Error(`expected product row selection behavior: ${expectedText}`)
  }
}

if (!/\.product-selection-column \.el-checkbox__inner\)\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px;/s.test(workflowSource)) {
  throw new Error('product selection checkbox must use the enlarged 22px control')
}

if (!/\.product-selection-column \.el-checkbox__inner::after\)\s*\{[^}]*top:\s*50%;[^}]*left:\s*50%;/s.test(workflowSource)) {
  throw new Error('product selection checkmark must stay centered in the enlarged control')
}

if (!/if \(!isProductSelectable\(row\) \|\| shouldIgnoreProductRowClick\(event\.target\)\)/.test(workflowSource)) {
  throw new Error('row selection must ignore busy rows and clicks on interactive controls')
}
