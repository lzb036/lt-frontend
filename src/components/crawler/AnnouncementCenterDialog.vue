<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { Link, Reading } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

import { useMaintenance } from '../../composables/useMaintenance'
import type { SystemAnnouncement } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { ElMessage } from 'element-plus'

type AnnouncementItem = {
  key: string
  announcement: SystemAnnouncement
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'unread-change': [value: boolean]
}>()

const api = useMaintenance()
const router = useRouter()
const loading = shallowRef(false)
const announcements = shallowRef<SystemAnnouncement[]>([])
const activeKey = shallowRef('')
const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const items = computed<AnnouncementItem[]>(() => [
  ...announcements.value.map((announcement) => ({
    key: `announcement-${announcement.id}`,
    announcement,
  })),
])
const activeItem = computed(() => (
  items.value.find((item) => item.key === activeKey.value)
  || items.value[0]
))

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void loadAnnouncements()
    }
  },
)

async function loadAnnouncements() {
  loading.value = true
  try {
    announcements.value = await api.listAnnouncements()
    emit(
      'unread-change',
      announcements.value.some((announcement) => !announcement.isRead),
    )
    if (
      activeKey.value
      && !announcements.value.some(
        (announcement) => `announcement-${announcement.id}` === activeKey.value,
      )
    ) {
      activeKey.value = announcements.value.length
        ? `announcement-${announcements.value[0].id}`
        : ''
    } else if (!activeKey.value && announcements.value.length) {
      activeKey.value = `announcement-${announcements.value[0].id}`
    }
    if (activeItem.value) {
      await markAnnouncementRead(activeItem.value.announcement.id)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载公告失败'))
  } finally {
    loading.value = false
  }
}

async function markAnnouncementRead(announcementId: number) {
  const announcement = announcements.value.find((item) => item.id === announcementId)
  if (!announcement || announcement.isRead) {
    return
  }
  try {
    const readIds = new Set(await api.markAnnouncementsRead([announcementId]))
    announcements.value = announcements.value.map((announcement) => (
      readIds.has(announcement.id)
        ? { ...announcement, isRead: true }
        : announcement
    ))
    emit(
      'unread-change',
      announcements.value.some((announcement) => !announcement.isRead),
    )
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '公告已读状态保存失败'))
  }
}

function selectItem(item: AnnouncementItem) {
  activeKey.value = item.key
  void markAnnouncementRead(item.announcement.id)
}

async function openAnnouncementLink(linkUrl: string) {
  const normalizedUrl = String(linkUrl || '').trim()
  if (!normalizedUrl) {
    return
  }
  const isInternalDocument = normalizedUrl.startsWith('/docs/')
  if (
    normalizedUrl.startsWith('/')
    && !normalizedUrl.startsWith('//')
    && !isInternalDocument
  ) {
    dialogOpen.value = false
    await router.push(normalizedUrl)
    return
  }
  window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
}

function formatDateTime(value?: string | null) {
  return value || '-'
}
</script>

<template>
  <el-dialog
    v-model="dialogOpen"
    title="公告"
    width="min(1180px, 94vw)"
    top="5vh"
    append-to-body
    destroy-on-close
    class="announcement-center-dialog"
  >
    <div v-loading="loading" class="announcement-center">
      <aside class="announcement-list">
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          class="announcement-list-item"
          :class="{
            'is-active': item.key === activeKey,
            'is-unread': !item.announcement.isRead,
          }"
          @click="selectItem(item)"
        >
          <el-icon><Reading /></el-icon>
          <span>
            {{ item.announcement.title }}
          </span>
          <span
            class="announcement-read-state"
            :class="{ 'is-unread': !item.announcement.isRead }"
          >
            {{ item.announcement.isRead ? '已读' : '未读' }}
          </span>
        </button>
      </aside>

      <main class="announcement-detail">
        <template v-if="activeItem">
          <header class="announcement-detail-head">
            <h2>{{ activeItem.announcement.title }}</h2>
            <span>{{ formatDateTime(activeItem.announcement.updatedAt) }}</span>
          </header>
          <div class="announcement-content">
            {{ activeItem.announcement.content }}
          </div>
          <div
            v-if="activeItem.announcement.linkUrl"
            class="announcement-link"
          >
            <el-button
              type="primary"
              :icon="Link"
              @click="openAnnouncementLink(activeItem.announcement.linkUrl)"
            >
              {{ activeItem.announcement.linkLabel || '查看详情' }}
            </el-button>
          </div>
          <div
            v-if="activeItem.announcement.imageUrls.length"
            class="announcement-images"
          >
            <el-image
              v-for="imageUrl in activeItem.announcement.imageUrls"
              :key="imageUrl"
              :src="imageUrl"
              :preview-src-list="activeItem.announcement.imageUrls"
              fit="contain"
              lazy
              preview-teleported
            />
          </div>
        </template>

        <el-empty v-else description="暂无公告" />
      </main>
    </div>
  </el-dialog>
</template>

<style scoped>
.announcement-center {
  height: min(760px, 78vh);
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
}

.announcement-list {
  min-width: 0;
  overflow-y: auto;
  padding: 10px;
  border-right: 1px solid var(--panel-border);
  background: var(--page-bg);
}

.announcement-list-item {
  width: 100%;
  min-height: 44px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border: 0;
  border-radius: 6px;
  color: var(--text-soft);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.announcement-list-item.is-unread {
  color: var(--text-main);
  font-weight: 800;
}

.announcement-list-item:hover,
.announcement-list-item.is-active {
  color: var(--accent);
  background: var(--panel-bg);
}

.announcement-list-item span {
  overflow-wrap: anywhere;
}

.announcement-read-state {
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 2px 5px;
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.announcement-read-state.is-unread {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
}

.announcement-detail {
  min-width: 0;
  overflow-y: auto;
  padding: 24px;
  background: var(--panel-bg);
}

.announcement-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--panel-border);
}

.announcement-detail-head h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 22px;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.announcement-detail-head > span {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 12px;
}

.announcement-content {
  padding: 22px 0;
  color: var(--text-main);
  font-size: 14px;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.announcement-images {
  display: grid;
  gap: 16px;
}

.announcement-images :deep(.el-image) {
  width: 100%;
  max-height: 680px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--page-bg);
}

.announcement-link {
  padding-bottom: 22px;
}

@media (max-width: 760px) {
  .announcement-center {
    height: 80vh;
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .announcement-list {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
  }

  .announcement-list-item {
    width: 190px;
    flex: 0 0 190px;
  }

  .announcement-detail {
    padding: 16px;
  }

  .announcement-detail-head {
    align-items: stretch;
    flex-direction: column;
  }

}
</style>
