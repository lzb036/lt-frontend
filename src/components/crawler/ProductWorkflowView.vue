<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen, Finished, Plus, Refresh, Search, Upload, View } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useClientPagination } from '../../composables/useClientPagination'
import type { ProductItem, ReviewStatus, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  status: ReviewStatus
  title: string
  eyebrow: string
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const operating = shallowRef(false)
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const selectedIds = ref<number[]>([])
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  pagedItems: pagedProducts,
  resetPage,
} = useClientPagination(products)

const filters = reactive({
  keyword: '',
})

const listingForm = reactive({
  storeId: null as number | null,
  taskName: '',
})

const statusCopy = computed(() => {
  const map: Record<ReviewStatus, { label: string; tag: 'success' | 'warning' | 'danger' | 'info'; empty: string }> = {
    pending: { label: '待审核', tag: 'warning', empty: '暂无待审核商品' },
    approved: { label: '已审核', tag: 'success', empty: '暂无已审核商品' },
    error: { label: '异常', tag: 'danger', empty: '暂无异常商品' },
    listed: { label: '已上架', tag: 'success', empty: '暂无上架商品' },
    rejected: { label: '已拒绝', tag: 'danger', empty: '暂无拒绝商品' },
  }
  return map[props.status]
})

const totalValue = computed(() => pagedProducts.value.reduce((sum, product) => sum + (product.price || 0), 0))
const selectedCount = computed(() => selectedIds.value.length)

onMounted(() => {
  void refreshAll()
})

watch(
  () => props.status,
  () => {
    selectedIds.value = []
    resetPage()
    void refreshAll()
  },
)

async function refreshAll() {
  loading.value = true
  try {
    const [productValues, storeValues] = await Promise.all([
      api.listProducts({ status: props.status, keyword: filters.keyword.trim() }),
      api.listStores(),
    ])
    products.value = productValues
    stores.value = storeValues
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.keyword = ''
  resetPage()
  void refreshAll()
}

function searchProducts() {
  resetPage()
  void refreshAll()
}

function handleSelectionChange(rows: ProductItem[]) {
  selectedIds.value = rows.map((row) => row.id)
}

async function changeStatus(status: ReviewStatus, message = '') {
  if (selectedIds.value.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  operating.value = true
  try {
    await api.updateProductStatus({ productIds: selectedIds.value, status, message })
    ElMessage.success('商品状态已更新')
    selectedIds.value = []
    await refreshAll()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新商品状态失败'))
  } finally {
    operating.value = false
  }
}

async function markError() {
  if (selectedIds.value.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  try {
    const result = await ElMessageBox.prompt('填写异常原因', '标记异常', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：标题缺失、图片不可用、价格不合理',
    })
    await changeStatus('error', result.value)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '标记异常失败'))
    }
  }
}

async function removeSelected() {
  if (selectedIds.value.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除 ${selectedIds.value.length} 个商品？`, '删除商品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    operating.value = true
    await api.deleteProducts(selectedIds.value)
    ElMessage.success('商品已删除')
    selectedIds.value = []
    await refreshAll()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除商品失败'))
    }
  } finally {
    operating.value = false
  }
}

async function createListingTask() {
  if (selectedIds.value.length < 1) {
    ElMessage.warning('请先选择要上架的商品')
    return
  }
  operating.value = true
  try {
    await api.createListingTask({
      productIds: selectedIds.value,
      storeId: listingForm.storeId,
      taskName: listingForm.taskName.trim(),
    })
    ElMessage.success('已创建上架任务')
    selectedIds.value = []
    await refreshAll()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建上架任务失败'))
  } finally {
    operating.value = false
  }
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
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="refreshAll">
        刷新
      </el-button>
    </div>

    <div class="metric-row">
      <section class="metric-panel">
        <strong>{{ products.length }}</strong>
        <span>{{ statusCopy.label }}商品</span>
      </section>
      <section class="metric-panel">
        <strong>{{ selectedCount }}</strong>
        <span>已选择</span>
      </section>
      <section class="metric-panel">
        <strong>{{ Math.round(totalValue).toLocaleString() }}</strong>
        <span>当前页价格合计</span>
      </section>
    </div>

    <section class="work-panel">
      <div class="filter-row">
        <el-input v-model="filters.keyword" :prefix-icon="Search" clearable placeholder="商品标题、编号关键词" @keydown.enter="searchProducts" />
        <el-button type="primary" :icon="Search" @click="searchProducts">
          搜索
        </el-button>
        <el-button @click="resetFilters">
          重置
        </el-button>
      </div>

      <div class="action-bar">
        <el-button v-if="status === 'pending'" type="success" :icon="Finished" :loading="operating" @click="changeStatus('approved')">
          审核通过
        </el-button>
        <el-button v-if="status !== 'error'" type="warning" :icon="EditPen" :loading="operating" @click="markError">
          标记异常
        </el-button>
        <el-button v-if="status === 'error'" type="primary" :icon="Refresh" :loading="operating" @click="changeStatus('pending')">
          重新审核
        </el-button>
        <el-button v-if="status === 'approved'" type="primary" :icon="Plus" :loading="operating" @click="createListingTask">
          加入商品池
        </el-button>
        <el-button v-if="status === 'approved'" :icon="Upload" :loading="operating" @click="createListingTask">
          创建上架任务
        </el-button>
        <el-button type="danger" plain :icon="Delete" :loading="operating" @click="removeSelected">
          删除商品
        </el-button>
      </div>

      <div v-if="status === 'approved'" class="listing-row">
        <el-select v-model="listingForm.storeId" clearable filterable placeholder="选择上架店铺">
          <el-option v-for="store in stores" :key="store.id" :label="`${store.storeName} / ${store.storeCode}`" :value="store.id" />
        </el-select>
        <el-input v-model="listingForm.taskName" placeholder="上架任务名称，可留空" />
      </div>

      <el-table
        v-loading="loading"
        :data="pagedProducts"
        :empty-text="statusCopy.empty"
        height="620"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column label="图片" width="86">
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
        <el-table-column prop="itemNumber" label="商品ID" min-width="150" show-overflow-tooltip />
        <el-table-column prop="shopName" label="店铺" min-width="150" show-overflow-tooltip />
        <el-table-column label="价格(日元)" width="140">
          <template #default="{ row }">
            {{ priceText(row) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default>
            <el-tag :type="statusCopy.tag">
              {{ statusCopy.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastError" label="错误原因" min-width="190" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="来源" width="92" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" link type="primary" tag="a" :href="row.sourceUrl" target="_blank" rel="noreferrer">
              查看
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

.filter-row,
.listing-row {
  display: grid;
  gap: 12px;
}

.filter-row {
  margin-bottom: 12px;
  grid-template-columns: minmax(260px, 1fr) auto auto;
}

.listing-row {
  margin-bottom: 12px;
  grid-template-columns: minmax(220px, 0.6fr) minmax(260px, 1fr);
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
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
  .listing-row,
  .metric-row {
    grid-template-columns: 1fr;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
