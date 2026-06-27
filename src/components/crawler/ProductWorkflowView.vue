<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen, Finished, Plus, Refresh, Search, Top, Upload, View, Warning } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { ProductDetail, ProductItem, ProductVariant, ReviewStatus, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  status: ReviewStatus
  title: string
  eyebrow: string
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const operating = shallowRef(false)
const detailLoading = shallowRef(false)
const priceSaving = shallowRef(false)
const productTableRef = ref<{ clearSelection: () => void } | null>(null)
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const selectedIds = ref<number[]>([])
const detailVisible = shallowRef(false)
const priceVisible = shallowRef(false)
const selectedProductDetail = shallowRef<ProductDetail | null>(null)
const priceForm = reactive({
  productId: null as number | null,
  title: '',
  price: null as number | null,
})
const { currentPage, pageSize, pageSizes, paginationLayout, total, resetPage, setPageResult, reduceTotal } = useServerPagination()

const filters = reactive({
  keyword: '',
  storeId: null as number | null,
  listingStatus: '' as '' | 'listed' | 'unlisted',
  listedAtRange: [] as string[] | null,
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
    listed: { label: '店铺商品', tag: 'success', empty: '暂无店铺商品' },
    rejected: { label: '已拒绝', tag: 'danger', empty: '暂无拒绝商品' },
  }
  return map[props.status]
})

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

async function refreshAll(options: { loadStores?: boolean } = {}) {
  const loadStores = options.loadStores ?? true
  loading.value = true
  try {
    const storeValues = loadStores ? await api.listStores() : stores.value
    if (loadStores) {
      stores.value = storeValues
    }
    if (props.status === 'listed') {
      const selectedStoreExists = storeValues.some((store) => store.id === filters.storeId)
      if ((!filters.storeId || !selectedStoreExists) && storeValues.length > 0) {
        filters.storeId = storeValues[0].id
      }
      if (!filters.storeId) {
        products.value = []
        total.value = 0
        return
      }
    }
    const result = await api.listProductsPage({
      status: props.status,
      keyword: filters.keyword.trim(),
      storeId: props.status === 'listed' ? filters.storeId : null,
      listingStatus: props.status === 'listed' ? filters.listingStatus : '',
      listedAtFrom: props.status === 'listed' ? (filters.listedAtRange?.[0] || '') : '',
      listedAtTo: props.status === 'listed' ? (filters.listedAtRange?.[1] || '') : '',
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    products.value = result.items
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品失败'))
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.storeId = props.status === 'listed' ? (stores.value[0]?.id ?? null) : null
  filters.listingStatus = ''
  filters.listedAtRange = []
  resetPage()
  void refreshAll()
}

function searchProducts() {
  resetPage()
  void refreshAll()
}

function handlePageChange() {
  clearSelection()
  void refreshAll({ loadStores: false })
}

function handlePageSizeChange() {
  resetPage()
  clearSelection()
  void refreshAll({ loadStores: false })
}

function handleSelectionChange(rows: ProductItem[]) {
  selectedIds.value = rows.map((row) => row.id)
}

function clearSelection() {
  selectedIds.value = []
  productTableRef.value?.clearSelection()
}

function currentFiltersMatch(product: ProductItem) {
  if (props.status !== 'listed') {
    return true
  }
  if (filters.storeId && product.storeId !== filters.storeId) {
    return false
  }
  if (filters.listingStatus && product.rakutenListingStatus !== filters.listingStatus) {
    return false
  }
  return true
}

function mergeVisibleProducts(nextProducts: ProductItem[]) {
  if (nextProducts.length < 1) {
    return
  }
  const nextById = new Map(nextProducts.map((product) => [product.id, product]))
  products.value = products.value
    .map((product) => nextById.get(product.id) || product)
    .filter(currentFiltersMatch)
}

function removeVisibleProducts(productIds: number[]) {
  if (productIds.length < 1) {
    return
  }
  const ids = new Set(productIds)
  products.value = products.value.filter((product) => !ids.has(product.id))
  reduceTotal(ids.size)
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
    const deleteMessage = props.status === 'listed'
      ? `确认删除选中的 ${selectedIds.value.length} 个店铺商品？该操作会同步删除乐天商品，并尝试删除商品关联的 R-Cabinet 图片。`
      : `确认删除 ${selectedIds.value.length} 个商品？`
    await ElMessageBox.confirm(deleteMessage, '删除商品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    operating.value = true
    const result = await api.deleteProducts(selectedIds.value)
    if (result.summary.failedCount > 0) {
      ElMessage.warning(result.summary.message)
    } else {
      ElMessage.success(result.summary.message)
    }
    mergeVisibleProducts(result.products)
    removeVisibleProducts(result.deletedIds)
    clearSelection()
    if (products.value.length < 1 && total.value > 0) {
      void refreshAll({ loadStores: false })
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除商品失败'))
    }
  } finally {
    operating.value = false
  }
}

async function updateSelectedListingStatus(listingStatus: 'listed' | 'unlisted') {
  if (selectedIds.value.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  const actionText = listingStatus === 'listed' ? '上架' : '下架'
  try {
    await ElMessageBox.confirm(
      `确认将选中的 ${selectedIds.value.length} 个商品批量${actionText}？该操作会写入乐天 RMS。`,
      `批量${actionText}`,
      {
        confirmButtonText: actionText,
        cancelButtonText: '取消',
        type: listingStatus === 'listed' ? 'success' : 'warning',
      },
    )
    operating.value = true
    const result = await api.updateProductsListingStatus({
      productIds: selectedIds.value,
      listingStatus,
    })
    if (result.summary.failedCount > 0) {
      ElMessage.warning(result.summary.message)
    } else {
      ElMessage.success(result.summary.message)
    }
    mergeVisibleProducts(result.products)
    clearSelection()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, `批量${actionText}失败`))
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

function productCode(product: ProductItem) {
  return product.rakutenManageNumber || product.itemNumber || '-'
}

function listingStatusCopy(product: ProductItem) {
  if (product.rakutenListingStatus === 'unlisted') {
    return { label: '未上架', type: 'info' as const }
  }
  return { label: '已上架', type: 'success' as const }
}

async function openProductDetail(product: ProductItem) {
  detailVisible.value = true
  detailLoading.value = true
  selectedProductDetail.value = null
  try {
    selectedProductDetail.value = await api.getProductDetail(product.id)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品详情失败'))
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function openPriceDialog(product: ProductItem) {
  priceForm.productId = product.id
  priceForm.title = product.title
  priceForm.price = product.price ?? null
  priceVisible.value = true
}

async function submitPriceChange() {
  if (!priceForm.productId || priceForm.price == null || priceForm.price <= 0) {
    ElMessage.warning('请输入有效价格')
    return
  }
  try {
    await ElMessageBox.confirm('确认同步修改该商品在乐天 RMS 中的价格？', '修改价格', {
      confirmButtonText: '同步修改',
      cancelButtonText: '取消',
      type: 'warning',
    })
    priceSaving.value = true
    const product = await api.updateProductPrice(priceForm.productId, priceForm.price)
    products.value = products.value.map((item) => (item.id === product.id ? product : item))
    ElMessage.success('价格已同步到乐天')
    priceVisible.value = false
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '修改价格失败'))
    }
  } finally {
    priceSaving.value = false
  }
}

function compactText(value: unknown) {
  if (value == null || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function variantSelectorText(variant: ProductVariant) {
  const entries = Object.entries(variant.selectorValues || {})
  if (entries.length < 1) {
    return '-'
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join(' / ')
}

function rawJsonText(product: ProductDetail | null) {
  if (!product?.detail?.raw) {
    return '{}'
  }
  return JSON.stringify(product.detail.raw, null, 2)
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
      </div>
      <div class="head-actions">
        <div v-if="status === 'listed'" class="batch-action-group">
          <el-button type="success" plain :icon="Top" :loading="operating" @click="updateSelectedListingStatus('listed')">
            批量上架
          </el-button>
          <el-button type="warning" plain :icon="Warning" :loading="operating" @click="updateSelectedListingStatus('unlisted')">
            批量下架
          </el-button>
        </div>
        <el-button v-if="status === 'listed'" type="danger" plain :icon="Delete" :loading="operating" @click="removeSelected">
          批量删除
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="refreshAll">
          刷新
        </el-button>
      </div>
    </div>

    <section class="work-panel">
      <div class="filter-row" :class="{ 'filter-row-with-store': status === 'listed' }">
        <div v-if="status === 'listed'" class="filter-field filter-store-field">
          <el-select
            v-model="filters.storeId"
            class="full-control"
            filterable
            placeholder="选择店铺"
            @change="searchProducts"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="store.aliasName || store.storeName"
              :value="store.id"
            />
          </el-select>
        </div>
        <div v-if="status === 'listed'" class="filter-field filter-status-field">
          <el-select
            v-model="filters.listingStatus"
            class="full-control"
            clearable
            placeholder="上架状态"
            @change="searchProducts"
          >
            <el-option label="已上架" value="listed" />
            <el-option label="未上架" value="unlisted" />
          </el-select>
        </div>
        <div v-if="status === 'listed'" class="filter-field filter-range-field">
          <el-date-picker
            v-model="filters.listedAtRange"
            class="full-control"
            type="datetimerange"
            value-format="YYYY-MM-DDTHH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            range-separator="至"
            start-placeholder="上架开始时间"
            end-placeholder="上架结束时间"
            @change="searchProducts"
          />
        </div>
        <div class="filter-field filter-keyword-field">
          <el-input v-model="filters.keyword" class="full-control" :prefix-icon="Search" clearable placeholder="商品标题、编号关键词" @keydown.enter="searchProducts" />
        </div>
        <div class="filter-buttons">
          <el-button type="primary" :icon="Search" @click="searchProducts">
            搜索
          </el-button>
          <el-button @click="resetFilters">
            重置
          </el-button>
        </div>
      </div>

      <div v-if="status !== 'listed'" class="action-bar">
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
          <el-option v-for="store in stores" :key="store.id" :label="store.aliasName || store.storeName" :value="store.id" />
        </el-select>
        <el-input v-model="listingForm.taskName" placeholder="上架任务名称，可留空" />
      </div>

      <el-table
        ref="productTableRef"
        v-loading="loading"
        :data="products"
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
        <el-table-column label="商品管理编号" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            {{ productCode(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="shopName" label="店铺" min-width="150" show-overflow-tooltip />
        <el-table-column label="价格(日元)" width="140">
          <template #default="{ row }">
            {{ priceText(row) }}
          </template>
        </el-table-column>
        <el-table-column v-if="status === 'listed'" label="上架状态" width="120">
          <template #default="{ row }">
            <el-tag :type="listingStatusCopy(row).type">
              {{ listingStatusCopy(row).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="status !== 'listed'" label="状态" width="110">
          <template #default>
            <el-tag :type="statusCopy.tag">
              {{ statusCopy.label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="status !== 'listed'" prop="lastError" label="错误原因" min-width="190" show-overflow-tooltip />
        <el-table-column v-if="status === 'listed'" prop="listedAt" label="上架时间" min-width="170" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" link type="primary" @click="openProductDetail(row)">
              查看详情
            </el-button>
            <el-button v-if="status === 'listed'" :icon="EditPen" link type="warning" @click="openPriceDialog(row)">
              修改价格
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
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="detailVisible" title="商品详情" width="980px" append-to-body>
      <div v-loading="detailLoading" class="detail-dialog">
        <template v-if="selectedProductDetail">
          <div class="detail-hero">
            <el-image
              v-if="selectedProductDetail.imageUrl"
              class="detail-cover"
              :src="selectedProductDetail.imageUrl"
              fit="cover"
              :preview-src-list="selectedProductDetail.detail.images.length ? selectedProductDetail.detail.images : [selectedProductDetail.imageUrl]"
              preview-teleported
            />
            <div v-else class="detail-cover detail-cover-empty">无图</div>
            <div class="detail-main">
              <h2>{{ selectedProductDetail.title }}</h2>
              <p v-if="selectedProductDetail.detail.tagline" class="detail-subtitle">
                {{ selectedProductDetail.detail.tagline }}
              </p>
              <div class="detail-meta">
                <span>商品管理编号：{{ compactText(selectedProductDetail.detail.manageNumber) }}</span>
                <span>商品编号：{{ compactText(selectedProductDetail.detail.itemNumber) }}</span>
                <span>店铺：{{ compactText(selectedProductDetail.detail.shopName) }}</span>
                <span>价格：{{ priceText(selectedProductDetail) }}</span>
                <span>上架时间：{{ compactText(selectedProductDetail.listedAt) }}</span>
                <span>更新时间：{{ compactText(selectedProductDetail.updatedAt) }}</span>
              </div>
              <el-button :icon="View" link type="primary" tag="a" :href="selectedProductDetail.sourceUrl" target="_blank" rel="noreferrer">
                打开乐天商品页
              </el-button>
            </div>
          </div>

          <el-tabs class="detail-tabs">
            <el-tab-pane label="款式 SKU">
              <el-table :data="selectedProductDetail.detail.variants" border max-height="300" empty-text="暂无款式数据">
                <el-table-column prop="variantId" label="SKU ID" min-width="150" show-overflow-tooltip />
                <el-table-column prop="merchantDefinedSkuId" label="商家 SKU" min-width="150" show-overflow-tooltip />
                <el-table-column label="款式选项" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ variantSelectorText(row) }}
                  </template>
                </el-table-column>
                <el-table-column prop="standardPrice" label="价格(日元)" width="120" />
                <el-table-column label="隐藏" width="90">
                  <template #default="{ row }">
                    {{ row.hidden ? '是' : '否' }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="图片">
              <div class="detail-images">
                <el-image
                  v-for="image in selectedProductDetail.detail.images"
                  :key="image"
                  class="detail-thumb"
                  :src="image"
                  fit="cover"
                  :preview-src-list="selectedProductDetail.detail.images"
                  preview-teleported
                />
                <el-empty v-if="selectedProductDetail.detail.images.length < 1" description="暂无图片数据" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="商品说明">
              <div class="description-list">
                <div v-for="description in selectedProductDetail.detail.descriptions" :key="description.label" class="description-item">
                  <strong>{{ description.label }}</strong>
                  <p>{{ description.value }}</p>
                </div>
                <el-empty v-if="selectedProductDetail.detail.descriptions.length < 1" description="暂无商品说明" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="原始数据">
              <pre class="raw-json">{{ rawJsonText(selectedProductDetail) }}</pre>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-dialog>

    <el-dialog v-model="priceVisible" title="修改商品价格" width="460px" append-to-body>
      <el-form label-position="top">
        <el-form-item label="商品">
          <el-input :model-value="priceForm.title" disabled />
        </el-form-item>
        <el-form-item label="新价格（日元）">
          <el-input-number v-model="priceForm.price" class="full-control" :min="1" :precision="0" :step="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priceVisible = false">取消</el-button>
        <el-button type="primary" :loading="priceSaving" @click="submitPriceChange">
          同步修改
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

.head-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.batch-action-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-action-group :deep(.el-button + .el-button) {
  margin-left: 0;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.work-panel {
  padding: 18px;
}

.filter-row {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.filter-field {
  min-width: 0;
}

.filter-store-field {
  flex: 0 1 170px;
}

.filter-status-field {
  flex: 0 1 140px;
}

.filter-range-field {
  flex: 1 1 360px;
  max-width: 430px;
  min-width: 300px;
}

.filter-keyword-field {
  flex: 1 1 280px;
  max-width: 520px;
  min-width: 220px;
}

.filter-row:not(.filter-row-with-store) .filter-keyword-field {
  max-width: none;
}

.filter-buttons {
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
}

.full-control {
  width: 100%;
}

.listing-row {
  display: grid;
  gap: 12px;
}

.listing-row {
  margin-bottom: 12px;
  grid-template-columns: minmax(180px, 0.6fr) minmax(0, 1fr);
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

.detail-dialog {
  min-height: 260px;
}

.detail-hero {
  display: grid;
  grid-template-columns: 156px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.detail-cover {
  width: 156px;
  height: 156px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-muted);
}

.detail-cover-empty {
  display: grid;
  place-items: center;
  color: var(--text-faint);
}

.detail-main {
  min-width: 0;
}

.detail-main h2 {
  margin: 0 0 8px;
  color: var(--text-main);
  font-size: 20px;
  line-height: 1.45;
}

.detail-subtitle {
  margin: 0 0 12px;
  color: var(--text-muted);
  line-height: 1.6;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

.detail-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-tabs {
  margin-top: 18px;
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 12px;
}

.detail-thumb {
  width: 92px;
  height: 92px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
}

.description-list {
  display: grid;
  gap: 12px;
  max-height: 340px;
  overflow: auto;
}

.description-item {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--panel-muted);
}

.description-item strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-main);
}

.description-item p {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.7;
  white-space: pre-wrap;
}

.raw-json {
  max-height: 360px;
  margin: 0;
  overflow: auto;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--panel-muted);
  color: var(--text-main);
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 1180px) {
  .filter-range-field,
  .filter-keyword-field {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .filter-field,
  .filter-buttons,
  .listing-row {
    width: 100%;
  }

  .filter-field,
  .filter-buttons {
    flex: 1 1 100%;
    min-width: 0;
  }

  .filter-buttons .el-button {
    flex: 1;
  }

  .listing-row {
    grid-template-columns: 1fr;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-hero,
  .detail-meta {
    grid-template-columns: 1fr;
  }

  .detail-cover {
    width: 120px;
    height: 120px;
  }
}
</style>
