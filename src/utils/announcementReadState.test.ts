import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appSource = readFileSync(resolve(sourceRoot, 'App.vue'), 'utf8')
const shellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)
const dialogSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AnnouncementCenterDialog.vue'),
  'utf8',
)
const maintenanceSource = readFileSync(
  resolve(sourceRoot, 'composables/useMaintenance.ts'),
  'utf8',
)

for (const contract of [
  ':maintenance-active="Boolean(maintenance?.active)"',
  'onMounted(async () =>',
  'await announcementApi.hasUnreadAnnouncements()',
  'if (hasUnreadAnnouncements.value)',
  'v-if="!maintenanceActive"',
  "@unread-change=\"updateUnreadStatus\"",
  "announcement.isRead ? '已读' : '未读'",
  'void markLoadedAnnouncementsRead()',
  '/maintenance/announcements/unread',
  '/maintenance/announcements/read',
]) {
  if (
    !appSource.includes(contract)
    && !shellSource.includes(contract)
    && !dialogSource.includes(contract)
    && !maintenanceSource.includes(contract)
  ) {
    throw new Error(`missing announcement read-state contract: ${contract}`)
  }
}

if (shellSource.includes('setInterval') || shellSource.includes('watch(')) {
  throw new Error('announcement auto-open must only be checked when the app shell is entered')
}
