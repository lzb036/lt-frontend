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
  "@unread-change=\"updateUnreadStatus\"",
  "announcement.isRead ? '已读' : '未读'",
  'void markLoadedAnnouncementsRead()',
  '/maintenance/announcements/unread',
  '/maintenance/announcements/read',
  'await router.push(normalizedUrl)',
  'dialogOpen.value = false',
  "normalizedUrl.startsWith('/docs/')",
  "window.open(normalizedUrl, '_blank', 'noopener,noreferrer')",
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

for (const removedShellContract of [
  'systemVersion',
  'sidebar-system-version',
]) {
  if (shellSource.includes(removedShellContract)) {
    throw new Error(`announcement entry must not include: ${removedShellContract}`)
  }
}

for (const removedLinkContract of [
  'target="_blank"',
  ':href="activeItem.announcement.linkUrl"',
]) {
  if (dialogSource.includes(removedLinkContract)) {
    throw new Error(`internal announcement links must not include: ${removedLinkContract}`)
  }
}

if (
  !shellSource.includes('<span class="sidebar-action-label">公告</span>')
  || shellSource.indexOf('<span class="sidebar-action-label">公告</span>')
    > shellSource.indexOf('<span class="sidebar-action-label">退出登录</span>')
) {
  throw new Error('announcement entry must be displayed above logout')
}

for (const removedContract of [
  'manualPdfUrl',
  '<iframe',
  "kind: 'manual'",
  'v-if="!maintenanceActive"',
]) {
  if (dialogSource.includes(removedContract) || shellSource.includes(removedContract)) {
    throw new Error(`announcement center must not include: ${removedContract}`)
  }
}

if (shellSource.includes('setInterval') || shellSource.includes('watch(')) {
  throw new Error('announcement auto-open must only be checked when the app shell is entered')
}
