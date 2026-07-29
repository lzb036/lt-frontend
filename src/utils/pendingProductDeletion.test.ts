import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)

function functionSource(name: string, nextName: string) {
  const start = source.indexOf(`async function ${name}`)
  const end = source.indexOf(`\n${nextName}`, start)
  if (start < 0 || end < 0) {
    throw new Error(`unable to locate function block: ${name}`)
  }
  return source.slice(start, end)
}

const removeProductsSource = functionSource('removeProducts', 'async function removeSelected')
if (!removeProductsSource.includes("if (props.status !== 'pending')")) {
  throw new Error('pending product deletion must bypass the confirmation branch')
}
if (!removeProductsSource.includes('await ElMessageBox.confirm')) {
  throw new Error('non-pending product deletion must keep its confirmation')
}

for (const [name, nextName] of [
  ['deleteSelectedPendingImages', 'function compactText'],
  ['deleteDetailImage', 'async function editDetailImageWithMeitu'],
]) {
  const block = functionSource(name, nextName)
  if (block.includes('ElMessageBox.confirm')) {
    throw new Error(`${name} must delete pending product images without confirmation`)
  }
}
