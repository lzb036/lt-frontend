<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, Connection, Key, List, Refresh } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useClientPagination } from '../../composables/useClientPagination'
import type { AuthSession, CrawlSource, CrawlTask, ListingTask, ProductItem, SecretProfile, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const profile = shallowRef<SecretProfile | null>(null)
const sources = shallowRef<CrawlSource[]>([])
const tasks = shallowRef<CrawlTask[]>([])
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const listingTasks = shallowRef<ListingTask[]>([])

const isConfigured = computed(() => {
  if (!profile.value) {
    return false
  }
  return Boolean(
    profile.value.rakutenShopUrl
    || profile.value.masked.rakutenServiceSecret
    || profile.value.masked.rakutenLicenseKey,
  )
})
const enabledSourceCount = computed(() => sources.value.filter((source) => source.enabled).length)
const runningTaskCount = computed(() => tasks.value.filter((task) => task.status === 'running' || task.status === 'queued').length)
const successTaskCount = computed(() => tasks.value.filter((task) => task.status === 'success').length)
const pendingProductCount = computed(() => products.value.filter((product) => product.reviewStatus === 'pending').length)
const approvedProductCount = computed(() => products.value.filter((product) => product.reviewStatus === 'approved').length)
const errorProductCount = computed(() => products.value.filter((product) => product.reviewStatus === 'error').length)
const listingTaskCount = computed(() => listingTasks.value.length)
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  pagedItems: pagedTasks,
} = useClientPagination(tasks)

onMounted(() => {
  void refreshDashboard()
})

async function refreshDashboard() {
  loading.value = true
  try {
    const [profileValue, sourceValues, taskValues, productValues, storeValues, listingTaskValues] = await Promise.all([
      api.getSecretProfile(),
      api.listSources(),
      api.listTasks(),
      api.listProducts({}),
      api.listStores(),
      api.listListingTasks(),
    ])
    profile.value = profileValue
    sources.value = sourceValues
    tasks.value = taskValues
    products.value = productValues
    stores.value = storeValues
    listingTasks.value = listingTaskValues
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载概览失败'))
  } finally {
    loading.value = false
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
    success: '成功',
    partial: '部分成功',
    failed: '失败',
  }
  return labels[status] || status
}

function statusType(status: string) {
  if (status === 'success') {
    return 'success'
  }
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'partial') {
    return 'warning'
  }
  return 'info'
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Product Collector</p>
        <h1>采集概览</h1>
      </div>
      <el-button
        :icon="Refresh"
        :loading="loading"
        @click="refreshDashboard"
      >
        刷新
      </el-button>
    </div>

    <div class="metric-grid">
      <section class="metric-panel">
        <span class="metric-icon">
          <el-icon><Key /></el-icon>
        </span>
        <div>
          <strong>{{ isConfigured ? '已配置' : '待配置' }}</strong>
          <span>我的密钥状态</span>
        </div>
      </section>
      <section class="metric-panel">
        <span class="metric-icon">
          <el-icon><Connection /></el-icon>
        </span>
        <div>
          <strong>{{ enabledSourceCount }}</strong>
          <span>启用采集源</span>
        </div>
      </section>
      <section class="metric-panel">
        <span class="metric-icon">
          <el-icon><List /></el-icon>
        </span>
        <div>
          <strong>{{ runningTaskCount }}</strong>
          <span>待执行/运行中</span>
        </div>
      </section>
      <section class="metric-panel">
        <span class="metric-icon">
          <el-icon><Connection /></el-icon>
        </span>
        <div>
          <strong>{{ stores.length }}</strong>
          <span>店铺配置</span>
        </div>
      </section>
    </div>

    <section class="work-panel">
      <div class="panel-head">
        <div>
          <h2>当前账号</h2>
          <p>{{ props.session?.displayName || props.session?.username }} 的独立配置空间</p>
        </div>
        <el-tag :type="props.session?.role === 'superadmin' ? 'warning' : 'info'">
          {{ props.session?.role === 'superadmin' ? '超级管理员' : '运营用户' }}
        </el-tag>
      </div>
      <div class="status-line">
        <span>
          <el-icon><CircleCheck /></el-icon>
          密钥配置：{{ isConfigured ? '已有配置' : '未填写' }}
        </span>
        <span>成功任务：{{ successTaskCount }}</span>
        <span>自动采集：{{ profile?.autoCrawlEnabled ? '已开启' : '未开启' }}</span>
        <span>待审核：{{ pendingProductCount }}</span>
        <span>已审核：{{ approvedProductCount }}</span>
        <span>异常：{{ errorProductCount }}</span>
        <span>上架任务：{{ listingTaskCount }}</span>
      </div>
    </section>

    <section class="work-panel">
      <div class="panel-head">
        <div>
          <h2>最近采集任务</h2>
          <p>仅显示当前登录用户自己的任务记录</p>
        </div>
      </div>
      <el-table
        v-loading="loading"
        :data="pagedTasks"
        empty-text="暂无任务"
        height="520"
      >
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column prop="sourceType" label="类型" width="120" />
        <el-table-column prop="target" label="目标" min-width="240" show-overflow-tooltip />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="successCount" label="保存" width="90" />
        <el-table-column prop="message" label="说明" min-width="180" show-overflow-tooltip />
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
        />
      </div>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.panel-head {
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

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-panel,
.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.metric-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
}

.metric-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
}

.metric-panel strong {
  display: block;
  color: var(--text-main);
  font-size: 24px;
  line-height: 1.1;
}

.metric-panel span:last-child {
  color: var(--text-soft);
  font-size: 13px;
}

.work-panel {
  padding: 18px;
}

.status-line {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  color: var(--text-soft);
  font-weight: 700;
}

.status-line span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
  padding: 8px 10px;
}

@media (max-width: 1180px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
