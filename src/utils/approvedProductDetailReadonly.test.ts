import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

const editableFunction = workflowSource.match(
  /function detailEditable\(\) \{([\s\S]*?)\n\}/,
)?.[1] || ''

if (!editableFunction || editableFunction.includes("'approved'")) {
  throw new Error('approved product details must not be editable')
}

for (const contract of [
  ':readonly="!detailEditable()"',
  ':disabled="!detailEditable()"',
  'v-if="selectedProductDetail && detailEditable()"',
  "ElMessage.warning('当前商品详情仅支持查看')",
]) {
  if (!workflowSource.includes(contract)) {
    throw new Error(`missing approved detail readonly contract: ${contract}`)
  }
}
