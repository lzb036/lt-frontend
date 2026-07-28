import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const routerSource = readFileSync(resolve(sourceRoot, 'router.ts'), 'utf8')
const shellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)
const viewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/CollectionGenreManagementView.vue'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)

for (const expectedText of [
  "const CollectionGenreManagementView = () => import(",
  "path: 'system/collection-genres'",
  "permission: 'crawler.manage'",
]) {
  if (!routerSource.includes(expectedText)) {
    throw new Error(`expected collection genre route contract: ${expectedText}`)
  }
}

if (!shellSource.includes("{ path: '/system/collection-genres', label: '采集品类', icon: Aim }")) {
  throw new Error('crawler users must see the collection genre settings navigation item')
}

for (const expectedText of [
  "defaultPolicy: 'allow'",
  "unknownGenrePolicy: 'allow'",
  "@change=\"saveConfig('defaultPolicy', $event)\"",
  "@change=\"saveConfig('unknownGenrePolicy', $event)\"",
  '继承上级',
  '允许采集',
  '禁止采集',
]) {
  if (!viewSource.includes(expectedText)) {
    throw new Error(`expected collection genre management workflow: ${expectedText}`)
  }
}

for (const endpoint of [
  '/crawler/settings/collection-genres/config',
  '/crawler/settings/collection-genres/children',
  '/crawler/settings/collection-genres/search',
  '/crawler/settings/collection-genres/rules',
]) {
  if (!apiSource.includes(endpoint)) {
    throw new Error(`missing collection genre API endpoint: ${endpoint}`)
  }
}

for (const removedText of ['保存默认策略', '扫描待审核影响']) {
  if (viewSource.includes(removedText)) {
    throw new Error(`collection genre view must not render removed action: ${removedText}`)
  }
}
