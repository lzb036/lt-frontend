<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, EditPen, Finished, MagicStick, Refresh, Search, Top, Upload, View, Warning } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { ListingTask, ProductDetail, ProductDetailEditPayload, ProductItem, ProductListedStore, ProductVariant, ProductVariantEditPayload, RakutenGenreOption, RakutenListingStatus, ReviewStatus, StoreAccount, SyncTask } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { hasValidProductGenre, invalidGenreProducts } from '../../utils/productGenre'
import { openMeituImageEditor, type MeituImageSaveResult } from '../../utils/meituImageEditor'
import CopyableTableText from './CopyableTableText.vue'
import PendingProductGenreSelect from './PendingProductGenreSelect.vue'
import ProductTitleOptimizationDialog from './ProductTitleOptimizationDialog.vue'
import StoreProductReplacementDialog from './StoreProductReplacementDialog.vue'

type PendingImageOperation =
  | { type: 'replace'; sourceUrl: string; file: File; previewUrl: string }
  | { type: 'replaceBase64'; sourceUrl: string; imageBase64: string; ext: string; previewUrl: string }
  | { type: 'delete'; sourceUrl: string }

interface ImageDraftItem {
  sourceIndex: number
  sourceUrl: string
  currentUrl: string
}

interface PendingInlineDraft {
  title: string
  tagline: string
}

const props = defineProps<{
  status: ReviewStatus
  title: string
  eyebrow: string
}>()

const LISTED_STORE_NONE_FILTER = '__none__'
type ListedStoreFilterValue = number | typeof LISTED_STORE_NONE_FILTER | ''

const api = useCollectorApi()
const loading = shallowRef(false)
const operating = shallowRef(false)
const detailLoading = shallowRef(false)
const detailSaving = shallowRef(false)
const imageOperating = shallowRef(false)
const productTableRef = ref<{ clearSelection: () => void } | null>(null)
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const inlineImageFileInputRef = ref<HTMLInputElement | null>(null)
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const selectedIds = ref<number[]>([])
const selectedPendingImages = shallowRef<Map<number, Set<string>>>(new Map())
const hiddenProducts = shallowRef<Map<number, ProductItem>>(new Map())
const detailVisible = shallowRef(false)
const selectedProductDetail = shallowRef<ProductDetail | null>(null)
const listingProductIds = shallowRef<Set<number>>(new Set())
const listedSyncProductIds = shallowRef<Set<number>>(new Set())
const detailImageDraft = shallowRef<ImageDraftItem[]>([])
const draftPreviewUrls = shallowRef<Set<string>>(new Set())
const pendingImageOperations = shallowRef<PendingImageOperation[]>([])
const pendingInlineDrafts = reactive<Record<number, PendingInlineDraft>>({})
const pendingInlineSavingIds = shallowRef<Set<number>>(new Set())
const replacingInlineImageProductId = shallowRef<number | null>(null)
const replacingInlineImageIndex = shallowRef(0)
const detailForm = reactive({
  productId: null as number | null,
  title: '',
  tagline: '',
  genreId: '',
  genrePath: '',
  genrePathZh: '',
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
  listedStoreId: '' as ListedStoreFilterValue,
  listingStatus: '' as '' | 'listed' | 'unlisted',
  listedAtRange: [] as string[] | null,
})

const listingForm = reactive({
  storeIds: [] as number[],
  taskName: '',
})
const listingDialogVisible = shallowRef(false)
const listingDialogProductIds = shallowRef<number[]>([])
const listingDialogTitle = shallowRef('上架商品')
const titleOptimizationVisible = shallowRef(false)
const titleOptimizationProduct = shallowRef<ProductItem | null>(null)
const replacementVisible = shallowRef(false)
const replacementProduct = shallowRef<ProductItem | null>(null)
const detailGenreProduct = computed<ProductItem | null>(() => {
  if (!selectedProductDetail.value) {
    return null
  }
  return {
    ...selectedProductDetail.value,
    genreId: detailForm.genreId,
    genrePath: detailForm.genrePath,
    genrePathZh: detailForm.genrePathZh,
  }
})

function openTitleOptimization(product: ProductItem) {
  titleOptimizationProduct.value = product
  titleOptimizationVisible.value = true
}

function openProductReplacement(product: ProductItem) {
  replacementProduct.value = product
  replacementVisible.value = true
}

async function handleProductReplacementCreated() {
  await refreshAll({ loadStores: false })
}

async function handleProductReplacementCompleted() {
  await refreshAll({ loadStores: false })
}

async function confirmPendingReplacement(product: ProductItem) {
  const manageNumber = product.replacementTargetManageNumber || ''
  if (!manageNumber) {
    ElMessage.error('替换商品缺少目标商品管理编号')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `确认后将用当前待审核商品替换目标店铺商品。请输入商品管理编号「${manageNumber}」确认。`,
      '确认替换店铺商品',
      {
        confirmButtonText: '确认替换',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: '输入目标商品管理编号',
        inputValidator: (value) => value === manageNumber || '商品管理编号不正确',
      },
    )
    operating.value = true
    const replacement = await api.confirmPendingProductReplacement(product.id, result.value)
    ElMessage.success('替换任务已提交')
    await pollPendingReplacement(replacement.task.id)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '确认替换失败'))
    }
  } finally {
    operating.value = false
  }
}

async function pollPendingReplacement(taskId: string) {
  for (;;) {
    const replacement = await api.getProductReplacement(taskId)
    if (replacement.task.status === 'success') {
      ElMessage.success('店铺商品替换完成')
      await refreshAll({ loadStores: false })
      return
    }
    if (['failed', 'partial', 'cancelled'].includes(replacement.task.status)) {
      throw new Error(replacement.task.errorDetail || replacement.task.message || '店铺商品替换失败')
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
}

async function handleTitleOptimizationSaved() {
  await refreshAll({ loadStores: false })
}

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
    selectedPendingImages.value = new Map()
    hiddenProducts.value = new Map()
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
    if (props.status !== 'listed_master') {
      filters.listedStoreId = ''
    }
    const result = await api.listProductsPage({
      status: props.status,
      keyword: filters.keyword.trim(),
      storeId: props.status === 'listed' ? filters.storeId : null,
      listedStoreId: props.status === 'listed_master' ? filters.listedStoreId : '',
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
    syncPendingInlineDrafts(result.items)
    reconcilePendingImageSelections(result.items)
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

function productTagline(product: ProductItem) {
  return String(product.tagline || '')
}

function pendingInlineDraft(product: ProductItem) {
  const existing = pendingInlineDrafts[product.id]
  if (existing) {
    return existing
  }
  const draft = {
    title: product.title || '',
    tagline: productTagline(product),
  }
  pendingInlineDrafts[product.id] = draft
  return draft
}

function setPendingInlineDraft(product: ProductItem) {
  pendingInlineDrafts[product.id] = {
    title: product.title || '',
    tagline: productTagline(product),
  }
}

function syncPendingInlineDrafts(nextProducts: ProductItem[]) {
  if (props.status !== 'pending') {
    for (const key of Object.keys(pendingInlineDrafts)) {
      delete pendingInlineDrafts[Number(key)]
    }
    return
  }
  const nextIds = new Set(nextProducts.map((product) => product.id))
  for (const key of Object.keys(pendingInlineDrafts)) {
    if (!nextIds.has(Number(key))) {
      delete pendingInlineDrafts[Number(key)]
    }
  }
  for (const product of nextProducts) {
    setPendingInlineDraft(product)
  }
}

function setPendingInlineDraftField(product: ProductItem, field: keyof PendingInlineDraft, value: string | number) {
  pendingInlineDraft(product)[field] = String(value ?? '')
}

function setPendingInlineSaving(productId: number, saving: boolean) {
  const next = new Set(pendingInlineSavingIds.value)
  if (saving) {
    next.add(productId)
  } else {
    next.delete(productId)
  }
  pendingInlineSavingIds.value = next
}

function isPendingInlineSaving(product: ProductItem) {
  return pendingInlineSavingIds.value.has(product.id)
}

function productListImageUrls(product: ProductItem) {
  const urls = [...(product.images || [])]
  if (product.imageUrl && !urls.includes(product.imageUrl)) {
    urls.unshift(product.imageUrl)
  }
  return urls
    .map((url) => String(url || '').trim())
    .filter((url, index, values) => Boolean(url) && values.indexOf(url) === index)
}

function selectedPendingImageUrls(productId: number) {
  return selectedPendingImages.value.get(productId) || new Set<string>()
}

function selectedPendingImageCount(productId: number) {
  return selectedPendingImageUrls(productId).size
}

function isPendingImageSelected(productId: number, imageUrl: string) {
  return selectedPendingImageUrls(productId).has(imageUrl)
}

function togglePendingImageSelection(productId: number, imageUrl: string, selected: boolean) {
  const nextSelections = new Map(selectedPendingImages.value)
  const nextImages = new Set(nextSelections.get(productId) || [])
  if (selected) {
    nextImages.add(imageUrl)
  } else {
    nextImages.delete(imageUrl)
  }
  if (nextImages.size > 0) {
    nextSelections.set(productId, nextImages)
  } else {
    nextSelections.delete(productId)
  }
  selectedPendingImages.value = nextSelections
}

function clearPendingImageSelection(productId: number) {
  if (!selectedPendingImages.value.has(productId)) {
    return
  }
  const nextSelections = new Map(selectedPendingImages.value)
  nextSelections.delete(productId)
  selectedPendingImages.value = nextSelections
}

function reconcilePendingImageSelections(nextProducts: ProductItem[]) {
  if (props.status !== 'pending' || selectedPendingImages.value.size < 1) {
    if (props.status !== 'pending') {
      selectedPendingImages.value = new Map()
    }
    return
  }
  const nextSelections = new Map<number, Set<string>>()
  for (const product of nextProducts) {
    const selectedImages = selectedPendingImages.value.get(product.id)
    if (!selectedImages?.size) {
      continue
    }
    const currentImages = new Set(productListImageUrls(product))
    const retainedImages = new Set([...selectedImages].filter((image) => currentImages.has(image)))
    if (retainedImages.size > 0) {
      nextSelections.set(product.id, retainedImages)
    }
  }
  selectedPendingImages.value = nextSelections
}

function mergeUpdatedProduct(product: ProductItem) {
  products.value = products.value.map((item) => (item.id === product.id ? { ...item, ...product } : item))
  reconcilePendingImageSelections(products.value)
  if (props.status === 'pending') {
    setPendingInlineDraft(product)
  }
  if (selectedProductDetail.value?.id === product.id && 'detail' in product) {
    selectedProductDetail.value = product as ProductDetail
    fillDetailForm(product as ProductDetail)
    resetImageDraft()
    fillImageDraft(product as ProductDetail)
  }
}

function resetFilters() {
  filters.keyword = ''
  filters.priceMin = null
  filters.priceMax = null
  filters.collectedAtRange = []
  filters.storeId = props.status === 'listed' ? (stores.value[0]?.id ?? null) : null
  filters.listedStoreId = ''
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
  selectedPendingImages.value = new Map()
  void refreshAll({ loadStores: false })
}

function handlePageSizeChange() {
  resetPage()
  clearSelection()
  selectedPendingImages.value = new Map()
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
  if (props.status === 'listed') {
    if (filters.storeId && product.storeId !== filters.storeId) {
      return false
    }
    if (filters.listingStatus && product.rakutenListingStatus !== filters.listingStatus) {
      return false
    }
  }
  if (props.status === 'listed_master' && filters.listedStoreId) {
    const listedStores = product.listedStores || []
    if (filters.listedStoreId === LISTED_STORE_NONE_FILTER) {
      return listedStores.length < 1
    }
    if (!listedStores.some((store) => store.storeId === filters.listedStoreId)) {
      return false
    }
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
  syncPendingInlineDrafts(products.value)
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

function applyResolvedListingStatus(productIds: number[], listingStatus: RakutenListingStatus) {
  if (productIds.length < 1) {
    return
  }
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
  const invalidProducts = invalidGenreProducts(products.value, selectedIds.value)
  if (invalidProducts.length > 0) {
    const names = invalidProducts.slice(0, 3).map(productDisplayName).join('、')
    const suffix = invalidProducts.length > 3 ? '等' : ''
    ElMessage.warning(`${invalidProducts.length} 个商品缺少有效品类：${names}${suffix}。请先选择品类后再审核。`)
    return
  }
  await confirmReviewStatus(selectedIds.value, 'approved', {
    title: '批量审核通过',
    message: `确认将选中的 ${selectedIds.value.length} 个商品批量审核通过？该操作只修改本地数据库。`,
    confirmButtonText: '审核通过',
    type: 'success',
  })
}

async function approveProduct(product: ProductItem) {
  if (!hasValidProductGenre(product)) {
    ElMessage.warning('请先选择有效品类，当前商品不能审核通过')
    return
  }
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
  const shouldLockListedSync = props.status === 'listed'
  let keepListedSyncBusy = false
  if (['approved', 'listed', 'listed_master'].includes(props.status) && hasBusyProductIds(productIds)) {
    ElMessage.warning('选中的商品正在执行任务，请稍后')
    return
  }
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
    if (shouldLockListedSync) {
      setListedSyncProductsBusy(productIds, true)
      clearSelection()
    }
    operating.value = true
    const result = await api.deleteProducts(productIds)
    const syncTasks = syncTasksFromResult(result)
    if (syncTasks.length > 0) {
      ElMessage.success(syncTasksCreatedMessage(syncTasks, result.summary.message || '批量删除任务已创建'))
      clearSelection()
      keepListedSyncBusy = true
      watchDeleteSyncTasksCompletion(taskIds(syncTasks), productIds)
      return
    }
    if (result.summary.failedCount > 0) {
      ElMessage.warning(result.summary.message)
    } else {
      ElMessage.success(result.summary.message)
    }
    mergeVisibleProducts(result.products || [])
    removeVisibleProducts(result.deletedIds || [])
    clearSelection()
    if (products.value.length < 1 && total.value > 0) {
      void refreshAll({ loadStores: false })
    }
  } catch (error) {
    if (error !== 'cancel') {
      if (shouldLockListedSync) {
        clearListedSyncTaskBusy(productIds)
      }
      ElMessage.error(toApiErrorMessage(error, '删除商品失败'))
    }
  } finally {
    if (shouldLockListedSync && !keepListedSyncBusy) {
      clearListedSyncTaskBusy(productIds)
    }
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
  if (hasBusyProductIds(productIds)) {
    ElMessage.warning('选中的店铺商品正在同步，请稍后')
    return
  }
  const actionText = listingStatus === 'listed' ? '上架' : '下架'
  let keepListedSyncBusy = false
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
    setListedSyncProductsBusy(productIds, true)
    clearSelection()
    operating.value = true
    const result = await api.updateProductsListingStatus({
      productIds,
      listingStatus,
    })
    const syncTasks = syncTasksFromResult(result)
    ElMessage.success(syncTasksCreatedMessage(syncTasks, result.summary.message || `批量${actionText}任务已创建`))
    keepListedSyncBusy = true
    watchListingStatusSyncTasksCompletion(taskIds(syncTasks), productIds, listingStatus)
  } catch (error) {
    if (error !== 'cancel') {
      clearListedSyncTaskBusy(productIds)
      ElMessage.error(toApiErrorMessage(error, `批量${actionText}失败`))
    }
  } finally {
    if (!keepListedSyncBusy) {
      clearListedSyncTaskBusy(productIds)
    }
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
  if (listingForm.storeIds.length < 1) {
    ElMessage.warning('请先选择上架店铺')
    return
  }
  await confirmAndCreateListingTask(productIds)
}

async function confirmAndCreateListingTask(productIds: number[]) {
  try {
    await ElMessageBox.confirm(
      `确认将选中的 ${productIds.length} 个商品上架到 ${listingForm.storeIds.length} 个店铺？`,
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
      storeIds: [...listingForm.storeIds],
      taskName: listingForm.taskName.trim(),
    })
    listingDialogVisible.value = false
    handleListingTasksResult(listingTasksFromResult(result), productIds, result.summary?.message)
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
  listingForm.storeIds = []
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

function setListedSyncProductsBusy(productIds: number[], busy: boolean) {
  if (productIds.length < 1) {
    return
  }
  const next = new Set(listedSyncProductIds.value)
  for (const productId of productIds) {
    if (busy) {
      next.add(productId)
    } else {
      next.delete(productId)
    }
  }
  listedSyncProductIds.value = next
}

function isListingProductBusy(product: ProductItem) {
  return listingProductIds.value.has(product.id) || Boolean(product.listingTaskId)
}

function isListedSyncProductBusy(product: ProductItem) {
  return listedSyncProductIds.value.has(product.id)
}

function isProductBusy(product: ProductItem) {
  return isListingProductBusy(product) || isListedSyncProductBusy(product)
}

function hasBusyProductIds(productIds: number[]) {
  if (productIds.length < 1) {
    return false
  }
  const ids = new Set(productIds)
  if (productIds.some((productId) => listingProductIds.value.has(productId) || listedSyncProductIds.value.has(productId))) {
    return true
  }
  return visibleProducts.value.some((product) => ids.has(product.id) && Boolean(product.listingTaskId))
}

function hasSelectedProductBusy() {
  return hasBusyProductIds(selectedIds.value)
}

function isProductSelectable(product: ProductItem) {
  return !isProductBusy(product)
}

function productRowClassName({ row }: { row: ProductItem }) {
  return isProductBusy(row) ? 'product-row-disabled' : ''
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

function taskProductIds(task: ListingTask | SyncTask) {
  if ('productIds' in task && Array.isArray(task.productIds) && task.productIds.length > 0) {
    return task.productIds
  }
  const payloadProductIds = (task as SyncTask).payload?.productIds
  return Array.isArray(payloadProductIds)
    ? payloadProductIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    : []
}

function uniqueIds(values: number[]) {
  return [...new Set(values)]
}

function aggregateTaskOutcomeIds(tasks: Array<ListingTask | SyncTask>, productIds: number[]) {
  const successIds: number[] = []
  const failedIds: number[] = []
  for (const task of tasks) {
    const ids = taskProductIds(task)
    const scopedIds = ids.length > 0 ? ids : productIds
    const outcome = taskOutcomeIds(task, scopedIds)
    successIds.push(...outcome.successIds)
    failedIds.push(...outcome.failedIds)
  }
  const success = uniqueIds(successIds)
  const successSet = new Set(success)
  const failed = uniqueIds(failedIds.length > 0 ? failedIds : productIds.filter((productId) => !successSet.has(productId)))
  return { successIds: success, failedIds: failed }
}

function listingTasksFromResult(result: { listingTask?: ListingTask; listingTasks?: ListingTask[] }) {
  return result.listingTasks?.length ? result.listingTasks : result.listingTask ? [result.listingTask] : []
}

function syncTasksFromResult(result: { syncTask?: SyncTask; syncTasks?: SyncTask[] }) {
  return result.syncTasks?.length ? result.syncTasks : result.syncTask ? [result.syncTask] : []
}

function taskIds<T extends { id: string }>(tasks: T[]) {
  return tasks.map((task) => task.id).filter(Boolean)
}

function areTasksFinished(tasks: Array<ListingTask | SyncTask>) {
  return tasks.length > 0 && tasks.every((task) => !['queued', 'running'].includes(task.status))
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
  if (task.status === 'cancelled') {
    const successIds = task.successIds?.length ? task.successIds : []
    const successIdSet = new Set(successIds)
    const pendingIds = productIds.filter((productId) => !successIdSet.has(productId))
    clearListingTaskBusy(productIds)
    if (shouldHideAfterListingTask()) {
      clearHiddenProducts(successIds)
      restoreHiddenProducts(pendingIds)
    } else {
      void refreshAll({ loadStores: false })
    }
    ElMessage.warning(task.errorDetail || task.message || '上架任务已终止，请到上架任务中查看详情')
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (shouldHideAfterListingTask()) {
    hideProducts(productIds)
  }
  watchListingTaskCompletion(task.id, productIds)
  ElMessage.success('上架任务已创建，请到上架任务中查看进度')
}

function handleListingTasksResult(tasks: ListingTask[], productIds: number[], message?: string) {
  if (tasks.length < 1) {
    clearListingTaskBusy(productIds)
    if (shouldHideAfterListingTask()) {
      restoreHiddenProducts(productIds)
    }
    ElMessage.error('上架任务创建失败')
    return
  }
  if (tasks.length === 1) {
    handleListingTaskResult(tasks[0], productIds)
    return
  }
  if (!areTasksFinished(tasks)) {
    if (shouldHideAfterListingTask()) {
      hideProducts(productIds)
    }
    watchListingTasksCompletion(taskIds(tasks), productIds)
    ElMessage.success(message || `上架任务已拆分为 ${tasks.length} 个任务，请到上架任务中查看进度`)
    return
  }
  const { successIds, failedIds } = aggregateTaskOutcomeIds(tasks, productIds)
  const allSuccess = tasks.every((task) => task.status === 'success')
  clearListingTaskBusy(productIds)
  if (shouldHideAfterListingTask()) {
    clearHiddenProducts(successIds)
    if (!allSuccess) {
      restoreHiddenProducts(failedIds)
    }
  } else {
    void refreshAll({ loadStores: false })
  }
  if (allSuccess) {
    ElMessage.success('上架任务已完成')
    maybeRefreshAfterOptimisticAction()
    return
  }
  ElMessage.warning('部分上架任务未成功，请到上架任务中查看异常信息')
  maybeRefreshAfterOptimisticAction()
}

function watchListingTaskCompletion(taskId: string, productIds: number[]) {
  if (!taskId || !['approved', 'listed_master'].includes(props.status)) {
    return
  }
  let pollFailures = 0
  const timer = window.setInterval(async () => {
    try {
      const tasks = await api.listListingTasks()
      pollFailures = 0
      const task = tasks.find((item) => item.id === taskId)
      if (!task) {
        return
      }
      if (['queued', 'running'].includes(task.status)) {
        return
      }
      window.clearInterval(timer)
      handleListingTaskResult(task, productIds)
    } catch {
      pollFailures += 1
      if (pollFailures >= 3) {
        window.clearInterval(timer)
        clearListingTaskBusy(productIds)
        if (shouldHideAfterListingTask()) {
          restoreHiddenProducts(productIds)
        }
      }
    }
  }, 2000)
}

function watchListingTasksCompletion(taskIdsToWatch: string[], productIds: number[]) {
  if (taskIdsToWatch.length < 1 || !['approved', 'listed_master'].includes(props.status)) {
    clearListingTaskBusy(productIds)
    return
  }
  const idSet = new Set(taskIdsToWatch)
  let pollFailures = 0
  const timer = window.setInterval(async () => {
    try {
      const tasks = await api.listListingTasks()
      pollFailures = 0
      const matchedTasks = tasks.filter((item) => idSet.has(item.id))
      if (matchedTasks.length < idSet.size || !areTasksFinished(matchedTasks)) {
        return
      }
      window.clearInterval(timer)
      handleListingTasksResult(matchedTasks, productIds)
    } catch {
      pollFailures += 1
      if (pollFailures >= 3) {
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

function clearListedSyncTaskBusy(productIds: number[]) {
  setListedSyncProductsBusy(productIds, false)
}

function syncTaskCreatedMessage(task: SyncTask | undefined, fallback: string) {
  if (!task) {
    return fallback
  }
  return `${fallback}，请到同步任务中查看进度`
}

function syncTasksCreatedMessage(tasks: SyncTask[], fallback: string) {
  if (tasks.length <= 1) {
    return syncTaskCreatedMessage(tasks[0], fallback)
  }
  return `${fallback}，已拆分为 ${tasks.length} 个任务，请到同步任务中查看进度`
}

function watchDeleteSyncTasksCompletion(taskIdsToWatch: string[], productIds: number[]) {
  if (taskIdsToWatch.length < 1 || props.status !== 'listed') {
    clearListedSyncTaskBusy(productIds)
    return
  }
  const idSet = new Set(taskIdsToWatch)
  let pollFailures = 0
  const timer = window.setInterval(async () => {
    try {
      const tasks = await api.listSyncTasks()
      pollFailures = 0
      const matchedTasks = tasks.filter((item) => idSet.has(item.id))
      if (matchedTasks.length < idSet.size || !areTasksFinished(matchedTasks)) {
        return
      }
      window.clearInterval(timer)
      handleDeleteSyncTasksResult(matchedTasks, productIds)
    } catch {
      pollFailures += 1
      if (pollFailures >= 3) {
        window.clearInterval(timer)
        clearListedSyncTaskBusy(productIds)
      }
    }
  }, 2000)
}

function watchListingStatusSyncTasksCompletion(taskIdsToWatch: string[], productIds: number[], listingStatus: RakutenListingStatus) {
  if (taskIdsToWatch.length < 1 || props.status !== 'listed') {
    clearListedSyncTaskBusy(productIds)
    return
  }
  const idSet = new Set(taskIdsToWatch)
  let pollFailures = 0
  const timer = window.setInterval(async () => {
    try {
      const tasks = await api.listSyncTasks()
      pollFailures = 0
      const matchedTasks = tasks.filter((item) => idSet.has(item.id))
      if (matchedTasks.length < idSet.size || !areTasksFinished(matchedTasks)) {
        return
      }
      window.clearInterval(timer)
      handleListingStatusSyncTasksResult(matchedTasks, productIds, listingStatus)
    } catch {
      pollFailures += 1
      if (pollFailures >= 3) {
        window.clearInterval(timer)
        clearListedSyncTaskBusy(productIds)
      }
    }
  }, 2000)
}

function handleListingStatusSyncTaskResult(task: SyncTask, productIds: number[], listingStatus: RakutenListingStatus) {
  const actionText = listingStatus === 'listed' ? '上架' : '下架'
  clearListedSyncTaskBusy(productIds)
  if (task.status === 'success') {
    applyResolvedListingStatus(task.successIds?.length ? task.successIds : productIds, listingStatus)
    ElMessage.success(task.message || `批量${actionText}已完成`)
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'partial') {
    const { successIds } = taskOutcomeIds(task, productIds)
    applyResolvedListingStatus(successIds, listingStatus)
    ElMessage.warning(task.errorDetail || task.message || `批量${actionText}部分成功，请到同步任务中查看异常信息`)
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'cancelled') {
    const successIds = task.successIds?.length ? task.successIds : []
    applyResolvedListingStatus(successIds, listingStatus)
    ElMessage.warning(task.errorDetail || task.message || `批量${actionText}已终止，请到同步任务中查看详情`)
    maybeRefreshAfterOptimisticAction()
    return
  }
  ElMessage.error(task.errorDetail || task.message || `批量${actionText}失败，请到同步任务中查看错误信息`)
}

function handleListingStatusSyncTasksResult(tasks: SyncTask[], productIds: number[], listingStatus: RakutenListingStatus) {
  if (tasks.length === 1) {
    handleListingStatusSyncTaskResult(tasks[0], productIds, listingStatus)
    return
  }
  const actionText = listingStatus === 'listed' ? '上架' : '下架'
  clearListedSyncTaskBusy(productIds)
  const { successIds } = aggregateTaskOutcomeIds(tasks, productIds)
  const allSuccess = tasks.every((task) => task.status === 'success')
  if (successIds.length > 0) {
    applyResolvedListingStatus(successIds, listingStatus)
    maybeRefreshAfterOptimisticAction()
  }
  if (allSuccess) {
    ElMessage.success(`批量${actionText}已完成`)
    return
  }
  ElMessage.warning(`批量${actionText}部分任务未成功，请到同步任务中查看异常信息`)
}

function handleDeleteSyncTaskResult(task: SyncTask, productIds: number[]) {
  clearListedSyncTaskBusy(productIds)
  if (task.status === 'success') {
    removeVisibleProducts(task.successIds?.length ? task.successIds : productIds)
    ElMessage.success(task.message || '批量删除已完成')
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'partial') {
    const { successIds } = taskOutcomeIds(task, productIds)
    removeVisibleProducts(successIds)
    ElMessage.warning(task.errorDetail || task.message || '批量删除部分成功，请到同步任务中查看异常信息')
    maybeRefreshAfterOptimisticAction()
    return
  }
  if (task.status === 'cancelled') {
    const successIds = task.successIds?.length ? task.successIds : []
    removeVisibleProducts(successIds)
    ElMessage.warning(task.errorDetail || task.message || '批量删除已终止，请到同步任务中查看详情')
    maybeRefreshAfterOptimisticAction()
    return
  }
  ElMessage.error(task.errorDetail || task.message || '批量删除失败，请到同步任务中查看错误信息')
}

function handleDeleteSyncTasksResult(tasks: SyncTask[], productIds: number[]) {
  if (tasks.length === 1) {
    handleDeleteSyncTaskResult(tasks[0], productIds)
    return
  }
  clearListedSyncTaskBusy(productIds)
  const { successIds } = aggregateTaskOutcomeIds(tasks, productIds)
  const allSuccess = tasks.every((task) => task.status === 'success')
  if (successIds.length > 0) {
    removeVisibleProducts(successIds)
    maybeRefreshAfterOptimisticAction()
  }
  if (allSuccess) {
    ElMessage.success('批量删除已完成')
    return
  }
  ElMessage.warning('批量删除部分任务未成功，请到同步任务中查看异常信息')
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

function normalizeUrlPart(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function sourceProductPageUrl(product: ProductDetail) {
  return normalizeUrlPart(product.detail.sourceUrl || product.sourceUrl)
}

function buildStoreProductPageUrl(storeCode: unknown, itemNumber: unknown) {
  const normalizedStoreCode = normalizeUrlPart(storeCode).replace(/^\/+|\/+$/g, '')
  const normalizedItemNumber = normalizeUrlPart(itemNumber)
  if (!normalizedStoreCode || !normalizedItemNumber) {
    return ''
  }
  return `https://item.rakuten.co.jp/${encodeURIComponent(normalizedStoreCode)}/${encodeURIComponent(normalizedItemNumber)}/`
}

function listedStorePageUrl(store: ProductListedStore) {
  return normalizeUrlPart(store.itemUrl) || buildStoreProductPageUrl(store.storeCode, store.itemNumber || store.manageNumber)
}

function listedStorePageLinks(product: ProductDetail | null) {
  if (!product) {
    return []
  }
  const links: Array<{ label: string; url: string }> = []
  const seen = new Set<string>()
  for (const store of product.listedStores || []) {
    const url = listedStorePageUrl(store)
    if (!url || seen.has(url)) {
      continue
    }
    seen.add(url)
    links.push({ label: listedStoreLabel(store), url })
  }
  return links
}

function currentStoreProductPageUrl(product: ProductDetail) {
  if (props.status === 'listed') {
    return normalizeUrlPart(product.detail.rakutenItemUrl || product.rakutenItemUrl || product.detail.sourceUrl || product.sourceUrl)
  }
  return listedStorePageLinks(product)[0]?.url || ''
}

function primaryProductPageLabel() {
  return props.status === 'listed' ? '打开店铺商品页' : '打开源店铺商品页'
}

function primaryProductPageType() {
  return props.status === 'listed' ? 'success' : 'primary'
}

function primaryProductPageUrl(product: ProductDetail) {
  return props.status === 'listed' ? currentStoreProductPageUrl(product) : sourceProductPageUrl(product)
}

function openStoreProductPage(url: string | number | object) {
  const normalizedUrl = normalizeUrlPart(url)
  if (normalizedUrl) {
    window.open(normalizedUrl, '_blank', 'noopener')
  }
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
  detailForm.genreId = ''
  detailForm.genrePath = ''
  detailForm.genrePathZh = ''
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
  detailForm.genreId = product.genreId || ''
  detailForm.genrePath = product.genrePath || ''
  detailForm.genrePathZh = product.genrePathZh || ''
  detailForm.variants = product.detail.variants.map((variant) => ({
    variantId: variant.variantId,
    standardPrice: Number(variant.standardPrice || 0),
    hidden: Boolean(variant.hidden),
    singleProduct: Boolean(variant.singleProduct),
  }))
}

function fillImageDraft(product: ProductDetail) {
  detailImageDraft.value = detailImageUrlsFromProduct(product).map((url, index) => ({ sourceIndex: index, sourceUrl: url, currentUrl: url }))
}

function detailVariantForm(variant: ProductVariant) {
  return detailForm.variants.find((item) => item.variantId === variant.variantId)
}

function detailEditable() {
  return ['pending', 'approved', 'error', 'listed_master', 'listed'].includes(props.status)
}

function imageEditable() {
  return props.status === 'pending'
}

function detailSaveButtonText() {
  return props.status === 'listed' ? '同步修改' : '保存'
}

function selectDetailGenre(genre: RakutenGenreOption) {
  detailForm.genreId = genre.genreId
  detailForm.genrePath = genre.genrePath
  detailForm.genrePathZh = genre.genrePathZh
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
  if (['pending', 'listed'].includes(props.status) && (!/^\d{6}$/.test(detailForm.genreId) || !detailForm.genrePath)) {
    ElMessage.warning('请先选择有效品类')
    return
  }
  const variants = detailForm.variants.map((variant) => ({
    variantId: variant.variantId,
    standardPrice: Number(variant.standardPrice),
    hidden: Boolean(variant.hidden),
    singleProduct: Boolean(variant.singleProduct),
  }))
  for (const variant of variants) {
    const variantLabel = variant.singleProduct ? '价格' : `SKU ${variant.variantId} 价格`
    if (!Number.isFinite(variant.standardPrice) || variant.standardPrice <= 0) {
      ElMessage.warning(`${variantLabel}必须大于 0`)
      return
    }
    if (!Number.isInteger(variant.standardPrice)) {
      ElMessage.warning(`${variantLabel}必须为日元整数`)
      return
    }
  }
  detailSaving.value = true
  try {
    const imageChanges = props.status === 'pending' ? await buildPendingImagePayload() : undefined
    const payload = {
      title: detailForm.title.trim(),
      tagline: detailForm.tagline.trim(),
      genreId: ['pending', 'listed'].includes(props.status) ? detailForm.genreId : undefined,
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
    mergeUpdatedProduct(product)
    ElMessage.success(props.status === 'listed' ? '商品详情已同步到乐天' : '商品详情已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, props.status === 'listed' ? '同步修改商品详情失败' : '保存商品详情失败'))
  } finally {
    detailSaving.value = false
  }
}

async function savePendingInlineText(product: ProductItem) {
  if (props.status !== 'pending' || product.reviewStatus !== 'pending') {
    return
  }
  const draft = pendingInlineDraft(product)
  const title = draft.title.trim()
  const tagline = draft.tagline.trim()
  if (!title) {
    ElMessage.warning('商品标题不能为空')
    setPendingInlineDraft(product)
    return
  }
  if (title === (product.title || '').trim() && tagline === productTagline(product).trim()) {
    setPendingInlineDraft(product)
    return
  }
  await savePendingInlineProduct(product, {
    title,
    tagline,
    successMessage: '',
    fallbackMessage: '保存商品信息失败',
  })
}

async function savePendingInlineProduct(
  product: ProductItem,
  options: {
    title: string
    tagline: string
    imageChanges?: ProductDetailEditPayload['imageChanges']
    successMessage?: string
    fallbackMessage: string
  },
) {
  setPendingInlineSaving(product.id, true)
  try {
    const updatedProduct = await api.updateProductLocalDetail(product.id, {
      title: options.title,
      tagline: options.tagline,
      variants: [],
      imageChanges: options.imageChanges,
    })
    mergeUpdatedProduct(updatedProduct)
    if (options.successMessage) {
      ElMessage.success(options.successMessage)
    }
    return true
  } catch (error) {
    setPendingInlineDraft(product)
    ElMessage.error(toApiErrorMessage(error, options.fallbackMessage))
    return false
  } finally {
    setPendingInlineSaving(product.id, false)
  }
}

function triggerInlineImageReplace(product: ProductItem, imageIndex = 0) {
  if (props.status !== 'pending' || isPendingInlineSaving(product)) {
    return
  }
  replacingInlineImageProductId.value = product.id
  replacingInlineImageIndex.value = Math.max(0, imageIndex)
  if (inlineImageFileInputRef.value) {
    inlineImageFileInputRef.value.value = ''
    inlineImageFileInputRef.value.click()
  }
}

async function handleInlineImageReplace(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const productId = replacingInlineImageProductId.value
  const imageIndex = replacingInlineImageIndex.value
  const product = productId == null ? null : products.value.find((item) => item.id === productId)
  if (!file || !product) {
    replacingInlineImageProductId.value = null
    replacingInlineImageIndex.value = 0
    input.value = ''
    return
  }
  setPendingInlineSaving(product.id, true)
  try {
    const detail = await api.getProductDetail(product.id)
    const currentImages = detailImageUrlsFromProduct(detail)
    const draft = await api.uploadProductImageDraft(product.id, file)
    const draftState = pendingInlineDraft(product)
    const title = draftState.title.trim() || detail.detail.title || product.title
    const tagline = draftState.tagline.trim()
    const sourceImage = currentImages[imageIndex] || ''
    const nextImages = [...currentImages]
    if (imageIndex < nextImages.length) {
      nextImages[imageIndex] = draft.url
    } else {
      nextImages.push(draft.url)
    }
    await savePendingInlineProduct(product, {
      title,
      tagline,
      imageChanges: {
        images: nextImages,
        replacements: sourceImage ? [{ from: sourceImage, to: draft.url }] : [],
        removeUrls: [],
      },
      successMessage: '商品图片已更新',
      fallbackMessage: '替换商品图片失败',
    })
  } catch (error) {
    setPendingInlineDraft(product)
    ElMessage.error(toApiErrorMessage(error, '替换商品图片失败'))
  } finally {
    setPendingInlineSaving(product.id, false)
    replacingInlineImageProductId.value = null
    replacingInlineImageIndex.value = 0
    input.value = ''
  }
}

async function editPendingInlineImageWithMeitu(product: ProductItem, imageIndex: number) {
  if (props.status !== 'pending' || product.reviewStatus !== 'pending' || isPendingInlineSaving(product)) {
    return
  }
  const imageSrc = productListImageUrls(product)[imageIndex]
  if (!imageSrc) {
    ElMessage.warning('图片不存在')
    return
  }
  try {
    await openMeituImageEditor({
      imageSrc,
      title: '编辑图片',
      onSave: (result) => applyPendingInlineMeituImageEdit(product, imageIndex, result),
    })
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '打开图片编辑器失败'))
  }
}

async function applyPendingInlineMeituImageEdit(product: ProductItem, imageIndex: number, result: MeituImageSaveResult) {
  const imageBase64 = String(result.imageBase64 || '').trim()
  if (!imageBase64) {
    ElMessage.warning('编辑结果为空')
    return
  }
  setPendingInlineSaving(product.id, true)
  try {
    const detail = await api.getProductDetail(product.id)
    const currentImages = detailImageUrlsFromProduct(detail)
    const sourceImage = currentImages[imageIndex]
    if (!sourceImage) {
      ElMessage.warning('图片不存在')
      return
    }
    const draft = await api.uploadProductImageDraftBase64(product.id, {
      imageBase64,
      ext: normalizeMeituImageExt(result.ext, imageBase64),
    })
    const nextImages = [...currentImages]
    nextImages[imageIndex] = draft.url
    const draftState = pendingInlineDraft(product)
    await savePendingInlineProduct(product, {
      title: draftState.title.trim() || detail.detail.title || product.title,
      tagline: draftState.tagline.trim(),
      imageChanges: {
        images: nextImages,
        replacements: [{ from: sourceImage, to: draft.url }],
        removeUrls: [],
      },
      successMessage: '商品图片已编辑',
      fallbackMessage: '编辑商品图片失败',
    })
  } catch (error) {
    setPendingInlineDraft(product)
    ElMessage.error(toApiErrorMessage(error, '编辑商品图片失败'))
  } finally {
    setPendingInlineSaving(product.id, false)
  }
}

async function deletePendingInlineImage(product: ProductItem, imageIndex: number) {
  if (props.status !== 'pending' || product.reviewStatus !== 'pending' || isPendingInlineSaving(product)) {
    return
  }
  setPendingInlineSaving(product.id, true)
  try {
    const detail = await api.getProductDetail(product.id)
    const currentImages = detailImageUrlsFromProduct(detail)
    const sourceImage = currentImages[imageIndex]
    if (!sourceImage) {
      ElMessage.warning('图片不存在')
      return
    }
    const draftState = pendingInlineDraft(product)
    await savePendingInlineProduct(product, {
      title: draftState.title.trim() || detail.detail.title || product.title,
      tagline: draftState.tagline.trim(),
      imageChanges: {
        images: currentImages.filter((_, index) => index !== imageIndex),
        replacements: [],
        removeUrls: [sourceImage],
      },
      successMessage: '商品图片已删除',
      fallbackMessage: '删除商品图片失败',
    })
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '删除商品图片失败'))
  } finally {
    setPendingInlineSaving(product.id, false)
  }
}

async function deleteSelectedPendingImages(product: ProductItem) {
  if (props.status !== 'pending' || product.reviewStatus !== 'pending' || isPendingInlineSaving(product)) {
    return
  }
  const selectedImages = new Set(selectedPendingImageUrls(product.id))
  if (selectedImages.size < 1) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除商品「${productDisplayName(product)}」中选中的 ${selectedImages.size} 张图片？`,
      '删除图片',
      {
        confirmButtonText: '删除图片',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    const detail = await api.getProductDetail(product.id)
    const currentImages = detailImageUrlsFromProduct(detail)
    const removeUrls = currentImages.filter((image) => selectedImages.has(image))
    if (removeUrls.length < 1) {
      clearPendingImageSelection(product.id)
      ElMessage.warning('选中的图片已发生变化，请重新选择')
      return
    }
    const draftState = pendingInlineDraft(product)
    const saved = await savePendingInlineProduct(product, {
      title: draftState.title.trim() || detail.detail.title || product.title,
      tagline: draftState.tagline.trim(),
      imageChanges: {
        images: currentImages.filter((image) => !selectedImages.has(image)),
        replacements: [],
        removeUrls,
      },
      successMessage: `已删除 ${removeUrls.length} 张商品图片`,
      fallbackMessage: '批量删除商品图片失败',
    })
    if (saved) {
      clearPendingImageSelection(product.id)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '批量删除商品图片失败'))
    }
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
  if (variant.singleProduct) {
    return '单品'
  }
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
    } else if (operation.type === 'replaceBase64') {
      const draft = await api.uploadProductImageDraftBase64(detailForm.productId!, {
        imageBase64: operation.imageBase64,
        ext: operation.ext,
      })
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
    .filter((operation): operation is Extract<PendingImageOperation, { type: 'replace' | 'replaceBase64' }> => (
      operation.type === 'replace' || operation.type === 'replaceBase64'
    ))
    .map((operation) => ({ from: operation.sourceUrl, to: replaceMap[operation.sourceUrl] || '' }))
    .filter((operation) => operation.to)
  return { images, replacements, removeUrls }
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
    if (image.currentUrl.startsWith('blob:') || image.currentUrl.startsWith('data:image/')) {
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

async function editDetailImageWithMeitu(index: number) {
  if (!selectedProductDetail.value || !imageEditable()) {
    return
  }
  const image = detailImageDraft.value[index]
  if (!image) {
    ElMessage.warning('图片不存在')
    return
  }
  imageOperating.value = true
  try {
    await openMeituImageEditor({
      imageSrc: image.currentUrl,
      title: '编辑图片',
      onSave: (result) => applyMeituImageEdit(image.sourceUrl, result),
    })
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '打开美图编辑器失败'))
  } finally {
    imageOperating.value = false
  }
}

function applyMeituImageEdit(sourceUrl: string, result: MeituImageSaveResult) {
  const imageBase64 = String(result.imageBase64 || '').trim()
  if (!imageBase64) {
    ElMessage.warning('美图编辑结果为空')
    return
  }
  const imageIndex = detailImageDraft.value.findIndex((image) => image.sourceUrl === sourceUrl)
  if (imageIndex < 0) {
    ElMessage.warning('图片已变更，请重新打开编辑器')
    return
  }
  const ext = normalizeMeituImageExt(result.ext, imageBase64)
  const previewUrl = meituPreviewUrl(imageBase64, ext)
  appendPendingImageOperation({ type: 'replaceBase64', sourceUrl, imageBase64, ext, previewUrl })
  detailImageDraft.value = detailImageDraft.value.map((image, index) => (
    index === imageIndex ? { ...image, currentUrl: previewUrl } : image
  ))
  ElMessage.success('美图编辑已生成草稿，点击保存后生效')
}

function normalizeMeituImageExt(ext: string, imageBase64: string) {
  const dataUrlMatch = imageBase64.match(/^data:image\/([a-z0-9.+-]+);base64,/i)
  const rawExt = String(ext || dataUrlMatch?.[1] || 'jpg').trim().replace(/^\./, '').toLowerCase()
  return rawExt === 'jpeg' ? 'jpg' : rawExt
}

function meituPreviewUrl(imageBase64: string, ext: string) {
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(imageBase64)) {
    return imageBase64
  }
  return `data:${meituImageMimeType(ext)};base64,${imageBase64}`
}

function meituImageMimeType(ext: string) {
  if (ext === 'png') {
    return 'image/png'
  }
  if (ext === 'gif') {
    return 'image/gif'
  }
  return 'image/jpeg'
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
            批量删除商品
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
            :disabled="selectedIds.length < 1 || hasSelectedProductBusy()"
            :loading="operating"
            @click="updateSelectedListingStatus('listed')"
          >
            批量上架
          </el-button>
          <el-button
            type="warning"
            plain
            :icon="Warning"
            :disabled="selectedIds.length < 1 || hasSelectedProductBusy()"
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
          :disabled="selectedIds.length < 1 || hasSelectedProductBusy()"
          :loading="operating"
          @click="removeSelected"
        >
          批量删除商品
        </el-button>
        <div v-if="status === 'approved' || status === 'listed_master'" class="approved-head-actions">
          <el-button
            type="primary"
            :icon="Upload"
            :disabled="selectedIds.length < 1 || hasSelectedProductBusy()"
            :loading="operating"
            @click="createListingTask"
          >
            {{ status === 'listed_master' ? '批量重新上架' : '批量上架' }}
          </el-button>
          <el-button type="danger" plain :icon="Delete" :disabled="selectedIds.length < 1 || hasSelectedProductBusy()" :loading="operating" @click="removeSelected">
            批量删除商品
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
        <div v-if="status === 'listed_master'" class="filter-field filter-listed-store-field">
          <el-select
            v-model="filters.listedStoreId"
            class="full-control"
            clearable
            filterable
            placeholder="已上架店铺"
            @change="searchProducts"
          >
            <el-option label="无店铺标记" :value="LISTED_STORE_NONE_FILTER" />
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="store.aliasName || store.storeName"
              :value="store.id"
            />
          </el-select>
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
        height="max(620px, calc(100vh - 330px))"
        :row-class-name="productRowClassName"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="46" :selectable="isProductSelectable" />
        <el-table-column :label="status === 'pending' ? '商品信息' : '图片'" :min-width="status === 'pending' ? 960 : 86">
          <template #default="{ row }">
            <div v-if="status === 'pending'" class="pending-product-content">
              <div v-if="row.replacementTaskId" class="pending-replacement-marker">
                <el-tag type="warning" effect="plain">
                  替换商品
                </el-tag>
                <span>
                  目标店铺：{{ row.replacementTargetStoreName || `店铺 ${row.replacementTargetStoreId || '-'}` }}
                </span>
                <span>
                  商品管理编号：{{ row.replacementTargetManageNumber || '-' }}
                </span>
              </div>
              <div class="pending-inline-fields">
                <PendingProductGenreSelect
                  :product="row"
                  :disabled="isPendingInlineSaving(row)"
                  @updated="mergeUpdatedProduct"
                />
                <el-input
                  class="pending-title-input"
                  :model-value="pendingInlineDraft(row).title"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 8 }"
                  resize="vertical"
                  maxlength="500"
                  placeholder="商品标题"
                  :disabled="isPendingInlineSaving(row)"
                  @update:model-value="setPendingInlineDraftField(row, 'title', $event)"
                  @blur="savePendingInlineText(row)"
                />
                <el-input
                  class="pending-tagline-input"
                  :model-value="pendingInlineDraft(row).tagline"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 8 }"
                  resize="vertical"
                  maxlength="174"
                  placeholder="商品副标题"
                  :disabled="isPendingInlineSaving(row)"
                  @update:model-value="setPendingInlineDraftField(row, 'tagline', $event)"
                  @blur="savePendingInlineText(row)"
                />
              </div>
              <div class="pending-image-editor">
                <div
                  v-for="(image, imageIndex) in productListImageUrls(row)"
                  :key="`${row.id}-${image}-${imageIndex}`"
                  class="pending-image-card"
                  :class="{ 'is-selected': isPendingImageSelected(row.id, image) }"
                >
                  <div class="pending-image-selector" @click.stop>
                    <el-checkbox
                      :model-value="isPendingImageSelected(row.id, image)"
                      :disabled="isPendingInlineSaving(row)"
                      :aria-label="`选择第 ${imageIndex + 1} 张图片`"
                      @change="togglePendingImageSelection(row.id, image, Boolean($event))"
                    />
                  </div>
                  <el-image
                    class="pending-product-image"
                    :src="image"
                    fit="cover"
                    lazy
                    :preview-src-list="productListImageUrls(row)"
                    :initial-index="imageIndex"
                    preview-teleported
                  />
                  <div class="pending-image-actions">
                    <el-tooltip content="编辑图片" placement="top">
                      <el-button
                        :icon="EditPen"
                        size="small"
                        type="success"
                        plain
                        aria-label="编辑图片"
                        :loading="isPendingInlineSaving(row)"
                        :disabled="isPendingInlineSaving(row)"
                        @click="editPendingInlineImageWithMeitu(row, imageIndex)"
                      />
                    </el-tooltip>
                    <el-tooltip content="替换图片" placement="top">
                      <el-button
                        :icon="Upload"
                        size="small"
                        aria-label="替换图片"
                        :loading="isPendingInlineSaving(row)"
                        :disabled="isPendingInlineSaving(row)"
                        @click="triggerInlineImageReplace(row, imageIndex)"
                      />
                    </el-tooltip>
                    <el-tooltip content="删除图片" placement="top">
                      <el-button
                        :icon="Delete"
                        size="small"
                        type="danger"
                        plain
                        aria-label="删除图片"
                        :loading="isPendingInlineSaving(row)"
                        :disabled="isPendingInlineSaving(row)"
                        @click="deletePendingInlineImage(row, imageIndex)"
                      />
                    </el-tooltip>
                  </div>
                </div>
                <button
                  v-if="productListImageUrls(row).length < 1"
                  class="pending-image-empty-card"
                  type="button"
                  :disabled="isPendingInlineSaving(row)"
                  @click="triggerInlineImageReplace(row, 0)"
                >
                  添加图片
                </button>
              </div>
            </div>
            <template v-else>
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
          </template>
        </el-table-column>
        <el-table-column v-if="status !== 'pending'" label="商品标题" min-width="300">
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
        <el-table-column class-name="table-action-column" label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <div class="row-action-stack">
              <el-button :icon="View" link type="primary" :disabled="isProductBusy(row)" @click="openProductDetail(row)">
                查看详情
              </el-button>
              <el-button
                v-if="status === 'listed'"
                :icon="Refresh"
                link
                type="warning"
                :disabled="isProductBusy(row)"
                @click="openProductReplacement(row)"
              >
                替换商品
              </el-button>
              <template v-if="status === 'approved' || status === 'listed_master'">
                <el-button
                  :icon="Upload"
                  link
                  type="success"
                  :disabled="isProductBusy(row)"
                  :loading="isListingProductBusy(row)"
                  @click="createListingTaskForProduct(row)"
                >
                  {{ status === 'listed_master' ? '重新上架' : '上架' }}
                </el-button>
                <el-button :icon="Delete" link type="danger" :disabled="isProductBusy(row)" @click="removeProduct(row)">
                  删除商品
                </el-button>
              </template>
              <template v-if="status === 'pending'">
                <el-button :icon="MagicStick" link type="primary" @click="openTitleOptimization(row)">
                  优化标题
                </el-button>
                <el-button
                  :icon="Delete"
                  link
                  type="danger"
                  :disabled="selectedPendingImageCount(row.id) < 1 || isPendingInlineSaving(row)"
                  :loading="isPendingInlineSaving(row)"
                  @click="deleteSelectedPendingImages(row)"
                >
                  删除图片
                </el-button>
                <el-button
                  v-if="row.replacementTaskId"
                  :icon="Refresh"
                  link
                  type="danger"
                  :disabled="operating"
                  @click="confirmPendingReplacement(row)"
                >
                  确认替换
                </el-button>
                <el-button v-else :icon="Finished" link type="success" @click="approveProduct(row)">
                  审核通过
                </el-button>
                <el-button v-if="!row.replacementTaskId" :icon="EditPen" link type="warning" @click="markError([row.id], row)">
                  标记异常
                </el-button>
                <el-button :icon="Delete" link type="danger" @click="removeProduct(row)">
                  删除商品
                </el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <input v-if="status === 'pending'" ref="inlineImageFileInputRef" class="hidden-file-input" type="file" accept="image/jpeg,image/png,image/gif" @change="handleInlineImageReplace" />
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

    <ProductTitleOptimizationDialog
      v-model="titleOptimizationVisible"
      :product="titleOptimizationProduct"
      @saved="handleTitleOptimizationSaved"
    />

    <StoreProductReplacementDialog
      v-model="replacementVisible"
      :product="replacementProduct"
      @created="handleProductReplacementCreated"
      @completed="handleProductReplacementCompleted"
    />

    <el-dialog v-model="listingDialogVisible" :title="listingDialogTitle" width="520px" append-to-body>
      <el-form label-position="top" class="listing-dialog-form">
        <el-form-item label="目标店铺">
          <el-select
            v-model="listingForm.storeIds"
            class="full-control"
            clearable
            collapse-tags
            collapse-tags-tooltip
            filterable
            multiple
            :max-collapse-tags="2"
            placeholder="选择上架店铺"
          >
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
                <el-form-item v-if="(status === 'pending' || status === 'listed') && detailGenreProduct" label="商品品类">
                  <PendingProductGenreSelect
                    :product="detailGenreProduct"
                    mode="draft"
                    :disabled="detailSaving"
                    @selected="selectDetailGenre"
                  />
                </el-form-item>
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
              <div class="detail-link-actions">
                <el-button
                  v-if="primaryProductPageUrl(selectedProductDetail)"
                  :icon="View"
                  link
                  :type="primaryProductPageType()"
                  tag="a"
                  :href="primaryProductPageUrl(selectedProductDetail)"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ primaryProductPageLabel() }}
                </el-button>
                <template v-if="status === 'listed_master' && listedStorePageLinks(selectedProductDetail).length === 1">
                  <el-button
                    :icon="View"
                    link
                    type="success"
                    tag="a"
                    :href="listedStorePageLinks(selectedProductDetail)[0].url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开店铺商品页
                  </el-button>
                </template>
                <el-dropdown
                  v-else-if="status === 'listed_master' && listedStorePageLinks(selectedProductDetail).length > 1"
                  trigger="click"
                  @command="openStoreProductPage"
                >
                  <el-button :icon="View" link type="success">
                    打开店铺商品页
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="link in listedStorePageLinks(selectedProductDetail)"
                        :key="link.url"
                        :command="link.url"
                      >
                        {{ link.label }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
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
                    <el-button v-if="imageEditable()" :icon="EditPen" link type="success" :disabled="imageOperating" @click="editDetailImageWithMeitu(index)">
                      编辑
                    </el-button>
                    <el-button v-if="imageEditable()" :icon="Upload" link type="warning" :disabled="imageOperating" @click="triggerReplaceImage(index)">
                      替换
                    </el-button>
                    <el-button v-if="imageEditable()" :icon="Delete" link type="danger" :disabled="imageOperating" @click="deleteDetailImage(index)">
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

.filter-listed-store-field {
  flex: 0 1 232px;
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

.pending-product-content {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 6px 2px 10px;
}

.pending-image-editor {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.pending-replacement-marker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  color: var(--text-muted);
}

.pending-image-card {
  position: relative;
  display: grid;
  align-content: start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  border-radius: 6px;
}

.pending-image-card.is-selected {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}

.pending-image-selector {
  position: absolute;
  z-index: 2;
  top: 8px;
  left: 8px;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
}

.pending-image-selector :deep(.el-checkbox) {
  height: 20px;
  margin-right: 0;
}

.pending-image-selector :deep(.el-checkbox__inner) {
  width: 20px;
  height: 20px;
}

.pending-product-image {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
}

.pending-image-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.pending-image-actions :deep(.el-button) {
  justify-content: center;
  width: 100%;
  min-width: 0;
  height: 30px;
  margin-left: 0;
  padding: 0;
}

.pending-image-empty-card {
  display: inline-grid;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  place-items: center;
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  background: var(--panel-muted);
  color: var(--text-faint);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.pending-image-empty-card:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.pending-inline-fields {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.pending-inline-fields :deep(.el-textarea__inner) {
  color: var(--text-main);
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.pending-inline-fields .pending-tagline-input :deep(.el-textarea__inner) {
  color: var(--text-muted);
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

.row-action-stack {
  display: grid;
  justify-items: start;
  gap: 4px;
}

.row-action-stack :deep(.el-button) {
  margin-left: 0;
  padding: 0;
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

.detail-link-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
}

.detail-link-actions :deep(.el-button) {
  margin-left: 0;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 4px;
  min-height: 58px;
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
