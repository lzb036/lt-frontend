import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)
const apiSource = readFileSync(resolve(sourceRoot, 'utils/api.ts'), 'utf8')

function assertMatch(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(source)) {
    throw new Error(message)
  }
}

function assertNoMatch(source: string, pattern: RegExp, message: string) {
  if (pattern.test(source)) {
    throw new Error(message)
  }
}

assertMatch(workflowSource, /import DOMPurify from 'dompurify'/, 'DOMPurify must be imported')
assertMatch(workflowSource, /DOMPurify\.sanitize/, 'DOMPurify must sanitize description HTML')
assertNoMatch(workflowSource, /new DOMParser\(\)/, 'custom DOMParser sanitizer must be removed')
assertMatch(routerSource, /const ProductWorkflowView = \(\) => import\(/, 'route views must be lazy loaded')
assertNoMatch(routerSource, /import ProductWorkflowView from/, 'route view must not be eagerly imported')
assertMatch(apiSource, /timeout:\s*60_000/, 'API client must define a timeout')

console.log('security and performance source contract tests passed')
