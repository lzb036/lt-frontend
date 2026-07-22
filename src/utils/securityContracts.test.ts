import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const workflowSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ProductWorkflowView.vue'),
  'utf8',
)
const loginBrandSource = readFileSync(
  resolve(sourceRoot, 'components/auth/LoginBrandVisual.vue'),
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
assertMatch(loginBrandSource, /<svg class="map-routes"/, 'login data map must use an SVG route layer')
for (const endpoint of ['82" y2="17', '91" y2="53', '75" y2="88', '10" y2="73']) {
  assertMatch(loginBrandSource, new RegExp(`x2="${endpoint}`), `missing precise map route endpoint ${endpoint}`)
}
assertNoMatch(loginBrandSource, /<span class="map-route/, 'fixed-angle map route spans must be removed')
assertMatch(loginBrandSource, /font-size: clamp\(58px, 5vw, 76px\)/, 'login brand name must remain prominent')
assertMatch(loginBrandSource, /"Microsoft YaHei", "PingFang SC"/, 'login brand must use a readable bold font stack')
assertNoMatch(loginBrandSource, /FZShuTi|STXingkai|华文行楷/, 'hard-to-read calligraphy fonts must not return')

console.log('security and performance source contract tests passed')
