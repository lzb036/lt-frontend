<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { CrawlSource, CrawlSourcePayload, SourceType } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const dialogVisible = shallowRef(false)
const editingId = shallowRef<number | null>(null)
const sources = shallowRef<CrawlSource[]>([])
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination()

const form = reactive<CrawlSourcePayload>({
  name: '',
  sourceType: 'keyword',
  target: '',
  enabled: true,
  scheduleEnabled: false,
  intervalMinutes: 60,
  notes: '',
})

const dialogTitle = computed(() => (editingId.value ? '编辑采集源' : '新增采集源'))

const sourceTypeOptions: Array<{ label: string; value: SourceType; description: string }> = [
  { label: '关键词', value: 'keyword', description: '按关键词搜索商品列表' },
  { label: '店铺', value: 'shop', description: '按店铺 ID 或店铺 URL 采集' },
  { label: '排名', value: 'ranking', description: '采集搜索排名页面' },
  { label: '商品 URL', value: 'product_url', description: '采集单个商品详情页' },
]

onMounted(() => {
  void loadSources()
})

async function loadSources() {
  loading.value = true
  try {
    const result = await api.listSourcesPage({ page: currentPage.value, pageSize: pageSize.value })
    sources.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载采集源失败'))
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.sourceType = 'keyword'
  form.target = ''
  form.enabled = true
  form.scheduleEnabled = false
  form.intervalMinutes = 60
  form.notes = ''
}

function openCreateDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row: CrawlSource) {
  editingId.value = row.id
  form.name = row.name
  form.sourceType = row.sourceType
  form.target = row.target
  form.enabled = row.enabled
  form.scheduleEnabled = row.scheduleEnabled
  form.intervalMinutes = row.intervalMinutes
  form.notes = row.notes
  dialogVisible.value = true
}

async function saveSource() {
  if (!form.name.trim() || !form.target.trim()) {
    ElMessage.warning('采集源名称和目标不能为空')
    return
  }
  saving.value = true
  try {
    await api.saveSource({
      ...form,
      name: form.name.trim(),
      target: form.target.trim(),
      notes: form.notes.trim(),
    }, editingId.value ?? undefined)
    await loadSources()
    dialogVisible.value = false
    ElMessage.success('采集源已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存采集源失败'))
  } finally {
    saving.value = false
  }
}

async function deleteSource(row: CrawlSource) {
  try {
    await ElMessageBox.confirm(`确认删除采集源「${row.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await api.deleteSource(row.id)
    await loadSources()
    ElMessage.success('采集源已删除')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除采集源失败'))
    }
  }
}

function handlePageSizeChange() {
  resetPage()
  void loadSources()
}

function sourceTypeLabel(value: SourceType) {
  return sourceTypeOptions.find((item) => item.value === value)?.label || value
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Sources</p>
        <h1>采集源</h1>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadSources">
          刷新
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增采集源
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <div class="panel-head">
        <div>
          <h2>当前用户采集源</h2>
          <p>采集源按用户隔离，后端只返回当前登录账号的数据。</p>
        </div>
      </div>

      <el-table v-loading="loading" :data="sources" empty-text="暂无采集源" height="max(560px, calc(100vh - 270px))">
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag>{{ sourceTypeLabel(row.sourceType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标" min-width="260">
          <template #default="{ row }">
            <CopyableTableText :value="row.target" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="定时" width="130">
          <template #default="{ row }">
            <span>{{ row.scheduleEnabled ? `${row.intervalMinutes} 分钟` : '未开启' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastRunAt" label="最近执行" min-width="170" />
        <el-table-column class-name="table-action-column" label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button :icon="Edit" link type="primary" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button :icon="Delete" link type="danger" @click="deleteSource(row)">
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
          @current-change="loadSources"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="680px">
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="采集源名称">
            <el-input v-model="form.name" placeholder="例如：日本家电关键词" />
          </el-form-item>
          <el-form-item label="采集类型">
            <el-select v-model="form.sourceType">
              <el-option
                v-for="item in sourceTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <span>{{ item.label }}</span>
                <span class="option-description">{{ item.description }}</span>
              </el-option>
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="目标">
          <el-input
            v-model="form.target"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 5 }"
            placeholder="关键词、店铺 ID、排名关键词或商品 URL"
          />
        </el-form-item>

        <div class="form-grid">
          <el-form-item label="启用状态">
            <el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" />
          </el-form-item>
          <el-form-item label="定时采集">
            <div class="schedule-row">
              <el-switch v-model="form.scheduleEnabled" active-text="开启" inactive-text="关闭" />
              <el-input-number v-model="form.intervalMinutes" :min="5" :max="1440" :step="5" />
              <span>分钟</span>
            </div>
          </el-form-item>
        </div>

        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="可选" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSource">
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

.page-head,
.panel-head,
.head-actions,
.schedule-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-head,
.panel-head {
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1,
.panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.panel-head h2 {
  font-size: 17px;
}

.panel-head p {
  margin: 5px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.option-description {
  float: right;
  color: var(--text-faint);
  font-size: 12px;
}

.schedule-row {
  flex-wrap: wrap;
}

@media (max-width: 760px) {
  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
