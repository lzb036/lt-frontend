import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/TimeManagementView.vue'),
  'utf8',
)
const apiSource = readFileSync(
  resolve(sourceRoot, 'composables/useCollectorApi.ts'),
  'utf8',
)

for (const removedText of [
  '代理流量',
  '刷新流量',
  'proxyUsage',
  'loadProxyUsage',
  'getProxyResourceUsage',
]) {
  if (viewSource.includes(removedText)) {
    throw new Error(`resource management must not display or load proxy usage: ${removedText}`)
  }
}

if (apiSource.includes('getProxyResourceUsage')) {
  throw new Error('unused proxy usage frontend API must be removed')
}
