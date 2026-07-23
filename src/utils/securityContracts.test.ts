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
assertMatch(workflowSource, /row-key="id"/, 'large product tables must keep stable row identity')
assertMatch(workflowSource, /new WeakMap<ProductItem, string\[\]>\(\)/, 'product image URL lists must be cached')
assertMatch(workflowSource, /class="pending-image-checkbox"/, 'pending image selection must use a lightweight native checkbox')
assertMatch(workflowSource, /class="pending-image-action pending-image-action-edit"/, 'pending image actions must use lightweight native buttons')
assertMatch(workflowSource, /<img\s+class="pending-product-image"/, 'pending product images must use lightweight native images')
assertNoMatch(workflowSource, /<el-image\s+class="pending-product-image"/, 'pending product images must not create an image component per image')
assertMatch(workflowSource, /<ElImageViewer/, 'pending product images must share one image viewer')
assertMatch(workflowSource, /<textarea\s+class="pending-title-input"/, 'pending product title editing must use a native textarea')
assertMatch(workflowSource, /<textarea\s+class="pending-tagline-input"/, 'pending product tagline editing must use a native textarea')
assertMatch(routerSource, /const ProductWorkflowView = \(\) => import\(/, 'route views must be lazy loaded')
assertNoMatch(routerSource, /import ProductWorkflowView from/, 'route view must not be eagerly imported')
assertMatch(apiSource, /timeout:\s*60_000/, 'API client must define a timeout')
assertMatch(loginBrandSource, /<svg class="map-routes"/, 'login data map must use an SVG route layer')
for (const endpoint of ['82" y2="17', '91" y2="53', '75" y2="88', '10" y2="73']) {
  assertMatch(loginBrandSource, new RegExp(`x2="${endpoint}`), `missing precise map route endpoint ${endpoint}`)
}
assertNoMatch(loginBrandSource, /<span class="map-route/, 'fixed-angle map route spans must be removed')
assertMatch(loginBrandSource, /font-size: clamp\(62px, 5\.2vw, 78px\)/, 'login brand name must remain prominent')
assertMatch(loginBrandSource, /"STKaiti", "KaiTi", "Kaiti SC"/, 'login brand must use a readable handwritten font stack')
assertMatch(loginBrandSource, /transform: scaleX\(1\.03\)/, 'login brand text must remain horizontally aligned')
assertNoMatch(loginBrandSource, /transform: rotate\(-2deg\) skewX\(-5deg\)/, 'login brand text must not be tilted')
assertNoMatch(loginBrandSource, /FZShuTi|STXingkai|华文行楷/, 'hard-to-read calligraphy fonts must not return')

console.log('security and performance source contract tests passed')
