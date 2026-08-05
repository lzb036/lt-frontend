<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { Delete, Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AutoDeletionTask, AutoListingTaskType, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import FieldHelpTooltip from './FieldHelpTooltip.vue'

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const dialogVisible = shallowRef(false)
const createMode = shallowRef<AutoListingTaskType>('automatic')
const tasks = shallowRef<AutoDeletionTask[]>([])
const stores = shallowRef<StoreAccount[]>([])
const filters = reactive({ storeId: null as number | null, taskType: '' as '' | AutoListingTaskType })
const form = reactive({ storeId: 0, quantity: 50, scheduleType: 'daily' as 'daily' | 'weekly' | 'monthly', scheduleTime: '09:00', weekday: 1, monthDay: 1 })
const deletionQuantityHint = computed(() => (
  createMode.value === 'automatic'
    ? '每次到达设定时间时，只选择目标店铺中已上架、近一年有效销量为 0 的商品，并按上架时间从早到晚处理；符合条件的商品不足时按实际数量创建同步商品删除任务。'
    : '创建后立即执行，只选择目标店铺中已上架、近一年有效销量为 0 的商品，并按上架时间从早到晚处理；符合条件的商品不足时按实际数量创建同步商品删除任务。'
))

onMounted(() => void loadData())

async function loadData() {
  loading.value = true
  try {
    const [taskRows, storeRows] = await Promise.all([
      api.listAutoDeletionTasks(filters),
      api.listStores(),
    ])
    tasks.value = taskRows
    stores.value = storeRows
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载自动删除任务失败'))
  } finally {
    loading.value = false
  }
}

function openCreate(mode: AutoListingTaskType) {
  createMode.value = mode
  form.storeId = stores.value.find((store) => store.enabled)?.id || 0
  form.quantity = 50
  form.scheduleType = 'daily'
  form.scheduleTime = '09:00'
  form.weekday = 1
  form.monthDay = 1
  dialogVisible.value = true
}

async function submit() {
  if (!form.storeId) {
    ElMessage.warning('请选择店铺')
    return
  }
  saving.value = true
  try {
    if (createMode.value === 'automatic') {
      await api.createAutoDeletionTask({
        storeId: form.storeId,
        quantity: form.quantity,
        scheduleType: form.scheduleType,
        scheduleTime: form.scheduleTime,
        weekday: form.scheduleType === 'weekly' ? form.weekday : null,
        monthDay: form.scheduleType === 'monthly' ? form.monthDay : null,
      })
      ElMessage.success('自动删除任务已创建')
    } else {
      const task = await api.createManualDeletionTask({ storeId: form.storeId, quantity: form.quantity })
      ElMessage.success(task.lastMessage || '删除任务已创建')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建自动删除任务失败'))
  } finally {
    saving.value = false
  }
}

function scheduleLabel(task: AutoDeletionTask) {
  if (task.taskType === 'manual') return '立即执行'
  if (task.scheduleType === 'daily') return `每天 ${task.scheduleTime}`
  if (task.scheduleType === 'weekly') return `每周${['一', '二', '三', '四', '五', '六', '日'][(task.weekday || 1) - 1]} ${task.scheduleTime}`
  return `每月 ${task.monthDay || 1} 日 ${task.scheduleTime}`
}

async function removeTask(task: AutoDeletionTask) {
  try {
    await ElMessageBox.confirm('确认删除该自动删除任务记录？', '删除任务', { type: 'warning' })
    await api.deleteAutoDeletionTask(task.id)
    await loadData()
    ElMessage.success('任务已删除')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(toApiErrorMessage(error, '删除任务失败'))
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div><p class="eyebrow">Automation Management</p><h1>自动删除管理</h1></div>
      <div class="head-actions">
        <el-button type="primary" :icon="Plus" @click="openCreate('automatic')">
          创建定时任务
        </el-button>
        <el-button type="success" :icon="Plus" @click="openCreate('manual')">
          创建任务
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
      </div>
    </div>
    <section class="work-panel">
      <div class="filters">
        <el-select v-model="filters.storeId" clearable filterable placeholder="筛选店铺" @change="loadData">
          <el-option v-for="store in stores" :key="store.id" :label="store.aliasName || store.storeName" :value="store.id" />
        </el-select>
        <el-select v-model="filters.taskType" clearable placeholder="任务类型" @change="loadData">
          <el-option label="自动任务" value="automatic" /><el-option label="手动任务" value="manual" />
        </el-select>
      </div>
      <el-table v-loading="loading" :data="tasks" height="100%" empty-text="暂无自动删除任务">
        <el-table-column label="店铺" min-width="150"><template #default="{ row }">{{ row.storeAliasName || row.storeName }}</template></el-table-column>
        <el-table-column label="任务类型" width="110"><template #default="{ row }">{{ row.taskType === 'automatic' ? '自动任务' : '手动任务' }}</template></el-table-column>
        <el-table-column label="执行计划" min-width="170"><template #default="{ row }">{{ scheduleLabel(row) }}</template></el-table-column>
        <el-table-column prop="quantity" label="删除数量" width="100" />
        <el-table-column prop="lastMessage" label="上次结果" min-width="280" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right"><template #default="{ row }"><el-button link type="danger" :icon="Delete" @click="removeTask(row)">删除</el-button></template></el-table-column>
      </el-table>
    </section>
    <el-dialog v-model="dialogVisible" :title="createMode === 'automatic' ? '创建定时删除任务' : '创建删除任务'" width="540px">
      <el-form label-width="96px">
        <el-form-item label="店铺"><el-select v-model="form.storeId" class="full" filterable><el-option v-for="store in stores.filter(item => item.enabled)" :key="store.id" :label="store.aliasName || store.storeName" :value="store.id" /></el-select></el-form-item>
        <el-form-item>
          <template #label>
            <span class="label-with-help">
              <span>删除数量</span>
              <FieldHelpTooltip
                label="删除数量"
                :content="deletionQuantityHint"
              />
            </span>
          </template>
          <el-input-number v-model="form.quantity" :min="1" :max="10000" />
        </el-form-item>
        <template v-if="createMode === 'automatic'">
          <el-form-item label="执行周期"><el-segmented v-model="form.scheduleType" :options="[{ label: '每天', value: 'daily' }, { label: '每周', value: 'weekly' }, { label: '每月', value: 'monthly' }]" /></el-form-item>
          <el-form-item v-if="form.scheduleType === 'weekly'" label="星期"><el-input-number v-model="form.weekday" :min="1" :max="7" /></el-form-item>
          <el-form-item v-if="form.scheduleType === 'monthly'">
            <template #label>
              <span class="label-with-help">
                <span>日期</span>
                <FieldHelpTooltip
                  label="每月日期"
                  content="当月没有所选日期时，任务会在当月最后一天执行。"
                />
              </span>
            </template>
            <el-input-number v-model="form.monthDay" :min="1" :max="31" />
          </el-form-item>
          <el-form-item label="时间"><el-time-picker v-model="form.scheduleTime" format="HH:mm" value-format="HH:mm" /></el-form-item>
        </template>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="submit">{{ createMode === 'automatic' ? '创建定时任务' : '创建并执行' }}</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-stack {
  display: flex;
  min-height: calc(100vh - 132px);
  flex-direction: column;
  gap: 18px;
}

.page-head,
.head-actions,
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.page-head {
  justify-content: space-between;
}

.head-actions {
  justify-content: flex-end;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
  font-size: 26px;
}

.work-panel {
  flex: 1;
  min-height: 520px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  padding: 18px;
}

.filters {
  margin-bottom: 14px;
}

.filters :deep(.el-select) {
  width: 220px;
}

.full {
  width: 100%;
}

.label-with-help {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

@media (max-width: 760px) {
  .page-head,
  .head-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
