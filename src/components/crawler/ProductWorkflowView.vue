<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, EditPen, Finished, Refresh, Search, Top, Upload, View, Warning } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { ListingTask, ProductDetail, ProductItem, ProductVariant, ProductVariantEditPayload, RakutenListingStatus, ReviewStatus, StoreAccount, SyncTask } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CopyableTableText from './CopyableTableText.vue'

type PendingImageOperation =
  | { type: 'replace'; sourceUrl: string; file: File; previewUrl: string }
  | { type: 'delete'; sourceUrl: string }

interface ImageDraftItem {
  sourceIndex: number
  sourceUrl: string
  currentUrl: string
}

const props = defineProps<{
  status: ReviewStatus
  title: string
  eyebrow: string
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const operating = shallowRef(false)
const detailLoading = shallowRef(false)
const detailSaving = shallowRef(false)
const imageOperating = shallowRef(false)
const productTableRef = ref<{ clearSelection: () => void } | null>(null)
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const selectedIds = ref<number[]>([])
const hiddenProducts = shallowRef<Map<number, ProductItem>>(new Map())
const optimisticProductSnapshots = shallowRef<Map<number, ProductItem>>(new Map())
const detailVisible = shallowRef(false)
const selectedProductDetail = shallowRef<ProductDetail | null>(null)
const listingProductIds = shallowRef<Set<number>>(new Set())
const detailImageDraft = shallowRef<ImageDraftItem[]>([])
const draftPreviewUrls = shallowRef<Set<string>>(new Set())
const pendingImageOperations = shallowRef<PendingImageOperation[]>([])
const detailForm = reactive({
  productId: null as number | null,
  title: '',
  tagline: '',
  variants: [] as ProductVariantEditPayload[],
})
const replacingImageIndex = shallowRef<number | null>(null)
const { currentPage, pageSize, pageSizes, paginationLayout, total, resetPage, setPageResult, reduceTotal } = useServerPagination()

const filters = reactive({
  keyword: '',
  priceMin: null as number | null,
  priceMax: null as number | null,
  collectedAtRange: [] as string[] | null,
  storeId: null as number | null,
  listingStatus: '' as '' | 'listed' | 'unlisted',
  listedAtRange: [] as string[] | null,
})

const listingForm = reactive({
  storeId: null as number | null,
  taskName: '',
})
const listingDialogVisible = shallowRef(false)
const listingDialogProductIds = shallowRef<number[]>([])
const listingDialogTitle = shallowRef('上架商品')

const statusCopy = computed(() => {
  const map: Record<ReviewStatus, { label: string; tag: 'success' | 'warning' | 'danger' | 'info'; empty: string }> = {
    pending: { label: '待审核', tag: 'warning', empty: '暂无待审核商品' },
    approved: { label: '已审核', tag: 'success', empty: '暂无已审核商品' },
    error: { label: '异常', tag: 'danger', empty: '暂无异常商品' },
    listing: { label: '上架中', tag: 'info', empty: '暂无上架中商品' },
    listed: { label: '店铺商品', tag: 'success', empty: '暂无店铺商品' },
    listed_master: { label: '已上架', tag: 'success', empty: '暂无已上架商品' },
    rejected: { label: '已拒绝', tag: 'danger', empty: '暂无拒绝商品' },
  }
  return map[props.status]
})

const visibleProducts = computed(() => {
  if (!['approved', 'listed', 'listed_master'].includes(props.status) || hiddenProducts.value.size < 1) {
    return products.value
  }
  return products.value.filter((product) => !hiddenProducts.value.has(product.id))
})

onMounted(() => {
  void refreshAll()
})

watch(
  () => props.status,
  () => {
    selectedIds.value = []
    hiddenProducts.value = new Map()
    optimisticProductSnapshots.value = new Map()
    resetPage()
    void refreshAll()
  },
)

watch(
  () => detailVisible.value,
  (visible) => {
    if (!visible) {
      resetImageDraft()
      resetDetailForm()
      selectedProductDetail.value = null
    }
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
    if (props.status !== 'listed') {
      filters.storeId = null
    }
    const result = await api.listProductsPage({
      status: props.status,
      keyword: filters.keyword.trim(),
      storeId: props.status === 'listed' ? filters.storeId : null,
      listingStatus: props.status === 'listed' ? filters.listingStatus : '',
      listedAtFrom: props.status === 'listed' ? listedAtFromValue() : '',
      listedAtTo: props.status === 'listed' ? listedAtToValue() : '',
      priceMin: props.status !== 'listed' ? filters.priceMin : null,
      priceMax: props.status !== 'listed' ? filters.priceMax : null,
      collectedAtFrom: props.status !== 'listed' ? collectedAtFromValue() : '',
      collectedAtTo: props.status !== 'listed' ? collectedAtToValue() : '',
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    products.value = result.items
    reconcileHiddenProducts(result.items)
    setPageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品失败'))
  } finally {
    loading.value = false
  }
}

function reconcileHiddenProducts(nextProducts: ProductItem[]) {
  if (hiddenProducts.value.size < 1) {
    return
  }
  const nextIds = new Set(nextProducts.map((product) => product.id))
  const nextHidden = new Map(hiddenProducts.value)
  for (const productId of nextHidden.keys()) {
    if (!nextIds.has(productId)) {
      nextHidden.delete(productId)
    }
  }
  hiddenProducts.value = nextHidden
}

function resetFilters() {
  filters.keyword = ''
  filters.priceMin = null
  filters.priceMax = null
  filters.collectedAtRange = []
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

function listedAtFromValue() {
  const value = filters.listedAtRange?.[0] || ''
  return value ? `${value}T00:00:00` : ''
}

function listedAtToValue() {
  const value = filters.listedAtRange?.[1] || ''
  return value ? `${value}T23:59:59` : ''
}

function collectedAtFromValue() {
  const value = filters.collectedAtRange?.[0] || ''
  return value ? `${value}T00:00:00` : ''
}

function collectedAtToValue() {
  const value = filters.collectedAtRange?.[1] || ''
  return value ? `${value}T23:59:59` : ''
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
  const beforeCount = products.value.length
  products.value = products.value.filter((product) => !ids.has(product.id))
  reduceTotal(beforeCount - products.value.length)
}

function rememberProductSnapshots(productIds: number[]) {
  if (productIds.length < 1) {
    return
  }
  const ids = new Set(productIds)
  const nextSnapshots = new Map(optimisticProductSnapshots.value)
  for (const product of products.value) {
    if (ids.has(product.id) && !nextSnapshots.has(product.id)) {
      nextSnapshots.set(product.id, { ...product })
    }
  }
  optimisticProductSnapshots.value = nextSnapshots
}

function restoreProductSnapshots(productIds: number[]) {
  if (productIds.length < 1 || optimisticProductSnapshots.value.size < 1) {
    return
  }
  const ids = new Set(productIds)
  const nextSnapshots = new Map(optimisticProductSnapshots.value)
  const restoredProducts: ProductItem[] = []
  for (const productId of ids) {
    const snapshot = nextSnapshots.get(productId)
    if (snapshot) {
      restoredProducts.push(snapshot)
      nextSnapshots.delete(productId)
    }
  }
  if (restoredProducts.length > 0) {
    const beforeCount = products.value.length
    const restoredById = new Map(restoredProducts.map((product) => [product.id, product]))
    const existingIds = new Set(products.value.map((product) => product.id))
    const missingRestoredProducts = restoredProducts.filter((product) => !existingIds.has(product.id))
    products.value = [
      ...missingRestoredProducts,
      ...products.value.map((product) => restoredById.get(product.id) || product),
    ].filter(currentFiltersMatch)
    if (products.value.length > beforeCount) {
      total.value += products.value.length - beforeCount
    }
  }
  optimisticProductSnapshots.value = nextSnapshots
}

function clearProductSnapshots(productIds: number[]) {
  if (productIds.length < 1 || optimisticProductSnapshots.value.size < 1) {
    return
  }
  const ids = new Set(productIds)
  const nextSnapshots = new Map(optimisticProductSnapshots.value)
  for (const productId of ids) {
    nextSnapshots.delete(productId)
  }
  optimisticProductSnapshots.value = nextSnapshots
}

function applyOptimisticListingStatus(productIds: number[], listingStatus: RakutenListingStatus) {
  if (productIds.length < 1) {
    return
  }
  rememberProductSnapshots(productIds)
  const ids = new Set(productIds)
  const beforeCount = products.value.length
  products.value = products.value
    .map((product) => (ids.has(product.id) ? { ...product, rakutenListingStatus: listingStatus } : product))
    .filter(currentFiltersMatch)
  reduceTotal(beforeCount - products.value.length)
  if (selectedProductDetail.value && ids.has(selectedProductDetail.value.id)) {
    selectedProductDetail.value = { ...selectedProductDetail.value, rakutenListingStatus: listingStatus }
  }
  selectedIds.value = selectedIds.value.filter((productId) => !ids.has(productId))
}

function hideProducts(productIds: number[]) {
  if (!['approved', 'listed', 'listed_master'].includes(props.status) || productIds.length < 1) {
    return
  }
  const ids = new Set(productIds)
  const nextHidden = new Map(hiddenProducts.value)
  for (const product of products.value) {
    if (ids.has(product.id)) {
      nextHidden.set(product.id, product)
    }
  }
  hiddenProducts.value = nextHidden
  selectedIds.value = selectedIds.value.filter((productId) => !ids.has(productId))
}

function restoreHiddenProducts(productIds: number[]) {
  if (productIds.length < 1 || hiddenProducts.value.size < 1) {
    return
  }
  const ids = new Set(productIds)
  const nextHidden = new Map(hiddenProducts.value)
  for (const productId of ids) {
    nextHidden.delete(productId)
  }
  hiddenProducts.value = nextHidden
}

function clearHiddenProducts(productIds: number[]) {
  if (productIds.length < 1 || hiddenProducts.value.size < 1) {
    return
  }
  restoreHiddenProducts(productIds)
  removeVisibleProducts(productIds)
}

function productDisplayName(product: ProductItem) {
  return product.title || productCode(product)
}

function reviewStatusLabel(status: ReviewStatus) {
  const labels: Record<string, string> = {
    pending: '待审核',
    approved: '已审核',
    error: '异常',
    listed: '已上架',
    listed_master: '已上架',
    rejected: '已拒绝',
  }
  return labels[status] || status
}

async function applyReviewStatus(productIds: number[], status: ReviewStatus, message = '') {
  if (productIds.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  operating.value = true
  try {
    const updatedProducts = await api.updateProductStatus({ productIds, status, message })
    if (status === props.status) {
      mergeVisibleProducts(updatedProducts)
    } else {
      removeVisibleProducts(productIds)
    }
    clearSelection()
    ElMessage.success('商品状态已更新')
    if (products.value.length < 1 && total.value > 0) {
      void refreshAll({ loadStores: false })
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新商品状态失败'))
  } finally {
    operating.value = false
  }
}

async function confirmReviewStatus(productIds: number[], status: ReviewStatus, options?: {
  title?: string
  message?: string
  confirmButtonText?: string
  type?: 'success' | 'warning' | 'info' | 'error'
}) {
  if (productIds.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  const label = reviewStatusLabel(status)
  try {
    await ElMessageBox.confirm(
      options?.message || `确认将选中的 ${productIds.length} 个商品改为「${label}」？该操作只修改本地数据库。`,
      options?.title || label,
      {
        confirmButtonText: options?.confirmButtonText || '确定',
        cancelButtonText: '取消',
        type: options?.type || 'warning',
      },
    )
    await applyReviewStatus(productIds, status)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, `${label}失败`))
    }
  }
}

async function approveSelected() {
  await confirmReviewStatus(selectedIds.value, 'approved', {
    title: '批量审核通过',
    message: `确认将选中的 ${selectedIds.value.length} 个商品批量审核通过？该操作只修改本地数据库。`,
    confirmButtonText: '审核通过',
    type: 'success',
  })
}

async function approveProduct(product: ProductItem) {
  await confirmReviewStatus([product.id], 'approved', {
    title: '审核通过',
    message: `确认将商品「${productDisplayName(product)}」审核通过？该操作只修改本地数据库。`,
    confirmButtonText: '审核通过',
    type: 'success',
  })
}

async function recheckSelected() {
  await confirmReviewStatus(selectedIds.value, 'pending', {
    title: '重新审核',
    message: `确认将选中的 ${selectedIds.value.length} 个异常商品移回待审核商品？该操作只修改本地数据库。`,
    confirmButtonText: '重新审核',
    type: 'warning',
  })
}

async function markError(productIds = selectedIds.value, product?: ProductItem) {
  if (productIds.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      product
        ? `确认将商品「${productDisplayName(product)}」标记为异常？该操作只修改本地数据库。`
        : `确认将选中的 ${productIds.length} 个商品批量标记为异常？该操作只修改本地数据库。`,
      product ? '标记异常' : '批量标记异常',
      {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：标题缺失、图片不可用、价格不合理',
      },
    )
    await applyReviewStatus(productIds, 'error', result.value)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '标记异常失败'))
    }
  }
}

async function removeProducts(productIds: number[], product?: ProductItem) {
  if (productIds.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  const shouldOptimisticHide = props.status === 'listed'
  try {
    const deleteMessage = props.status === 'listed'
      ? `确认删除选中的 ${productIds.length} 个店铺商品？该操作会同步删除乐天商品，并尝试删除商品关联的 R-Cabinet 图片。`
      : product
        ? `确认删除商品「${productDisplayName(product)}」？该操作会删除本地数据库记录和本地图片文件。`
        : `确认批量删除选中的 ${productIds.length} 个商品？该操作会删除本地数据库记录和本地图片文件。`
    await ElMessageBox.confirm(deleteMessage, '删除商品', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    if (shouldOptimisticHide) {
      hideProducts(productIds)
      clearSelection()
    }
    operating.value = true
    const result = await api.deleteProducts(productIds)
    if (result.syncTask) {
      ElMessage.success(syncTaskCreatedMessage(result.syncTask, result.summary.message || '批量删除任务已创建'))
      clearSelection()
      watchDeleteSyncTaskCompletion(result.syncTask.id, productIds)
      return
    }
    if (result.summary.failedCount > 0) {
      ElMessage.warning(result.summary.message)
    } else {
      ElMessage.success(result.summary.message)
    }
    mergeVisibleProducts(result.products || [])
    if (shouldOptimisticHide) {
      clearHiddenProducts(result.deletedIds?.length ? result.deletedIds : productIds)
    } else {
      removeVisibleProducts(result.deletedIds || [])
    }
    clearSelection()
    if (products.value.length < 1 && total.value > 0) {
      void refreshAll({ loadStores: false })
    }
  } catch (error) {
    if (error !== 'cancel') {
      if (shouldOptimisticHide) {
        restoreHiddenProducts(productIds)
      }
      ElMessage.error(toApiErrorMessage(error, '删除商品失败'))
    }
  } finally {
    operating.value = false
  }
}

async function removeSelected() {
  await removeProducts(selectedIds.value)
}

async function removeProduct(product: ProductItem) {
  await removeProducts([product.id], product)
}

async function updateSelectedListingStatus(listingStatus: 'listed' | 'unlisted') {
  if (selectedIds.value.length < 1) {
    ElMessage.warning('请先选择商品')
    return
  }
  const productIds = [...selectedIds.value]
  const actionText = listingStatus === 'listed' ? '上架' : '下架'
  try {
    await ElMessageBox.confirm(
      `确认将选中的 ${productIds.length} 个商品批量${actionText}？该操作会写入乐天 RMS。`,
      `批量${actionText}`,
      {
        confirmButtonText: actionText,
        cancelButtonText: '取消',
        type: listingStatus === 'listed' ? 'success' : 'warning',
      },
    )
    applyOptimisticListingStatus(productIds, listingStatus)
    clearSelection()
    operating.value = true
    const result = await api.updateProductsListingStatus({
      productIds,
      listingStatus,
    })
    ElMessage.success(syncTaskCreatedMessage(result.syncTask, result.summary.message || `批量${actionText}任务已创建`))
    watchListingStatusSyncTaskCompletion(result.syncTask.id, productIds, listingStatus)
  } catch (error) {
    if (error !== 'cancel') {
      restoreProductSnapshots(productIds)
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
  const productIds = [...selectedIds.value]
  if (productIds.some((productId) => listingProductIds.value.has(productId))) {
    ElMessage.warning('选中的商品正在创建上架任务，请稍后')
    return
  }
  openListingDialog(productIds, props.status === 'listed_master' ? '批量重新上架' : '批量上架')
}

async function submitListingTask() {
  const productIds = [...listingDialogProductIds.value]
  if (productIds.length < 1) {
    ElMessage.warning('请先选择要上架的商品')
    return
  }
  if (!listingForm.storeId) {
    ElMessage.warning('请先选择上架店铺')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认将选中的 ${productIds.length} 个商品创建${props.status === 'listed_master' ? '重新上架' : '上架'}任务？`,
      listingDialogTitle.value,
      {
        confirmButtonText: props.status === 'listed_master' ? '重新上架' : '上架',
        cancelButtonText: '取消',
        type: 'success',
      },
    )
  } catch (error) {
    return
  }
  operating.value = true
  setListingProductsBusy(productIds, true)
  if (shouldHideAfterListingTask()) {
    hideProducts(productIds)
  }
  clearSelection()
  try {
    const result = await api.createListingTask({
      productIds,
      storeId: listingForm.storeId,
      taskName: listingForm.taskName.trim(),
    })
    listingDialogVisible.value = false
    handleListingTaskResult(result.listingTask, productIds)
    maybeRefreshAfterOptimisticAction()
  } catch (error) {
    setListingProductsBusy(productIds, false)
    if (shouldHideAfterListingTask()) {
      restoreHiddenProducts(productIds)
    }
    ElMessage.error(toApiErrorMessage(error, '创建上架任务失败'))
  } finally {
    if (!shouldKeepBusyAfterListingTask()) {
      setListingProductsBusy(productIds, false)
    }
    operating.value = false
  }
}

async function createListingTaskForProduct(product: ProductItem) {
  if (listingProductIds.value.has(product.id)) {
    ElMessage.warning('该商品正在创建上架任务，请稍后')
    return
  }
  openListingDialog([product.id], props.status === 'listed_master' ? `重新上架「${productDisplayName(product)}」` : `上架「${productDisplayName(product)}」`)
}

function openListingDialog(productIds: number[], title: string) {
  listingDialogProductIds.value = [...productIds]
  listingDialogTitle.value = title
  listingForm.storeId = null
  listingForm.taskName = ''
  listingDialogVisible.value = true
}

function shouldHideAfterListingTask() {
  return props.status === 'approved'
}

function shouldKeepBusyAfterListingTask() {
  return props.status === 'approved' || props.status === 'listed_master'
}

function setListingProductsBusy(productIds: number[], busy: boolean) {
  if (productIds.length < 1) {
    return
  }
  const next = new Set(listingProductIds.value)
  for (const productId of productIds) {
    if (busy) {
      next.add(productId)
    } else {
      next.delete(productId)
    }
  }
  listingProductIds.value = next
}

function isListingProductBusy(product: ProductItem) {
  return listingProductIds.value.has(product.id) || Boolean(product.listingTaskId)
}

function hasSelectedListingProductBusy() {
  const selectedIdSet = new Set(selectedIds.value)
  return visibleProducts.value.some((product) => selectedIdSet.has(product.id) && isListingProductBusy(product))
}

function isProductSelectable(product: ProductItem) {
  return !isListingProductBusy(product)
}

function productRowClassName({ row }: { row: ProductItem }) {
  return isListingProductBusy(row) ? 'product-row-disabled' : ''
}

function taskOutcomeIds(task: Pick<ListingTask | SyncTask, 'status' | 'successIds' | 'failedIds'>, productIds: number[]) {
  if (task.status === 'success') {
    return { successIds: task.successIds?.length ? task.successIds : productIds, failedIds: [] }
  }
  if (task.status === 'failed') {
    return { successIds: [], failedIds: task.failedIds?.length ? task.failedIds : productIds }
  }
  const failedIdSet = new Set(task.failedIds || [])
  const successIds = task.successIds?.length ? task.successIds : productIds.filter((productId) => !failedIdSet.has(productId))
  const successIdSet = new Set(successIds)
  const failedIds = task.failedIds?.length ? task.failedIds : productIds.filter((productId) => !successIdSet.has(productId))
  return { successIds, failedIds }
}

function handleListingTaskResult(task: ListingTask, productIds: number[]) {
  if (task.status === 'success') {
    clearListingTaskBusy(productIds)
    if (shouldHideAfterListingTask()) {
      clearHiddenProducts(task.successIds?.length ? task.successIds : productIds)
    } else {
      void refreshAll({ loadStores: false })
    }
    ElMessage.success(task.message || '上架任务已完成')
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'partial') {
    const { successIds, failedIds } = taskOutcomeIds(task, productIds)
    clearListingTaskBusy(productIds)
    if (shouldHideAfterListingTask()) {
      clearHiddenProducts(successIds)
      restoreHiddenProducts(failedIds)
    } else {
      void refreshAll({ loadStores: false })
    }
    ElMessage.warning(task.message || '上架任务部分成功，请到上架任务中查看异常信息')
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'failed') {
    clearListingTaskBusy(productIds)
    if (shouldHideAfterListingTask()) {
      restoreHiddenProducts(productIds)
    } else {
      void refreshAll({ loadStores: false })
    }
    ElMessage.error(task.errorDetail || task.message || '上架任务执行失败，请到上架任务中查看错误信息')
    return
  }
  if (shouldHideAfterListingTask()) {
    hideProducts(productIds)
  }
  watchListingTaskCompletion(task.id, productIds)
  ElMessage.success('上架任务已创建，请到上架任务中查看进度')
}

function watchListingTaskCompletion(taskId: string, productIds: number[]) {
  if (!taskId || !['approved', 'listed_master'].includes(props.status)) {
    return
  }
  let attempts = 0
  const timer = window.setInterval(async () => {
    attempts += 1
    try {
      const tasks = await api.listListingTasks()
      const task = tasks.find((item) => item.id === taskId)
      if (!task) {
        return
      }
      if (['queued', 'running'].includes(task.status) && attempts < 60) {
        return
      }
      window.clearInterval(timer)
      if (['queued', 'running'].includes(task.status)) {
        await refreshAll({ loadStores: false })
      } else {
        handleListingTaskResult(task, productIds)
      }
    } catch {
      if (attempts >= 3) {
        window.clearInterval(timer)
        clearListingTaskBusy(productIds)
        if (shouldHideAfterListingTask()) {
          restoreHiddenProducts(productIds)
        }
      }
    }
  }, 2000)
}

function clearListingTaskBusy(productIds: number[]) {
  setListingProductsBusy(productIds, false)
}

function syncTaskCreatedMessage(task: SyncTask | undefined, fallback: string) {
  if (!task) {
    return fallback
  }
  return `${fallback}，请到同步任务中查看进度`
}

function watchDeleteSyncTaskCompletion(taskId: string, productIds: number[]) {
  if (!taskId || props.status !== 'listed') {
    return
  }
  let attempts = 0
  const timer = window.setInterval(async () => {
    attempts += 1
    try {
      const tasks = await api.listSyncTasks()
      const task = tasks.find((item) => item.id === taskId)
      if (!task) {
        return
      }
      if (['queued', 'running'].includes(task.status) && attempts < 60) {
        return
      }
      window.clearInterval(timer)
      handleDeleteSyncTaskResult(task, productIds)
    } catch {
      if (attempts >= 3) {
        window.clearInterval(timer)
        restoreHiddenProducts(productIds)
      }
    }
  }, 2000)
}

function watchListingStatusSyncTaskCompletion(taskId: string, productIds: number[], listingStatus: RakutenListingStatus) {
  if (!taskId || props.status !== 'listed') {
    return
  }
  let attempts = 0
  const timer = window.setInterval(async () => {
    attempts += 1
    try {
      const tasks = await api.listSyncTasks()
      const task = tasks.find((item) => item.id === taskId)
      if (!task) {
        return
      }
      if (['queued', 'running'].includes(task.status) && attempts < 60) {
        return
      }
      window.clearInterval(timer)
      handleListingStatusSyncTaskResult(task, productIds, listingStatus)
    } catch {
      if (attempts >= 3) {
        window.clearInterval(timer)
        restoreProductSnapshots(productIds)
      }
    }
  }, 2000)
}

function handleListingStatusSyncTaskResult(task: SyncTask, productIds: number[], listingStatus: RakutenListingStatus) {
  const actionText = listingStatus === 'listed' ? '上架' : '下架'
  if (task.status === 'success') {
    clearProductSnapshots(task.successIds?.length ? task.successIds : productIds)
    ElMessage.success(task.message || `批量${actionText}已完成`)
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'partial') {
    const { successIds, failedIds } = taskOutcomeIds(task, productIds)
    clearProductSnapshots(successIds)
    restoreProductSnapshots(failedIds)
    ElMessage.warning(task.errorDetail || task.message || `批量${actionText}部分成功，请到同步任务中查看异常信息`)
    maybeRefreshAfterOptimisticAction()
    return
  }
  restoreProductSnapshots(productIds)
  ElMessage.error(task.errorDetail || task.message || `批量${actionText}失败，请到同步任务中查看错误信息`)
}

function handleDeleteSyncTaskResult(task: SyncTask, productIds: number[]) {
  if (task.status === 'success') {
    clearHiddenProducts(task.successIds?.length ? task.successIds : productIds)
    ElMessage.success(task.message || '批量删除已完成')
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'partial') {
    const { successIds, failedIds } = taskOutcomeIds(task, productIds)
    clearHiddenProducts(successIds)
    restoreHiddenProducts(failedIds)
    ElMessage.warning(task.errorDetail || task.message || '批量删除部分成功，请到同步任务中查看异常信息')
    maybeRefreshAfterOptimisticAction()
    return
  }
  restoreHiddenProducts(productIds)
  ElMessage.error(task.errorDetail || task.message || '批量删除失败，请到同步任务中查看错误信息')
}

function maybeRefreshAfterOptimisticAction() {
  if (visibleProducts.value.length < 1 && total.value > 0) {
    void refreshAll({ loadStores: false })
  }
}

function priceText(product: ProductItem) {
  const minPrice = product.priceMin ?? product.price
  const maxPrice = product.priceMax ?? product.price
  if (minPrice == null) {
    return '-'
  }
  const currency = product.currency || 'JPY'
  const normalizedMin = Number(minPrice)
  const normalizedMax = maxPrice == null ? normalizedMin : Number(maxPrice)
  if (Number.isFinite(normalizedMin) && Number.isFinite(normalizedMax) && normalizedMin !== normalizedMax) {
    return `${currency} ${normalizedMin.toLocaleString()} - ${normalizedMax.toLocaleString()}`
  }
  return `${currency} ${normalizedMin.toLocaleString()}`
}

function productCode(product: ProductItem) {
  return product.rakutenManageNumber || product.itemNumber || '-'
}

function storeDisplayName(product: ProductItem) {
  const store = stores.value.find((item) => item.id === product.storeId)
  return store?.aliasName || product.shopName || '-'
}

function storeRealName(product: ProductItem) {
  const store = stores.value.find((item) => item.id === product.storeId)
  return store?.storeName || product.shopName || '-'
}

function listedStoreLabel(store: { storeId: number; storeName?: string; aliasName?: string }) {
  const current = stores.value.find((item) => item.id === store.storeId)
  return current?.aliasName || store.aliasName || current?.storeName || store.storeName || `店铺 ${store.storeId}`
}

function listedStoreRealName(store: { storeId: number; storeName?: string; aliasName?: string }) {
  const current = stores.value.find((item) => item.id === store.storeId)
  return current?.storeName || store.storeName || listedStoreLabel(store)
}

function listingStatusCopy(product: ProductItem) {
  if (product.rakutenListingStatus === 'unlisted') {
    return { label: '未上架', type: 'info' as const }
  }
  if (product.rakutenListingStatus === 'listed') {
    return { label: '已上架', type: 'success' as const }
  }
  return { label: '未检测', type: 'info' as const }
}

async function openProductDetail(product: ProductItem) {
  detailVisible.value = true
  detailLoading.value = true
  selectedProductDetail.value = null
  resetDetailForm()
  resetImageDraft()
  try {
    const detail = await api.getProductDetail(product.id)
    selectedProductDetail.value = detail
    fillDetailForm(detail)
    fillImageDraft(detail)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载商品详情失败'))
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function resetDetailForm() {
  detailForm.productId = null
  detailForm.title = ''
  detailForm.tagline = ''
  detailForm.variants = []
}

function clearDraftPreviewUrls() {
  for (const url of draftPreviewUrls.value) {
    URL.revokeObjectURL(url)
  }
  draftPreviewUrls.value = new Set()
}

function resetImageDraft() {
  clearDraftPreviewUrls()
  detailImageDraft.value = []
  pendingImageOperations.value = []
  replacingImageIndex.value = null
}

function fillDetailForm(product: ProductDetail) {
  detailForm.productId = product.id
  detailForm.title = product.detail.title || product.title || ''
  detailForm.tagline = product.detail.tagline || ''
  detailForm.variants = product.detail.variants.map((variant) => ({
    variantId: variant.variantId,
    standardPrice: Number(variant.standardPrice || 0),
    hidden: Boolean(variant.hidden),
  }))
}

function fillImageDraft(product: ProductDetail) {
  detailImageDraft.value = detailImageUrlsFromProduct(product).map((url, index) => ({ sourceIndex: index, sourceUrl: url, currentUrl: url }))
}

function detailVariantForm(variant: ProductVariant) {
  return detailForm.variants.find((item) => item.variantId === variant.variantId)
}

function detailEditable() {
  return props.status === 'pending' || props.status === 'listed'
}

function imageEditable() {
  return props.status === 'pending'
}

function detailSaveButtonText() {
  return props.status === 'listed' ? '同步修改' : '保存'
}

async function submitDetailChange() {
  if (!detailForm.productId) {
    ElMessage.warning('请先打开商品详情')
    return
  }
  if (!detailForm.title.trim()) {
    ElMessage.warning('商品标题不能为空')
    return
  }
  const variants = detailForm.variants.map((variant) => ({
    variantId: variant.variantId,
    standardPrice: Number(variant.standardPrice),
    hidden: Boolean(variant.hidden),
  }))
  for (const variant of variants) {
    if (!Number.isFinite(variant.standardPrice) || variant.standardPrice <= 0) {
      ElMessage.warning(`SKU ${variant.variantId} 价格必须大于 0`)
      return
    }
    if (!Number.isInteger(variant.standardPrice)) {
      ElMessage.warning(`SKU ${variant.variantId} 价格必须为日元整数`)
      return
    }
  }
  detailSaving.value = true
  try {
    const imageChanges = props.status === 'pending' ? await buildPendingImagePayload() : undefined
    const payload = {
      title: detailForm.title.trim(),
      tagline: detailForm.tagline.trim(),
      variants,
      imageChanges,
    }
    const product = props.status === 'listed'
      ? await api.updateProductDetail(detailForm.productId, payload)
      : await api.updateProductLocalDetail(detailForm.productId, payload)
    selectedProductDetail.value = product
    fillDetailForm(product)
    resetImageDraft()
    fillImageDraft(product)
    products.value = products.value.map((item) => (item.id === product.id ? product : item))
    ElMessage.success(props.status === 'listed' ? '商品详情已同步到乐天' : '商品详情已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, props.status === 'listed' ? '同步修改商品详情失败' : '保存商品详情失败'))
  } finally {
    detailSaving.value = false
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
  const values = Object.values(variant.selectorValues || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (values.length < 1) {
    return '-'
  }
  return values.join(' ')
}

function detailImageUrlsFromProduct(product: ProductDetail | null) {
  if (!product) {
    return []
  }
  const urls = [...product.detail.images]
  if (product.imageUrl && !urls.includes(product.imageUrl)) {
    urls.unshift(product.imageUrl)
  }
  return urls
}

function detailImageUrls(product: ProductDetail | null) {
  if (imageEditable()) {
    return detailImageDraft.value.map((image) => image.currentUrl)
  }
  return detailImageUrlsFromProduct(product)
}

function appendPendingImageOperation(operation: PendingImageOperation) {
  const nextOperations = pendingImageOperations.value.filter((item) => item.sourceUrl !== operation.sourceUrl)
  nextOperations.push(operation)
  pendingImageOperations.value = nextOperations
}

async function buildPendingImagePayload() {
  if (pendingImageOperations.value.length < 1) {
    return undefined
  }
  const replaceMap: Record<string, string> = {}
  for (const operation of pendingImageOperations.value) {
    if (operation.type === 'replace') {
      const draft = await api.uploadProductImageDraft(detailForm.productId!, operation.file)
      replaceMap[operation.previewUrl] = draft.url
      replaceMap[operation.sourceUrl] = draft.url
    }
  }
  const images = detailImageDraft.value
    .map((image) => replaceMap[image.currentUrl] || image.currentUrl)
    .filter(Boolean)
  const sourceUrls = new Set(detailImageUrlsFromProduct(selectedProductDetail.value))
  const currentSourceUrls = new Set(detailImageDraft.value.map((image) => image.sourceUrl))
  const removeUrls = [...sourceUrls].filter((url) => !currentSourceUrls.has(url))
  const replacements = pendingImageOperations.value
    .filter((operation): operation is Extract<PendingImageOperation, { type: 'replace' }> => operation.type === 'replace')
    .map((operation) => ({ from: operation.sourceUrl, to: replaceMap[operation.sourceUrl] || '' }))
    .filter((operation) => operation.to)
  return { images, replacements, removeUrls }
}

function productPageUrl(product: ProductDetail) {
  return product.detail.rakutenItemUrl || product.rakutenItemUrl || product.detail.sourceUrl || product.sourceUrl
}

function downloadProductImage(index: number) {
  if (!selectedProductDetail.value) {
    return
  }
  if (imageEditable()) {
    const image = detailImageDraft.value[index]
    if (!image) {
      return
    }
    if (image.currentUrl.startsWith('blob:')) {
      window.open(image.currentUrl, '_blank', 'noopener')
      return
    }
    window.open(api.productImageDownloadUrl(selectedProductDetail.value.id, image.sourceIndex), '_blank', 'noopener')
    return
  }
  window.open(api.productImageDownloadUrl(selectedProductDetail.value.id, index), '_blank', 'noopener')
}

function triggerReplaceImage(index: number) {
  if (!imageEditable()) {
    return
  }
  replacingImageIndex.value = index
  if (imageFileInputRef.value) {
    imageFileInputRef.value.value = ''
    imageFileInputRef.value.click()
  }
}

async function handleReplaceImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const imageIndex = replacingImageIndex.value
  if (!file || imageIndex == null) {
    return
  }
  try {
    const image = detailImageDraft.value[imageIndex]
    if (!image) {
      ElMessage.warning('图片不存在')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    const nextPreviewUrls = new Set(draftPreviewUrls.value)
    nextPreviewUrls.add(previewUrl)
    draftPreviewUrls.value = nextPreviewUrls
    appendPendingImageOperation({ type: 'replace', sourceUrl: image.sourceUrl, file, previewUrl })
    detailImageDraft.value = detailImageDraft.value.map((item, index) => (
      index === imageIndex ? { ...item, currentUrl: previewUrl } : item
    ))
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '替换图片失败'))
  } finally {
    replacingImageIndex.value = null
    input.value = ''
  }
}

async function deleteDetailImage(index: number) {
  if (!selectedProductDetail.value || !imageEditable()) {
    return
  }
  try {
    await ElMessageBox.confirm('确认删除这张商品图片？点击保存后才会生效。', '删除图片', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const image = detailImageDraft.value[index]
    if (!image) {
      ElMessage.warning('图片不存在')
      return
    }
    appendPendingImageOperation({ type: 'delete', sourceUrl: image.sourceUrl })
    detailImageDraft.value = detailImageDraft.value.filter((_, itemIndex) => itemIndex !== index)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除图片失败'))
    }
  } finally {
    imageOperating.value = false
  }
}

function sanitizedDescriptionHtml(value: string) {
  const parser = new DOMParser()
  const documentValue = parser.parseFromString(value || '', 'text/html')
  for (const element of Array.from(documentValue.body.querySelectorAll('script, style, iframe, object, embed, link, meta, svg, canvas, video, audio'))) {
    element.remove()
  }
  for (const element of Array.from(documentValue.body.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const attrValue = attribute.value.trim()
      if (name.startsWith('on') || attrValue.toLowerCase().startsWith('javascript:')) {
        element.removeAttribute(attribute.name)
      }
    }
  }
  return documentValue.body.innerHTML
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
        <div v-if="status === 'pending'" class="batch-action-group">
          <el-button type="success" :icon="Finished" :disabled="selectedIds.length < 1" :loading="operating" @click="approveSelected">
            批量审核通过
          </el-button>
          <el-button type="warning" :icon="EditPen" :disabled="selectedIds.length < 1" :loading="operating" @click="markError()">
            批量标记异常
          </el-button>
          <el-button type="danger" plain :icon="Delete" :disabled="selectedIds.length < 1" :loading="operating" @click="removeSelected">
            批量删除
          </el-button>
        </div>
        <div v-if="status === 'error'" class="batch-action-group">
          <el-button type="primary" :icon="Refresh" :disabled="selectedIds.length < 1" :loading="operating" @click="recheckSelected">
            重新审核
          </el-button>
          <el-button type="danger" plain :icon="Delete" :disabled="selectedIds.length < 1" :loading="operating" @click="removeSelected">
            删除商品
          </el-button>
        </div>
        <div v-if="status === 'listed'" class="batch-action-group">
          <el-button
            type="success"
            plain
            :icon="Top"
            :disabled="selectedIds.length < 1"
            :loading="operating"
            @click="updateSelectedListingStatus('listed')"
          >
            批量上架
          </el-button>
          <el-button
            type="warning"
            plain
            :icon="Warning"
            :disabled="selectedIds.length < 1"
            :loading="operating"
            @click="updateSelectedListingStatus('unlisted')"
          >
            批量下架
          </el-button>
        </div>
        <el-button
          v-if="status === 'listed'"
          type="danger"
          plain
          :icon="Delete"
          :disabled="selectedIds.length < 1"
          :loading="operating"
          @click="removeSelected"
        >
          批量删除
        </el-button>
        <div v-if="status === 'approved' || status === 'listed_master'" class="approved-head-actions">
          <el-button
            type="primary"
            :icon="Upload"
            :disabled="selectedIds.length < 1 || hasSelectedListingProductBusy()"
            :loading="operating"
            @click="createListingTask"
          >
            {{ status === 'listed_master' ? '批量重新上架' : '批量上架' }}
          </el-button>
          <el-button type="danger" plain :icon="Delete" :disabled="selectedIds.length < 1" :loading="operating" @click="removeSelected">
            批量删除
          </el-button>
        </div>
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
            type="daterange"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="上架开始日期"
            end-placeholder="上架结束日期"
            @change="searchProducts"
          />
        </div>
        <div class="filter-field filter-keyword-field">
          <el-input
            v-model="filters.keyword"
            class="full-control"
            :prefix-icon="Search"
            clearable
            :placeholder="status === 'listed' ? '商品标题、商品编号' : '商品标题'"
            @keydown.enter="searchProducts"
          />
        </div>
        <div v-if="status !== 'listed'" class="filter-field filter-price-field">
          <el-input-number
            v-model="filters.priceMin"
            class="price-input"
            :min="0"
            :precision="0"
            :controls="false"
            placeholder="最低价"
            @change="searchProducts"
          />
          <span class="range-separator">至</span>
          <el-input-number
            v-model="filters.priceMax"
            class="price-input"
            :min="0"
            :precision="0"
            :controls="false"
            placeholder="最高价"
            @change="searchProducts"
          />
        </div>
        <div v-if="status !== 'listed'" class="filter-field filter-collected-field">
          <el-date-picker
            v-model="filters.collectedAtRange"
            class="full-control"
            type="daterange"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="采集开始日期"
            end-placeholder="采集结束日期"
            @change="searchProducts"
          />
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

      <el-table
        ref="productTableRef"
        v-loading="loading"
        :data="visibleProducts"
        :empty-text="statusCopy.empty"
        height="620"
        :row-class-name="productRowClassName"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="46" :selectable="isProductSelectable" />
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
        <el-table-column label="商品标题" min-width="300">
          <template #default="{ row }">
            <CopyableTableText :value="row.title" />
          </template>
        </el-table-column>
        <el-table-column v-if="status === 'listed'" label="商品编号" min-width="170">
          <template #default="{ row }">
            <CopyableTableText :value="productCode(row)" />
          </template>
        </el-table-column>
        <el-table-column v-if="status === 'listed'" label="店铺" min-width="150">
          <template #default="{ row }">
            <CopyableTableText :value="storeRealName(row)" :display="storeDisplayName(row)" always />
          </template>
        </el-table-column>
        <el-table-column v-if="status === 'listed_master'" label="已上架店铺" min-width="260">
          <template #default="{ row }">
            <div v-if="row.listedStores?.length" class="listed-store-tags">
              <el-tooltip
                v-for="store in row.listedStores"
                :key="`${row.id}-${store.storeId}`"
                :content="listedStoreRealName(store)"
                placement="top"
              >
                <el-tag size="small" type="success">
                  {{ listedStoreLabel(store) }}
                </el-tag>
              </el-tooltip>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="价格(日元)" width="140">
          <template #default="{ row }">
            {{ priceText(row) }}
          </template>
        </el-table-column>
        <el-table-column v-if="status !== 'listed'" prop="createdAt" label="采集时间" min-width="170" />
        <el-table-column v-if="status === 'listed'" label="上架状态" width="120">
          <template #default="{ row }">
            <el-tag :type="listingStatusCopy(row).type">
              {{ listingStatusCopy(row).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="status === 'listed'" prop="listedAt" label="上架时间" min-width="170" />
        <el-table-column v-if="status === 'listed'" prop="updatedAt" label="更新时间" min-width="170" />
        <el-table-column label="操作" :width="status === 'pending' ? 300 : ['approved', 'listed_master'].includes(status) ? 240 : 120" fixed="right">
          <template #default="{ row }">
            <el-button :icon="View" link type="primary" :disabled="isListingProductBusy(row)" @click="openProductDetail(row)">
              查看详情
            </el-button>
            <template v-if="status === 'approved' || status === 'listed_master'">
              <el-button
                :icon="Upload"
                link
                type="success"
                :disabled="isListingProductBusy(row)"
                :loading="isListingProductBusy(row)"
                @click="createListingTaskForProduct(row)"
              >
                {{ status === 'listed_master' ? '重新上架' : '上架' }}
              </el-button>
              <el-button :icon="Delete" link type="danger" :disabled="isListingProductBusy(row)" @click="removeProduct(row)">
                删除
              </el-button>
            </template>
            <template v-if="status === 'pending'">
              <el-button :icon="Finished" link type="success" @click="approveProduct(row)">
                审核通过
              </el-button>
              <el-button :icon="EditPen" link type="warning" @click="markError([row.id], row)">
                标记异常
              </el-button>
              <el-button :icon="Delete" link type="danger" @click="removeProduct(row)">
                删除
              </el-button>
            </template>
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

    <el-dialog v-model="listingDialogVisible" :title="listingDialogTitle" width="520px" append-to-body>
      <el-form label-position="top" class="listing-dialog-form">
        <el-form-item label="目标店铺">
          <el-select v-model="listingForm.storeId" class="full-control" clearable filterable placeholder="选择上架店铺">
            <el-option v-for="store in stores" :key="store.id" :label="store.aliasName || store.storeName" :value="store.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务名称">
          <el-input v-model="listingForm.taskName" maxlength="255" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="listingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="operating" @click="submitListingTask">
          {{ status === 'listed_master' ? '创建重新上架任务' : '创建上架任务' }}
        </el-button>
      </template>
    </el-dialog>

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
              <el-form label-position="top" class="detail-edit-form">
                <el-form-item label="商品标题">
                  <el-input
                    v-model="detailForm.title"
                    maxlength="500"
                    show-word-limit
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 4 }"
                    :readonly="!detailEditable()"
                  />
                </el-form-item>
                <el-form-item label="商品副标题">
                  <el-input
                    v-model="detailForm.tagline"
                    maxlength="174"
                    show-word-limit
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 3 }"
                    :readonly="!detailEditable()"
                  />
                </el-form-item>
              </el-form>
              <div class="detail-meta">
                <span v-if="status === 'listed'">商品编号：{{ compactText(selectedProductDetail.detail.itemNumber) }}</span>
                <span v-if="status === 'listed'">店铺：{{ compactText(selectedProductDetail.detail.shopName) }}</span>
                <span>价格：{{ priceText(selectedProductDetail) }}</span>
                <span v-if="status === 'listed'">
                  上架状态：
                  <el-tag :type="listingStatusCopy(selectedProductDetail).type" size="small">
                    {{ listingStatusCopy(selectedProductDetail).label }}
                  </el-tag>
                </span>
                <span v-if="status === 'listed'">上架时间：{{ compactText(selectedProductDetail.listedAt) }}</span>
                <span v-if="status === 'listed'">更新时间：{{ compactText(selectedProductDetail.updatedAt) }}</span>
              </div>
              <el-button :icon="View" link type="primary" tag="a" :href="productPageUrl(selectedProductDetail)" target="_blank" rel="noreferrer">
                打开乐天商品页
              </el-button>
            </div>
          </div>

          <el-tabs class="detail-tabs">
            <el-tab-pane label="款式 SKU">
              <el-table :data="selectedProductDetail.detail.variants" border max-height="300" empty-text="暂无款式数据">
                <el-table-column v-if="status === 'listed'" label="SKU ID" min-width="150">
                  <template #default="{ row }">
                    <CopyableTableText :value="row.variantId" />
                  </template>
                </el-table-column>
                <el-table-column v-if="status === 'listed'" label="商家 SKU" min-width="150">
                  <template #default="{ row }">
                    <CopyableTableText :value="row.merchantDefinedSkuId" />
                  </template>
                </el-table-column>
                <el-table-column label="款式选项" min-width="220">
                  <template #default="{ row }">
                    <CopyableTableText :value="variantSelectorText(row)" />
                  </template>
                </el-table-column>
                <el-table-column label="材质" min-width="120">
                  <template #default="{ row }">
                    <CopyableTableText :value="row.material || '-'" />
                  </template>
                </el-table-column>
                <el-table-column label="价格(日元)" width="170">
                  <template #default="{ row }">
                    <el-input-number
                      v-if="detailVariantForm(row)"
                      v-model="detailVariantForm(row)!.standardPrice"
                      class="sku-price-input"
                      :min="1"
                      :precision="0"
                      :step="100"
                      :disabled="!detailEditable()"
                    />
                    <span v-else>{{ row.standardPrice }}</span>
                  </template>
                </el-table-column>
                <el-table-column v-if="status === 'listed'" label="隐藏" width="110">
                  <template #default="{ row }">
                    <el-switch
                      v-if="detailVariantForm(row)"
                      v-model="detailVariantForm(row)!.hidden"
                      active-text="是"
                      inactive-text="否"
                      inline-prompt
                      :disabled="status !== 'listed'"
                    />
                    <span v-else>{{ row.hidden ? '是' : '否' }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="图片">
              <div v-loading="imageOperating" class="detail-images">
                <div v-for="(image, index) in detailImageUrls(selectedProductDetail)" :key="`${image}-${index}`" class="detail-image-card">
                  <el-image
                    class="detail-thumb"
                    :src="image"
                    fit="cover"
                    :preview-src-list="detailImageUrls(selectedProductDetail)"
                    :initial-index="index"
                    preview-teleported
                  />
                  <div class="detail-image-actions">
                    <el-button :icon="Download" link type="primary" @click="downloadProductImage(index)">
                      下载
                    </el-button>
                    <el-button v-if="imageEditable()" :icon="EditPen" link type="warning" @click="triggerReplaceImage(index)">
                      替换
                    </el-button>
                    <el-button v-if="imageEditable()" :icon="Delete" link type="danger" @click="deleteDetailImage(index)">
                      删除
                    </el-button>
                  </div>
                </div>
                <el-empty v-if="detailImageUrls(selectedProductDetail).length < 1" description="暂无图片数据" />
                <input v-if="imageEditable()" ref="imageFileInputRef" class="hidden-file-input" type="file" accept="image/jpeg,image/png,image/gif" @change="handleReplaceImage" />
              </div>
            </el-tab-pane>
            <el-tab-pane label="商品详情说明">
              <div class="description-list">
                <div v-for="description in selectedProductDetail.detail.descriptions" :key="description.label" class="description-item">
                  <strong>{{ description.label === '商品说明' ? '商品详情说明' : description.label }}</strong>
                  <div v-if="description.value" class="description-html" v-html="sanitizedDescriptionHtml(description.value)" />
                  <div v-else class="description-empty">暂无内容</div>
                </div>
                <el-empty v-if="selectedProductDetail.detail.descriptions.length < 1" description="暂无商品详情说明" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="selectedProductDetail && detailEditable()" type="primary" :loading="detailSaving" @click="submitDetailChange">
          {{ detailSaveButtonText() }}
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

.approved-head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
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
  gap: 14px 16px;
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
  max-width: 480px;
  min-width: 360px;
}

.filter-keyword-field {
  flex: 1 1 280px;
  max-width: 520px;
  min-width: 220px;
}

.filter-price-field {
  display: inline-flex;
  flex: 0 1 300px;
  min-width: 260px;
  align-items: center;
  gap: 8px;
}

.filter-collected-field {
  flex: 1 1 340px;
  min-width: 320px;
  max-width: 440px;
}

.filter-collected-field :deep(.el-date-editor) {
  width: 100%;
  min-width: 0;
}

.price-input {
  flex: 1 1 0;
  min-width: 0;
}

.price-input :deep(.el-input__wrapper) {
  width: 100%;
}

.range-separator {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-weight: 700;
}

.filter-row-with-store .filter-store-field {
  flex: 0 0 232px;
}

.filter-row-with-store .filter-status-field {
  flex: 0 0 192px;
}

.filter-row-with-store .filter-range-field {
  flex: 0 1 478px;
  max-width: 478px;
}

.filter-row-with-store .filter-keyword-field {
  flex: 0 1 420px;
  max-width: 420px;
  margin-left: 0;
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

:deep(.product-row-disabled) {
  opacity: 0.55;
  background: var(--panel-muted);
}

.listed-store-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.listing-dialog-form {
  display: grid;
  gap: 4px;
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

.detail-edit-form {
  margin-bottom: 10px;
}

.detail-edit-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.detail-edit-form :deep(.el-form-item__label) {
  color: var(--text-muted);
  font-weight: 700;
}

.detail-edit-form :deep(.el-textarea__inner) {
  color: var(--text-main);
  font-size: 16px;
  line-height: 1.5;
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

.sku-price-input {
  width: 132px;
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 136px));
  align-content: start;
  justify-content: start;
  gap: 16px 18px;
  max-height: min(420px, calc(100vh - 470px));
  min-height: 160px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 8px 8px 0;
}

.detail-image-card {
  display: grid;
  gap: 8px;
  width: 136px;
  min-width: 0;
}

.detail-thumb {
  width: 136px;
  height: 136px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
}

.detail-image-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 4px;
  min-height: 28px;
  overflow: hidden;
}

.detail-image-actions :deep(.el-button) {
  justify-content: center;
  margin-left: 0;
  min-width: 0;
  padding: 0;
  font-size: 12px;
  white-space: nowrap;
}

.detail-image-actions :deep(.el-button .el-icon) {
  margin-right: 2px;
}

.hidden-file-input {
  display: none;
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

.description-html {
  color: var(--text-muted);
  line-height: 1.7;
  overflow: auto;
}

.description-empty {
  color: var(--text-subtle);
  font-size: 13px;
  line-height: 1.7;
}

.description-html :deep(img),
.description-html :deep(video) {
  display: block;
  max-width: 100%;
  height: auto;
}

.description-html :deep(a) {
  color: var(--accent);
  word-break: break-all;
}

.description-html :deep(table) {
  max-width: 100%;
  border-collapse: collapse;
}

.description-html :deep(td),
.description-html :deep(th) {
  border: 1px solid var(--panel-border);
  padding: 6px 8px;
}

.description-html :deep(*) {
  max-width: 100%;
}

@media (max-width: 1180px) {
  .filter-range-field,
  .filter-collected-field,
  .filter-keyword-field {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .filter-field,
  .filter-buttons,
  .approved-head-actions,
  .approved-head-actions :deep(.el-select) {
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

  .filter-price-field {
    min-width: 0;
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
