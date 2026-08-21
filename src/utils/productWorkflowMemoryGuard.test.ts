import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(
  fileURLToPath(new URL('../components/crawler/ProductWorkflowView.vue', import.meta.url)),
  'utf8',
)

for (const contract of [
  'const PRODUCT_PAGE_SIZES = [30, 60, 90, 100] as const',
  'PRODUCT_PAGE_SIZES,',
]) {
  if (!source.includes(contract)) {
    throw new Error(`missing product workflow memory guard contract: ${contract}`)
  }
}

if (source.includes('[30, 60, 90, 180, 300]')) {
  throw new Error('product workflow must not expose the 180/300 page sizes')
}
