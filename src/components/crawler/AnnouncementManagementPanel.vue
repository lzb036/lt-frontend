<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type {
  UploadFile,
  UploadFiles,
  UploadRequestOptions,
  UploadUserFile,
} from 'element-plus'
import { Delete, DocumentAdd, EditPen, Picture, Refresh } from '@element-plus/icons-vue'

import { useMaintenance } from '../../composables/useMaintenance'
import type {
  SystemAnnouncement,
  SystemAnnouncementPayload,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useMaintenance()
const announcements = shallowRef<SystemAnnouncement[]>([])
const loading = shallowRef(false)
const saving = shallowRef(false)
const dialogOpen = shallowRef(false)
const editingId = shallowRef<number | null>(null)
const uploadFiles = shallowRef<UploadUserFile[]>([])
const uploadedDuringEdit = new Set<string>()

const form = reactive<SystemAnnouncementPayload>({
  title: '',
  content: '',
  imageUrls: [],
  published: true,
})

const dialogTitle = computed(() => (
  editingId.value ? '编辑公告' : '新增公告'
))

onMounted(() => {
  void loadAnnouncements()
})

async function loadAnnouncements() {
  loading.value = true
  try {
    announcements.value = await api.listManagedAnnouncements()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载公告失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.title = ''
  form.content = ''
  form.imageUrls = []
  form.published = true
  uploadFiles.value = []
  uploadedDuringEdit.clear()
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(announcement: SystemAnnouncement) {
  resetForm()
  editingId.value = announcement.id
  form.title = announcement.title
  form.content = announcement.content
  form.imageUrls = [...announcement.imageUrls]
  form.published = announcement.published
  uploadFiles.value = announcement.imageUrls.map((url, index) => ({
    name: `公告图片 ${index + 1}`,
    url,
    status: 'success',
    uid: Date.now() + index,
  }))
  dialogOpen.value = true
}

async function saveAnnouncement() {
  if (!form.title.trim()) {
    ElMessage.warning('请输入公告标题')
    return
  }
  if (!form.content.trim() && form.imageUrls.length < 1) {
    ElMessage.warning('公告内容和图片不能同时为空')
    return
  }
  saving.value = true
  const wasEditing = Boolean(editingId.value)
  try {
    await api.saveAnnouncement({
      title: form.title.trim(),
      content: form.content.trim(),
      imageUrls: [...form.imageUrls],
      published: form.published,
    }, editingId.value ?? undefined)
    uploadedDuringEdit.clear()
    dialogOpen.value = false
    await loadAnnouncements()
    ElMessage.success(wasEditing ? '公告已更新' : '公告已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存公告失败'))
  } finally {
    saving.value = false
  }
}

async function removeAnnouncement(announcement: SystemAnnouncement) {
  try {
    await ElMessageBox.confirm(
      `确认删除公告「${announcement.title}」？公告中的图片也会一并清理。`,
      '删除公告',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await api.deleteAnnouncement(announcement.id)
    await loadAnnouncements()
    ElMessage.success('公告已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(toApiErrorMessage(error, '删除公告失败'))
    }
  }
}

async function uploadImage(options: UploadRequestOptions) {
  try {
    const imageUrl = await api.uploadAnnouncementImage(options.file)
    form.imageUrls.push(imageUrl)
    uploadedDuringEdit.add(imageUrl)
    uploadFiles.value = uploadFiles.value.map((file) => (
      file.uid === options.file.uid
        ? {
            ...file,
            url: imageUrl,
            status: 'success',
            response: { imageUrl },
          }
        : file
    ))
    options.onSuccess({ imageUrl })
  } catch (error) {
    const uploadError = Object.assign(
      error instanceof Error ? error : new Error('图片上传失败'),
      {
        status: 400,
        method: 'POST',
        url: '/maintenance/announcement-images',
      },
    ) as Parameters<UploadRequestOptions['onError']>[0]
    options.onError(uploadError)
    ElMessage.error(toApiErrorMessage(error, '公告图片上传失败'))
  }
}

async function handleImageRemove(file: UploadFile, files: UploadFiles) {
  const imageUrl = file.url || extractUploadedImageUrl(file.response)
  form.imageUrls = files
    .map((item) => item.url || extractUploadedImageUrl(item.response))
    .filter((url): url is string => Boolean(url))
  if (imageUrl && uploadedDuringEdit.has(imageUrl)) {
    uploadedDuringEdit.delete(imageUrl)
    try {
      await api.deleteAnnouncementImage(imageUrl)
    } catch (error) {
      ElMessage.warning(toApiErrorMessage(error, '临时公告图片清理失败'))
    }
  }
}

function extractUploadedImageUrl(response: unknown) {
  if (!response || typeof response !== 'object') {
    return ''
  }
  const imageUrl = Reflect.get(response, 'imageUrl')
  return typeof imageUrl === 'string' ? imageUrl : ''
}

async function handleDialogClosed() {
  const temporaryUrls = [...uploadedDuringEdit]
  uploadedDuringEdit.clear()
  await Promise.allSettled(
    temporaryUrls.map((imageUrl) => api.deleteAnnouncementImage(imageUrl)),
  )
  resetForm()
}

function handleUploadExceed() {
  ElMessage.warning('每条公告最多上传 12 张图片')
}

function formatDateTime(value?: string | null) {
  return value || '-'
}
</script>

<template>
  <section class="announcement-panel">
    <div class="announcement-panel-head">
      <div class="panel-heading">
        <div class="panel-heading-icon"><el-icon><Picture /></el-icon></div>
        <div>
          <h2>公告编辑</h2>
        </div>
      </div>
      <div class="panel-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadAnnouncements">
          刷新
        </el-button>
        <el-button type="primary" :icon="DocumentAdd" @click="openCreateDialog">
          新增公告
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="announcements"
      empty-text="暂无公告"
      row-key="id"
    >
      <el-table-column prop="title" label="公告标题" min-width="220" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.published ? 'success' : 'info'">
            {{ row.published ? '已发布' : '未发布' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="图片" width="80">
        <template #default="{ row }">{{ row.imageUrls.length }} 张</template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }">{{ formatDateTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button :icon="EditPen" link type="primary" @click="openEditDialog(row)">
            编辑
          </el-button>
          <el-button :icon="Delete" link type="danger" @click="removeAnnouncement(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogOpen"
      :title="dialogTitle"
      width="760px"
      append-to-body
      destroy-on-close
      @closed="handleDialogClosed"
    >
      <el-form label-position="top" class="announcement-form">
        <el-form-item label="公告标题">
          <el-input
            v-model="form.title"
            maxlength="255"
            show-word-limit
            placeholder="输入公告标题"
          />
        </el-form-item>
        <el-form-item label="公告内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="9"
            maxlength="20000"
            show-word-limit
            resize="vertical"
            placeholder="输入公告内容，支持换行"
          />
        </el-form-item>
        <el-form-item label="公告图片">
          <el-upload
            v-model:file-list="uploadFiles"
            class="announcement-upload"
            list-type="picture-card"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp"
            :limit="12"
            :http-request="uploadImage"
            :on-remove="handleImageRemove"
            :on-exceed="handleUploadExceed"
          >
            <el-icon><DocumentAdd /></el-icon>
          </el-upload>
        </el-form-item>
        <el-form-item>
          <div class="publish-row">
            <span>发布状态</span>
            <el-switch
              v-model="form.published"
              active-text="发布"
              inactive-text="停用"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAnnouncement">
          保存公告
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.announcement-panel {
  padding: 22px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.announcement-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--panel-border);
  margin-bottom: 18px;
}

.panel-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-heading-icon {
  width: 42px;
  height: 42px;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  color: #2c5f7d;
  background: #eaf3f7;
  font-size: 21px;
}

.panel-heading h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 16px;
}

.panel-actions {
  display: flex;
  gap: 10px;
}

.announcement-form {
  display: grid;
}

.publish-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
}

.announcement-upload {
  width: 100%;
}

@media (max-width: 640px) {
  .announcement-panel {
    padding: 16px;
  }

  .announcement-panel-head {
    align-items: stretch;
    flex-direction: column;
  }

  .panel-actions {
    justify-content: flex-end;
  }
}
</style>
