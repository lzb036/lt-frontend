import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)
const collectorApiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)

for (const expectedText of [
  'placeholder="零值筛选"',
  'label="销量为0" value="sales"',
  'label="优化次数为0" value="optimization"',
  'label="销量和优化次数为0" value="sales_and_optimization"',
  "zeroFilter: props.status === 'listed' ? filters.zeroFilter : ''",
]) {
  if (!workflowSource.includes(expectedText)) {
    throw new Error(`expected zero-value filter workflow markup: ${expectedText}`)
  }
}

if (!collectorApiSource.includes(
  "zeroFilter?: 'sales' | 'optimization' | 'sales_and_optimization' | ''",
)) {
  throw new Error('expected zeroFilter in the product list API contract')
}
