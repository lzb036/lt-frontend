<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { Download, FullScreen, Reading } from '@element-plus/icons-vue'

import { useMaintenance } from '../../composables/useMaintenance'
import type { AuthSession, SystemAnnouncement } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { ElMessage } from 'element-plus'

type AnnouncementItem =
  | { kind: 'announcement'; key: string; announcement: SystemAnnouncement }
  | { kind: 'manual'; key: 'manual'; title: string }

const props = defineProps<{
  modelValue: boolean
  session: AuthSession | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const api = useMaintenance()
const loading = shallowRef(false)
const announcements = shallowRef<SystemAnnouncement[]>([])
const activeKey = shallowRef('manual')
const manualPdfUrl = '/docs/product-collection-system-manual.pdf?v=20260720-2220'
const canDownload = computed(() => props.session?.role === 'superadmin')
const manualPdfEmbedUrl = computed(() => (
  `${manualPdfUrl}#view=FitH&toolbar=${canDownload.value ? '1' : '0'}&navpanes=0`
))
const dialogOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const items = computed<AnnouncementItem[]>(() => [
  ...announcements.value.map((announcement) => ({
    kind: 'announcement' as const,
    key: `announcement-${announcement.id}`,
    announcement,
  })),
  { kind: 'manual' as const, key: 'manual' as const, title: '使用手册' },
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
    if (
      activeKey.value !== 'manual'
      && !announcements.value.some(
        (announcement) => `announcement-${announcement.id}` === activeKey.value,
      )
    ) {
      activeKey.value = announcements.value.length
        ? `announcement-${announcements.value[0].id}`
        : 'manual'
    } else if (activeKey.value === 'manual' && announcements.value.length) {
      activeKey.value = `announcement-${announcements.value[0].id}`
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载公告失败'))
  } finally {
    loading.value = false
  }
}

function selectItem(item: AnnouncementItem) {
  activeKey.value = item.key
}

function openPdfManual() {
  window.open(manualPdfEmbedUrl.value, '_blank', 'noopener,noreferrer')
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
          :class="{ 'is-active': item.key === activeKey }"
          @click="selectItem(item)"
        >
          <el-icon><Reading /></el-icon>
          <span>
            {{
              item.kind === 'manual'
                ? item.title
                : item.announcement.title
            }}
          </span>
        </button>
      </aside>

      <main class="announcement-detail">
        <template v-if="activeItem?.kind === 'announcement'">
          <header class="announcement-detail-head">
            <h2>{{ activeItem.announcement.title }}</h2>
            <span>{{ formatDateTime(activeItem.announcement.updatedAt) }}</span>
          </header>
          <div class="announcement-content">
            {{ activeItem.announcement.content }}
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

        <template v-else>
          <header class="announcement-detail-head manual-head">
            <h2>使用手册</h2>
            <div class="manual-actions">
              <el-button :icon="FullScreen" @click="openPdfManual">
                新窗口查看
              </el-button>
              <el-button
                v-if="canDownload"
                type="primary"
                :icon="Download"
                tag="a"
                :href="manualPdfUrl"
                download="商品采集系统完整界面功能手册.pdf"
              >
                下载PDF
              </el-button>
            </div>
          </header>
          <iframe
            class="manual-frame"
            :src="manualPdfEmbedUrl"
            title="商品采集系统完整界面功能手册"
          />
        </template>
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
  grid-template-columns: 20px minmax(0, 1fr);
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

.announcement-list-item:hover,
.announcement-list-item.is-active {
  color: var(--accent);
  background: var(--panel-bg);
}

.announcement-list-item span {
  overflow-wrap: anywhere;
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

.manual-head {
  align-items: center;
}

.manual-actions {
  display: flex;
  gap: 8px;
}

.manual-frame {
  width: 100%;
  height: calc(min(760px, 78vh) - 92px);
  min-height: 520px;
  border: 0;
  background: var(--page-bg);
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

  .manual-actions {
    flex-wrap: wrap;
  }
}
</style>
