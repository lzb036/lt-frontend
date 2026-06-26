<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { AlarmClock, CircleCheck, Connection, Document, Finished, OfficeBuilding, Refresh, ShoppingCartFull, Warning } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AuthSession, CrawlTask, ListingTask, ProductItem, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const tasks = shallowRef<CrawlTask[]>([])
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const listingTasks = shallowRef<ListingTask[]>([])
const todayReference = shallowRef(new Date())

const todayTasks = computed(() => tasks.value.filter((task) => hasTodayTimestamp(task.createdAt, task.startedAt, task.finishedAt)))
const todayProducts = computed(() => products.value.filter((product) => hasTodayTimestamp(product.createdAt, product.updatedAt)))
const todayListingTasks = computed(() => listingTasks.value.filter((task) => hasTodayTimestamp(task.createdAt, task.startedAt, task.finishedAt, task.updatedAt)))

const queuedTaskCount = computed(() => todayTasks.value.filter((task) => task.status === 'queued').length)
const runningTaskCount = computed(() => todayTasks.value.filter((task) => task.status === 'running').length)
const totalStoreCount = computed(() => stores.value.length)
const enabledStoreCount = computed(() => stores.value.filter((store) => store.enabled).length)
const errorStoreCount = computed(() => stores.value.filter((store) => store.availabilityStatus === 'error').length)
const successTaskCount = computed(() => todayTasks.value.filter((task) => task.status === 'success').length)
const failedTaskCount = computed(() => todayTasks.value.filter((task) => task.status === 'failed').length)
const pendingProductCount = computed(() => todayProducts.value.filter((product) => product.reviewStatus === 'pending').length)
const approvedProductCount = computed(() => todayProducts.value.filter((product) => product.reviewStatus === 'approved').length)
const errorProductCount = computed(() => todayProducts.value.filter((product) => product.reviewStatus === 'error').length)
const queuedListingTaskCount = computed(() => todayListingTasks.value.filter((task) => task.status === 'queued').length)
const runningListingTaskCount = computed(() => todayListingTasks.value.filter((task) => task.status === 'running').length)
const successListingTaskCount = computed(() => todayListingTasks.value.filter((task) => task.status === 'success').length)
const failedListingTaskCount = computed(() => todayListingTasks.value.filter((task) => task.status === 'failed').length)

onMounted(() => {
  void refreshDashboard()
})

async function refreshDashboard() {
  loading.value = true
  todayReference.value = new Date()
  try {
    const [storeValues, taskValues, productValues, listingTaskValues] = await Promise.all([
      api.listStores(),
      api.listTasks(),
      api.listProducts({}),
      api.listListingTasks(),
    ])
    tasks.value = taskValues
    products.value = productValues
    stores.value = storeValues
    listingTasks.value = listingTaskValues
    ElMessage.success('仪表盘数据已刷新')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '刷新仪表盘失败'))
  } finally {
    loading.value = false
  }
}

function hasTodayTimestamp(...values: Array<string | null | undefined>) {
  return values.some((value) => isTodayTimestamp(value))
}

function isTodayTimestamp(value: string | null | undefined) {
  const date = parseDateValue(value)
  if (!date) {
    return false
  }
  const reference = todayReference.value
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate()
}

function parseDateValue(value: string | null | undefined) {
  const rawValue = value?.trim()
  if (!rawValue) {
    return null
  }
  const normalizedValue = (rawValue.includes('T') ? rawValue : rawValue.replace(' ', 'T')).replace(/(\.\d{3})\d+/, '$1')
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Product Collector</p>
        <h1 class="dashboard-title">今日系统数据统计</h1>
      </div>
      <div class="dashboard-actions">
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading"
          @click="refreshDashboard"
        >
          重新加载
        </el-button>
      </div>
    </div>

    <section class="dashboard-metric-stack">
      <section class="metric-section">
        <div class="metric-section-title">店铺统计</div>
        <div class="metric-row metric-row-3">
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><OfficeBuilding /></el-icon>
            </span>
            <div>
              <strong>{{ totalStoreCount }}</strong>
              <span>总店铺</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><Connection /></el-icon>
            </span>
            <div>
              <strong>{{ enabledStoreCount }}</strong>
              <span>启用店铺</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-danger">
              <el-icon><Warning /></el-icon>
            </span>
            <div>
              <strong>{{ errorStoreCount }}</strong>
              <span>异常店铺</span>
            </div>
          </section>
        </div>
      </section>

      <section class="metric-section">
        <div class="metric-section-title">商品统计</div>
        <div class="metric-row metric-row-3">
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-warning">
              <el-icon><Document /></el-icon>
            </span>
            <div>
              <strong>{{ pendingProductCount }}</strong>
              <span>待审核</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-success">
              <el-icon><Finished /></el-icon>
            </span>
            <div>
              <strong>{{ approvedProductCount }}</strong>
              <span>已审核</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-danger">
              <el-icon><Warning /></el-icon>
            </span>
            <div>
              <strong>{{ errorProductCount }}</strong>
              <span>异常</span>
            </div>
          </section>
        </div>
      </section>

      <section class="metric-section">
        <div class="metric-section-title">采集任务统计</div>
        <div class="metric-row metric-row-4">
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><AlarmClock /></el-icon>
            </span>
            <div>
              <strong>{{ queuedTaskCount }}</strong>
              <span>待执行</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><Connection /></el-icon>
            </span>
            <div>
              <strong>{{ runningTaskCount }}</strong>
              <span>执行中</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-success">
              <el-icon><CircleCheck /></el-icon>
            </span>
            <div>
              <strong>{{ successTaskCount }}</strong>
              <span>成功</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-danger">
              <el-icon><Warning /></el-icon>
            </span>
            <div>
              <strong>{{ failedTaskCount }}</strong>
              <span>失败</span>
            </div>
          </section>
        </div>
      </section>

      <section class="metric-section">
        <div class="metric-section-title">上架任务统计</div>
        <div class="metric-row metric-row-4">
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><ShoppingCartFull /></el-icon>
            </span>
            <div>
              <strong>{{ runningListingTaskCount }}</strong>
              <span>执行中</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><AlarmClock /></el-icon>
            </span>
            <div>
              <strong>{{ queuedListingTaskCount }}</strong>
              <span>待执行</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-success">
              <el-icon><CircleCheck /></el-icon>
            </span>
            <div>
              <strong>{{ successListingTaskCount }}</strong>
              <span>成功</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-danger">
              <el-icon><Warning /></el-icon>
            </span>
            <div>
              <strong>{{ failedListingTaskCount }}</strong>
              <span>失败</span>
            </div>
          </section>
        </div>
      </section>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: center;
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
  font-weight: 800;
  font-size: 30px;
}

.page-head .dashboard-title {
  display: block !important;
}

.dashboard-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.dashboard-actions :deep(.el-button) {
  display: inline-flex !important;
}

.dashboard-metric-stack {
  display: grid;
  gap: 18px;
}

.metric-section {
  display: grid;
  gap: 10px;
}

.metric-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
}

.metric-section-title::before {
  width: 4px;
  height: 14px;
  border-radius: 999px;
  background: var(--accent);
  content: '';
}

.metric-row {
  display: grid;
  gap: 14px;
}

.metric-row-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-row-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.detail-metric-card {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.detail-metric-card {
  display: flex;
  min-height: 84px;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.detail-metric-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}

.detail-metric-icon-success {
  border-color: color-mix(in srgb, var(--el-color-success), transparent 70%);
  background: color-mix(in srgb, var(--el-color-success), transparent 90%);
  color: var(--el-color-success);
}

.detail-metric-icon-warning {
  border-color: color-mix(in srgb, var(--el-color-warning), transparent 70%);
  background: color-mix(in srgb, var(--el-color-warning), transparent 90%);
  color: var(--el-color-warning);
}

.detail-metric-icon-danger {
  border-color: color-mix(in srgb, var(--el-color-danger), transparent 70%);
  background: color-mix(in srgb, var(--el-color-danger), transparent 90%);
  color: var(--el-color-danger);
}

.detail-metric-card strong {
  display: block;
  color: var(--text-main);
  font-size: 22px;
  line-height: 1.1;
}

.detail-metric-card span:last-child {
  color: var(--text-soft);
  font-size: 13px;
}

@media (max-width: 1180px) {
  .metric-row-3,
  .metric-row-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-row-3,
  .metric-row-4 {
    grid-template-columns: 1fr;
  }
}
</style>
