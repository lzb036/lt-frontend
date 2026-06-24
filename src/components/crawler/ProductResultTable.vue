<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search, View } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem, ReviewStatus } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const products = shallowRef<ProductItem[]>([])

const filters = reactive({
  status: '' as ReviewStatus | '',
  keyword: '',
})

const totalValue = computed(() => products.value.reduce((sum, product) => sum + (product.price || 0), 0))
const withImageCount = computed(() => products.value.filter((product) => product.imageUrl).length)

onMounted(() => {
  void loadProducts()
})

async function loadProducts() {
  loading.value = true
  try {
    products.value = await api.listProducts({
      status: filters.status,
      keyword: filters.keyword.trim(),
    })
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品结果失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.status = ''
  filters.keyword = ''
  void loadProducts()
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '待处理',
    approved: '已确认',
    rejected: '已拒绝',
  }
  return labels[status] || status
}

function statusType(status: string) {
  if (status === 'approved') {
    return 'success'
  }
  if (status === 'rejected') {
    return 'danger'
  }
  return 'warning'
}

function priceText(product: ProductItem) {
  if (product.price == null) {
    return '-'
  }
  return `${product.currency || 'JPY'} ${product.price.toLocaleString()}`
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Products</p>
        <h1>商品结果</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="loadProducts">
        刷新
      </el-button>
    </div>

    <div class="metric-row">
      <section class="metric-panel">
        <strong>{{ products.length }}</strong>
        <span>当前结果数</span>
      </section>
      <section class="metric-panel">
        <strong>{{ withImageCount }}</strong>
        <span>有图片商品</span>
      </section>
      <section class="metric-panel">
        <strong>{{ Math.round(totalValue).toLocaleString() }}</strong>
        <span>当前页价格合计</span>
      </section>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-select v-model="filters.status" clearable placeholder="审核状态">
          <el-option label="待处理" value="pending" />
          <el-option label="已确认" value="approved" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-input v-model="filters.keyword" :prefix-icon="Search" clearable placeholder="商品标题关键词" @keydown.enter="loadProducts" />
        <el-button type="primary" :icon="Search" @click="loadProducts">
          查询
        </el-button>
        <el-button @click="resetFilters">
          重置
        </el-button>
      </div>

      <el-table v-loading="loading" :data="products" empty-text="暂无商品" height="620">
        <el-table-column label="图片" width="92">
          <template #default="{ row }">
            <el-image
              v-if="row.imageUrl"
              class="product-image"
              :src="row.imageUrl"
              fit="cover"
              lazy
              :preview-src-list="[row.imageUrl]"
              preview-teleported
            />
            <span v-else class="image-empty">无图</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="商品标题" min-width="300" show-overflow-tooltip />
        <el-table-column prop="itemNumber" label="商品编号" min-width="150" show-overflow-tooltip />
        <el-table-column label="价格" width="140">
          <template #default="{ row }">
            {{ priceText(row) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.reviewStatus)">
              {{ statusLabel(row.reviewStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="来源" width="100" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" link type="primary" tag="a" :href="row.sourceUrl" target="_blank" rel="noreferrer">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
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
  font-size: 26px;
  font-weight: 800;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  padding: 16px 18px;
}

.metric-panel strong {
  display: block;
  color: var(--text-main);
  font-size: 25px;
}

.metric-panel span {
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 700;
}

.work-panel {
  padding: 18px;
}

.filter-row {
  display: grid;
  margin-bottom: 14px;
  grid-template-columns: 180px minmax(260px, 1fr) auto auto;
  gap: 12px;
}

.product-image {
  width: 54px;
  height: 54px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
}

.image-empty {
  display: inline-grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  color: var(--text-faint);
  font-size: 12px;
}

@media (max-width: 900px) {
  .filter-row,
  .metric-row {
    grid-template-columns: 1fr;
  }
}
</style>
