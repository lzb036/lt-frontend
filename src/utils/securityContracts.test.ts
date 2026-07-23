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
const deletedImageCleanupSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/DeletedProductImageCleanupView.vue'),
  'utf8',
)
const apiSource = readFileSync(resolve(sourceRoot, 'utils/api.ts'), 'utf8')
const collectorApiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)
const manualResultSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ManualCrawlResultDialog.vue'),
  'utf8',
)

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
assertMatch(workflowSource, /class="product-table"[\s\S]*height="100%"/, 'product table must fill the remaining content height')
assertMatch(
  workflowSource,
  /\.page-stack\s*\{[^}]*min-height:\s*100%;[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/s,
  'product workflow must fill the available shell content height',
)
assertMatch(
  workflowSource,
  /\.work-panel\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*flex-direction:\s*column;/s,
  'product workflow panel must distribute remaining height to its table',
)
assertMatch(
  workflowSource,
  /:deep\(\.pending-action-column \.cell\)\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s,
  'pending product actions must remain visible while scrolling within a tall row',
)
assertMatch(routerSource, /const ProductWorkflowView = \(\) => import\(/, 'route views must be lazy loaded')
assertMatch(
  routerSource,
  /const DeletedProductImageCleanupView = \(\) => import\(/,
  'deleted image cleanup records view must be lazy loaded',
)
assertNoMatch(routerSource, /import ProductWorkflowView from/, 'route view must not be eagerly imported')
assertMatch(apiSource, /timeout:\s*60_000/, 'API client must define a timeout')
assertMatch(loginBrandSource, /<svg class="map-routes"/, 'login data map must use an SVG route layer')
for (const endpoint of ['82" y2="17', '91" y2="53', '75" y2="88', '10" y2="73']) {
  assertMatch(loginBrandSource, new RegExp(`x2="${endpoint}`), `missing precise map route endpoint ${endpoint}`)
}
assertNoMatch(loginBrandSource, /<span class="map-route/, 'fixed-angle map route spans must be removed')
assertMatch(loginBrandSource, /import yixinCalligraphy from '\.\.\/\.\.\/assets\/yixin-calligraphy\.png'/, 'login brand must use the supplied calligraphy artwork')
assertMatch(loginBrandSource, /class="brand-name-image"/, 'login brand calligraphy image must be rendered')
assertMatch(loginBrandSource, /width: clamp\(176px, 15vw, 230px\)/, 'login brand calligraphy must remain prominent')
assertNoMatch(loginBrandSource, /transform: rotate\(-2deg\) skewX\(-5deg\)/, 'login brand text must not be tilted')
assertNoMatch(loginBrandSource, /FZShuTi|STXingkai|华文行楷/, 'hard-to-read calligraphy fonts must not return')
assertMatch(
  deletedImageCleanupSource,
  /record\.status === 'queued'/,
  'queued image cleanup records must enable automatic progress polling',
)
assertMatch(
  deletedImageCleanupSource,
  /loadRecords\(\{ silent: true \}\)/,
  'image cleanup progress polling must refresh without blocking the table',
)
assertMatch(
  deletedImageCleanupSource,
  /onBeforeUnmount\(\(\) => \{\s*stopProgressPolling\(\)/s,
  'image cleanup progress polling must stop when leaving the page',
)
assertMatch(
  collectorApiSource,
  /taskIds:\s*taskIds\.length > 0 \? taskIds\.join\(','\) : undefined/,
  'task polling APIs must send only the requested task ids',
)
assertNoMatch(
  workflowSource,
  /api\.list(?:Listing|Sync)Tasks\(\)/,
  'product operation polling must not load complete task histories',
)
assertMatch(
  manualResultSource,
  /api\.listProductsPage\(\{/,
  'manual crawl results must use server pagination',
)
assertNoMatch(
  manualResultSource,
  /pageSize:\s*500/,
  'manual crawl results must not load a fixed 500-product batch',
)
assertMatch(
  manualResultSource,
  /本页全部上架/,
  'manual crawl result batch action must describe its page scope',
)

console.log('security and performance source contract tests passed')
