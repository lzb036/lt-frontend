import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

for (const expectedText of [
  "['approved', 'listed_master', 'error'].includes(props.status)",
  'v-if="collectionSourceColumnVisible" label="采集来源" width="120"',
  "product.collectionSource === 'scheduled' ? '定时采集' : '手动采集'",
  'collectionSourceLabel(row)',
]) {
  if (!workflowSource.includes(expectedText)) {
    throw new Error(`missing product collection source column contract: ${expectedText}`)
  }
}
