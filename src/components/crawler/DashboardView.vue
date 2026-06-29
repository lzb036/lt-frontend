<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AlarmClock, CircleCheck, Connection, Document, Finished, OfficeBuilding, Refresh, ShoppingCartFull, SwitchButton, Warning } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AuthSession, DashboardSummary } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { isSuperadmin as isSuperadminSession } from '../../utils/permissions'

const props = defineProps<{
  session: AuthSession | null
}>()

const emit = defineEmits<{
  logout: []
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const summary = shallowRef<DashboardSummary | null>(null)
const systemNow = shallowRef(new Date())

const queuedTaskCount = computed(() => summary.value?.crawlTasks.queued ?? 0)
const runningTaskCount = computed(() => summary.value?.crawlTasks.running ?? 0)
const totalStoreCount = computed(() => summary.value?.stores.total ?? 0)
const enabledStoreCount = computed(() => summary.value?.stores.enabled ?? 0)
const errorStoreCount = computed(() => summary.value?.stores.error ?? 0)
const successTaskCount = computed(() => summary.value?.crawlTasks.success ?? 0)
const failedTaskCount = computed(() => summary.value?.crawlTasks.failed ?? 0)
const pendingProductCount = computed(() => summary.value?.products.pending ?? 0)
const approvedProductCount = computed(() => summary.value?.products.approved ?? 0)
const errorProductCount = computed(() => summary.value?.products.error ?? 0)
const queuedListingTaskCount = computed(() => summary.value?.listingTasks.queued ?? 0)
const runningListingTaskCount = computed(() => summary.value?.listingTasks.running ?? 0)
const successListingTaskCount = computed(() => summary.value?.listingTasks.success ?? 0)
const failedListingTaskCount = computed(() => summary.value?.listingTasks.failed ?? 0)
const queuedSyncTaskCount = computed(() => summary.value?.syncTasks.queued ?? 0)
const runningSyncTaskCount = computed(() => summary.value?.syncTasks.running ?? 0)
const successSyncTaskCount = computed(() => summary.value?.syncTasks.success ?? 0)
const failedSyncTaskCount = computed(() => summary.value?.syncTasks.failed ?? 0)
const isSuperadmin = computed(() => isSuperadminSession(props.session))
const displayName = computed(() => props.session?.displayName || props.session?.username || '未登录')
const formattedSystemTime = computed(() => formatSystemDateTime(systemNow.value))

let systemClockTimer: number | undefined

onMounted(() => {
  systemNow.value = new Date()
  systemClockTimer = window.setInterval(() => {
    systemNow.value = new Date()
  }, 1000)
  void refreshDashboard()
})

onUnmounted(() => {
  if (systemClockTimer !== undefined) {
    window.clearInterval(systemClockTimer)
  }
})

async function refreshDashboard() {
  loading.value = true
  try {
    summary.value = await api.getDashboardSummary()
    ElMessage.success('仪表盘数据已刷新')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '刷新仪表盘失败'))
  } finally {
    loading.value = false
  }
}

function formatSystemDateTime(value: Date) {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const year = value.getFullYear()
  const month = padDatePart(value.getMonth() + 1)
  const day = padDatePart(value.getDate())
  const hours = padDatePart(value.getHours())
  const minutes = padDatePart(value.getMinutes())
  const seconds = padDatePart(value.getSeconds())
  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds} ${weekdays[value.getDay()]}`
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

async function confirmLogout() {
  try {
    await ElMessageBox.confirm('确认退出当前账号？', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true,
    })
    emit('logout')
  } catch {
  }
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
        <span class="system-clock">{{ formattedSystemTime }}</span>
        <span class="role-tag">{{ isSuperadmin ? '超级管理员' : '子公司用户' }}</span>
        <span class="user-name">{{ displayName }}</span>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading"
          @click="refreshDashboard"
        >
          重新加载
        </el-button>
        <el-button
          :icon="SwitchButton"
          plain
          @click="confirmLogout"
        >
          退出
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

      <section class="metric-section">
        <div class="metric-section-title">同步任务统计</div>
        <div class="metric-row metric-row-4">
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><Refresh /></el-icon>
            </span>
            <div>
              <strong>{{ runningSyncTaskCount }}</strong>
              <span>执行中</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon">
              <el-icon><AlarmClock /></el-icon>
            </span>
            <div>
              <strong>{{ queuedSyncTaskCount }}</strong>
              <span>待执行</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-success">
              <el-icon><CircleCheck /></el-icon>
            </span>
            <div>
              <strong>{{ successSyncTaskCount }}</strong>
              <span>成功</span>
            </div>
          </section>
          <section class="detail-metric-card">
            <span class="detail-metric-icon detail-metric-icon-danger">
              <el-icon><Warning /></el-icon>
            </span>
            <div>
              <strong>{{ failedSyncTaskCount }}</strong>
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
  flex-wrap: wrap;
  gap: 10px;
}

.dashboard-actions :deep(.el-button) {
  display: inline-flex !important;
}

.system-clock {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
  color: var(--text-main);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  padding: 0 10px;
  white-space: nowrap;
}

.role-tag {
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 800;
}

.user-name {
  color: var(--text-main);
  font-weight: 800;
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

  .dashboard-actions {
    justify-content: flex-start;
  }

  .metric-row-3,
  .metric-row-4 {
    grid-template-columns: 1fr;
  }
}
</style>
