import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const expectedText of [
  'hideProducts(productIds)',
  'resumeActiveDeleteTaskWatchers(result.items)',
  'product.productDeleteTaskId',
  'restoreDeleteFailedProducts(failedIds)',
  'clearHiddenProducts(successIds)',
]) {
  if (!source.includes(expectedText)) {
    throw new Error(`missing store product delete visibility behavior: ${expectedText}`)
  }
}

if (!source.includes('onBeforeUnmount')) {
  throw new Error('delete task polling timers must be cleaned up when leaving the page')
}
