<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose, Delete, Download, EditPen, Plus, Search, Upload } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, SensitiveWord, SensitiveWordImportResult, SensitiveWordPayload } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const downloadingTemplate = shallowRef(false)
const importing = shallowRef(false)
const saving = shallowRef(false)
const dialogOpen = shallowRef(false)
const editingWord = shallowRef<SensitiveWord | null>(null)
const statusActionId = shallowRef<number | null>(null)
const deletingId = shallowRef<number | null>(null)
const words = shallowRef<SensitiveWord[]>([])
const importInputRef = ref<HTMLInputElement | null>(null)
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

const filters = reactive({
  keyword: '',
})

const form = reactive<SensitiveWordPayload>({
  word: '',
  enabled: true,
})

const dialogTitle = computed(() => (editingWord.value ? '编辑敏感词' : '添加敏感词汇'))
const normalizedFormWord = computed(() => form.word.trim())
const formRuleType = computed(() => (normalizedFormWord.value === '【】' ? '括号规则' : '文本匹配'))

onMounted(() => {
  void loadSensitiveWords()
})

async function loadSensitiveWords() {
  loading.value = true
  try {
    const result = await api.listSensitiveWordsPage({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: filters.keyword.trim(),
    })
    words.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载敏感词失败'))
  } finally {
    loading.value = false
  }
}

function searchSensitiveWords() {
  resetPage()
  void loadSensitiveWords()
}

function resetFilters() {
  filters.keyword = ''
  resetPage()
  void loadSensitiveWords()
}

function handlePageSizeChange() {
  resetPage()
  void loadSensitiveWords()
}

function resetForm() {
  editingWord.value = null
  form.word = ''
  form.enabled = true
}

function openCreateDialog() {
  resetForm()
  dialogOpen.value = true
}

function openEditDialog(row: SensitiveWord) {
  editingWord.value = row
  form.word = row.word
  form.enabled = row.enabled
  dialogOpen.value = true
}

async function saveSensitiveWord() {
  if (!normalizedFormWord.value) {
    ElMessage.warning('请输入敏感词')
    return
  }
  const editing = editingWord.value
  saving.value = true
  try {
    if (editing) {
      await api.updateSensitiveWord(editing.id, {
        word: normalizedFormWord.value,
        enabled: form.enabled,
      })
      ElMessage.success('敏感词已更新')
    } else {
      await api.createSensitiveWord({
        word: normalizedFormWord.value,
        enabled: form.enabled,
      })
      ElMessage.success('敏感词已添加')
      if (currentPage.value !== 1) {
        resetPage()
      }
    }
    dialogOpen.value = false
    await loadSensitiveWords()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存敏感词失败'))
  } finally {
    saving.value = false
  }
}

async function toggleSensitiveWordStatus(row: SensitiveWord) {
  const nextEnabled = !row.enabled
  const actionText = nextEnabled ? '启用' : '停用'
  const confirmText = nextEnabled
    ? `确认启用敏感词“${row.word}”？启用后会立即参与后续商品文本清洗。`
    : `确认停用敏感词“${row.word}”？停用后后续商品文本将不再匹配该规则。`
  try {
    await ElMessageBox.confirm(confirmText, `${actionText}敏感词`, {
      confirmButtonText: actionText,
      cancelButtonText: '取消',
      type: nextEnabled ? 'warning' : 'info',
    })
    statusActionId.value = row.id
    await api.updateSensitiveWord(row.id, {
      word: row.word,
      enabled: nextEnabled,
    })
    await loadSensitiveWords()
    ElMessage.success(`敏感词已${actionText}`)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, `${actionText}敏感词失败`))
    }
  } finally {
    statusActionId.value = null
  }
}

async function deleteSensitiveWord(row: SensitiveWord) {
  try {
    await ElMessageBox.confirm(
      `确认删除敏感词“${row.word}”？删除后该规则将不再用于后续采集清洗。`,
      '删除敏感词',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    deletingId.value = row.id
    await api.deleteSensitiveWord(row.id)
    if (words.value.length === 1 && currentPage.value > 1) {
      currentPage.value -= 1
    }
    await loadSensitiveWords()
    ElMessage.success('敏感词已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除敏感词失败'))
    }
  } finally {
    deletingId.value = null
  }
}

function openImportFilePicker() {
  importInputRef.value?.click()
}

async function downloadTemplate() {
  downloadingTemplate.value = true
  try {
    const blob = await api.downloadSensitiveWordTemplate()
    downloadBlob(blob, '敏感词导入模板.xlsx')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '下载模板失败'))
  } finally {
    downloadingTemplate.value = false
  }
}

async function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  if (!/\.xlsx$/i.test(file.name)) {
    ElMessage.warning('请选择 xlsx 表格文件')
    return
  }
  importing.value = true
  try {
    const result = await api.importSensitiveWords(file)
    resetPage()
    await loadSensitiveWords()
    showImportResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '导入敏感词失败'))
  } finally {
    importing.value = false
  }
}

function showImportResult(result: SensitiveWordImportResult) {
  const summary = `导入完成：新增 ${result.createdCount} 条，重复 ${result.duplicateCount} 条，无效 ${result.invalidCount} 条`
  if (result.duplicateCount > 0 || result.invalidCount > 0) {
    void ElMessageBox.alert(summary, '导入结果', {
      confirmButtonText: '知道了',
      type: 'warning',
    })
    return
  }
  ElMessage.success(summary)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function ruleTypeLabel(row: SensitiveWord) {
  return row.ruleType === 'bracket' ? '括号规则' : '文本匹配'
}

function ruleTypeTagType(row: SensitiveWord) {
  return row.ruleType === 'bracket' ? 'warning' : 'info'
}

function statusTagType(row: SensitiveWord) {
  return row.enabled ? 'success' : 'info'
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">System Settings</p>
        <h1>敏感词管理</h1>
      </div>
      <div class="head-actions">
        <input
          ref="importInputRef"
          class="import-input"
          type="file"
          accept=".xlsx"
          @change="handleImportFileChange"
        >
        <el-button :icon="Download" :loading="downloadingTemplate" @click="downloadTemplate">
          下载模板
        </el-button>
        <el-button :icon="Upload" :loading="importing" @click="openImportFilePicker">
          导入表格
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          添加敏感词汇
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-input
          v-model="filters.keyword"
          class="filter-control filter-keyword-field"
          :prefix-icon="Search"
          clearable
          placeholder="搜索敏感词内容"
          @keydown.enter="searchSensitiveWords"
        />
        <div class="filter-actions">
          <el-button type="primary" :icon="Search" @click="searchSensitiveWords">
            搜索
          </el-button>
          <el-button @click="resetFilters">
            重置
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="words"
        empty-text="暂无敏感词"
        height="max(620px, calc(100vh - 300px))"
      >
        <el-table-column prop="id" label="ID" width="88" />
        <el-table-column label="敏感词" min-width="260">
          <template #default="{ row }">
            <CopyableTableText :value="row.word" />
          </template>
        </el-table-column>
        <el-table-column label="规则类型" width="120">
          <template #default="{ row }">
            <el-tag :type="ruleTypeTagType(row)">
              {{ ruleTypeLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row)">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="180" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="180" />
        <el-table-column class-name="table-action-column" label="操作" width="188" fixed="right">
          <template #default="{ row }">
            <el-button :icon="EditPen" link type="primary" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button
              :icon="row.enabled ? CircleClose : CircleCheck"
              :loading="statusActionId === row.id"
              link
              :type="row.enabled ? 'warning' : 'success'"
              @click="toggleSensitiveWordStatus(row)"
            >
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-button
              :icon="Delete"
              :loading="deletingId === row.id"
              link
              type="danger"
              @click="deleteSensitiveWord(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="loadSensitiveWords"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogOpen" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="敏感词">
          <el-input
            v-model="form.word"
            maxlength="500"
            show-word-limit
            placeholder="例如：即納 或 【】"
          />
        </el-form-item>
        <el-form-item label="规则类型">
          <el-input :model-value="formRuleType" disabled />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <div class="dialog-tip">
        <p>输入 `【】` 时，会移除文本中的完整 `【...】` 片段。</p>
        <p>普通敏感词按字面匹配，保存后用于后续采集入库清洗。</p>
      </div>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSensitiveWord">
          保存
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 26px;
  font-weight: 800;
}

.page-subtitle {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.head-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.import-input {
  display: none;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.filter-control {
  flex: 1 1 220px;
  min-width: 0;
}

.filter-keyword-field {
  max-width: 420px;
}

.filter-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}

.dialog-tip {
  display: grid;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.dialog-tip p {
  margin: 0;
}

@media (max-width: 760px) {
  .page-head {
    flex-direction: column;
  }

  .head-actions,
  .head-actions .el-button,
  .filter-control,
  .filter-actions {
    width: 100%;
    max-width: none;
  }

  .filter-actions {
    margin-left: 0;
  }

  .filter-actions .el-button {
    flex: 1;
  }
}
</style>
