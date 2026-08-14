import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const timeManagementSource = readFileSync(
  fileURLToPath(new URL('../components/crawler/TimeManagementView.vue', import.meta.url)),
  'utf8',
)
const settingsSource = readFileSync(
  fileURLToPath(new URL('../components/crawler/SalesOrderSyncSettingsView.vue', import.meta.url)),
  'utf8',
)
const typeSource = readFileSync(
  fileURLToPath(new URL('../types/crawler.ts', import.meta.url)),
  'utf8',
)

for (const [name, source] of [
  ['TimeManagementView', timeManagementSource],
  ['SalesOrderSyncSettingsView', settingsSource],
] as const) {
  if (source.includes('v-model="orderDraft.enabled"') || source.includes('v-model="draft.enabled"')) {
    throw new Error(`${name} must not expose an order sync enabled switch`)
  }
}

if (!timeManagementSource.includes('<strong>已开启</strong>')) {
  throw new Error('time management must show order sync as always enabled')
}

const payloadBlock = typeSource.match(
  /export interface SalesOrderSyncGlobalSettingsPayload \{([\s\S]*?)\n\}/,
)?.[1] ?? ''
if (payloadBlock.includes('enabled:')) {
  throw new Error('order sync update payload must not accept enabled')
}
