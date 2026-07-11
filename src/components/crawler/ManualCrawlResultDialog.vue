<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen, Upload } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { CrawlTask, ProductDetail, ProductDetailEditPayload, ProductItem, StoreAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { openMeituImageEditor, type MeituImageSaveResult } from '../../utils/meituImageEditor'

const props = defineProps<{
  modelValue: boolean
  task: CrawlTask | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const listing = shallowRef(false)
const products = shallowRef<ProductItem[]>([])
const stores = shallowRef<StoreAccount[]>([])
const savingIds = shallowRef<Set<number>>(new Set())
const replaceProductId = shallowRef<number | null>(null)
const replaceImageIndex = shallowRef(0)
const fileInput = shallowRef<HTMLInputElement | null>(null)
const drafts = reactive<Record<number, { title: string; tagline: string }>>({})
const listingForm = reactive({
  storeIds: [] as number[],
  taskName: '',
})

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const eligibleProducts = computed(() =>
  products.value.filter((product) =>
    product.reviewStatus === 'pending'
    && !product.listingTaskId,
  ),
)

const selectableStores = computed(() => stores.value.filter((store) => store.enabled))

watch(
  () => [props.modelValue, props.task?.id] as const,
  ([visible, taskId]) => {
    if (visible && taskId) {
      void loadResult(taskId)
    }
  },
  { immediate: true },
)

async function loadResult(taskId: string) {
  loading.value = true
  try {
    const [taskProducts, storeRows] = await Promise.all([
      api.listProducts({ taskId, page: 1, pageSize: 500 }),
      api.listStores(),
    ])
    products.value = taskProducts
    stores.value = storeRows
    listingForm.storeIds = []
    listingForm.taskName = ''
    syncDrafts(taskProducts)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载采集商品详情失败'))
  } finally {
    loading.value = false
  }
}

function syncDrafts(rows: ProductItem[]) {
  const ids = new Set(rows.map((product) => product.id))
  for (const key of Object.keys(drafts)) {
    if (!ids.has(Number(key))) {
      delete drafts[Number(key)]
    }
  }
  for (const product of rows) {
    drafts[product.id] = {
      title: product.title || '',
      tagline: String(product.tagline || ''),
    }
  }
}

function productImages(product: ProductItem) {
  const urls = [...(product.images || [])]
  if (product.imageUrl && !urls.includes(product.imageUrl)) {
    urls.unshift(product.imageUrl)
  }
  return urls
    .map((url) => String(url || '').trim())
    .filter((url, index, values) => Boolean(url) && values.indexOf(url) === index)
}

function listedStoreLabel(store: { storeId: number; storeName?: string; aliasName?: string }) {
  const current = stores.value.find((item) => item.id === store.storeId)
  return current?.aliasName || store.aliasName || current?.storeName || store.storeName || `店铺 ${store.storeId}`
}

function listedStoreRealName(store: { storeId: number; storeName?: string; aliasName?: string }) {
  const current = stores.value.find((item) => item.id === store.storeId)
  return current?.storeName || store.storeName || listedStoreLabel(store)
}

function isSaving(productId: number) {
  return savingIds.value.has(productId)
}

function setSaving(productId: number, saving: boolean) {
  const next = new Set(savingIds.value)
  if (saving) {
    next.add(productId)
  } else {
    next.delete(productId)
  }
  savingIds.value = next
}

function mergeProduct(product: ProductItem) {
  products.value = products.value.map((item) => item.id === product.id ? { ...item, ...product } : item)
  drafts[product.id] = {
    title: product.title || '',
    tagline: String(product.tagline || ''),
  }
}

async function saveText(product: ProductItem) {
  const draft = drafts[product.id]
  const title = draft?.title.trim() || ''
  const tagline = draft?.tagline.trim() || ''
  if (!title) {
    ElMessage.warning('商品标题不能为空')
    drafts[product.id] = { title: product.title || '', tagline: String(product.tagline || '') }
    return
  }
  if (title === product.title.trim() && tagline === String(product.tagline || '').trim()) {
    return
  }
  await saveProduct(product, {
    title,
    tagline,
    variants: [],
  }, '商品信息已同步')
}

async function saveProduct(
  product: ProductItem,
  payload: ProductDetailEditPayload,
  successMessage: string,
) {
  setSaving(product.id, true)
  try {
    const updated = await api.updateProductLocalDetail(product.id, payload)
    mergeProduct(updated)
    ElMessage.success(successMessage)
  } catch (error) {
    drafts[product.id] = { title: product.title || '', tagline: String(product.tagline || '') }
    ElMessage.error(toApiErrorMessage(error, '同步商品修改失败'))
  } finally {
    setSaving(product.id, false)
  }
}

function detailImages(detail: ProductDetail) {
  const urls = [...(detail.detail.images || [])]
  if (detail.imageUrl && !urls.includes(detail.imageUrl)) {
    urls.unshift(detail.imageUrl)
  }
  return urls
}

function currentText(product: ProductItem, detail: ProductDetail) {
  const draft = drafts[product.id]
  return {
    title: draft?.title.trim() || detail.detail.title || product.title,
    tagline: draft?.tagline.trim() || '',
  }
}

function replaceImage(product: ProductItem, imageIndex: number) {
  if (isSaving(product.id)) {
    return
  }
  replaceProductId.value = product.id
  replaceImageIndex.value = imageIndex
  if (fileInput.value) {
    fileInput.value.value = ''
    fileInput.value.click()
  }
}

async function handleImageFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const product = products.value.find((item) => item.id === replaceProductId.value)
  const imageIndex = replaceImageIndex.value
  if (!file || !product) {
    input.value = ''
    return
  }
  setSaving(product.id, true)
  try {
    const detail = await api.getProductDetail(product.id)
    const images = detailImages(detail)
    const sourceImage = images[imageIndex] || ''
    const draftImage = await api.uploadProductImageDraft(product.id, file)
    const nextImages = [...images]
    if (imageIndex < nextImages.length) {
      nextImages[imageIndex] = draftImage.url
    } else {
      nextImages.push(draftImage.url)
    }
    const text = currentText(product, detail)
    const updated = await api.updateProductLocalDetail(product.id, {
      ...text,
      variants: [],
      imageChanges: {
        images: nextImages,
        replacements: sourceImage ? [{ from: sourceImage, to: draftImage.url }] : [],
        removeUrls: [],
      },
    })
    mergeProduct(updated)
    ElMessage.success('商品图片已同步')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '替换商品图片失败'))
  } finally {
    setSaving(product.id, false)
    replaceProductId.value = null
    replaceImageIndex.value = 0
    input.value = ''
  }
}

async function editImage(product: ProductItem, imageIndex: number) {
  const imageSrc = productImages(product)[imageIndex]
  if (!imageSrc || isSaving(product.id)) {
    return
  }
  try {
    await openMeituImageEditor({
      imageSrc,
      title: '编辑图片',
      onSave: (result) => applyImageEdit(product, imageIndex, result),
    })
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '打开图片编辑器失败'))
  }
}

async function applyImageEdit(product: ProductItem, imageIndex: number, result: MeituImageSaveResult) {
  const imageBase64 = String(result.imageBase64 || '').trim()
  if (!imageBase64) {
    ElMessage.warning('编辑结果为空')
    return
  }
  setSaving(product.id, true)
  try {
    const detail = await api.getProductDetail(product.id)
    const images = detailImages(detail)
    const sourceImage = images[imageIndex]
    if (!sourceImage) {
      ElMessage.warning('图片不存在')
      return
    }
    const draftImage = await api.uploadProductImageDraftBase64(product.id, {
      imageBase64,
      ext: normalizeImageExt(result.ext, imageBase64),
    })
    const nextImages = [...images]
    nextImages[imageIndex] = draftImage.url
    const text = currentText(product, detail)
    const updated = await api.updateProductLocalDetail(product.id, {
      ...text,
      variants: [],
      imageChanges: {
        images: nextImages,
        replacements: [{ from: sourceImage, to: draftImage.url }],
        removeUrls: [],
      },
    })
    mergeProduct(updated)
    ElMessage.success('商品图片已编辑并同步')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '编辑商品图片失败'))
  } finally {
    setSaving(product.id, false)
  }
}

async function deleteImage(product: ProductItem, imageIndex: number) {
  try {
    await ElMessageBox.confirm('确认删除这张商品图片？删除后会立即同步。', '删除图片', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  setSaving(product.id, true)
  try {
    const detail = await api.getProductDetail(product.id)
    const images = detailImages(detail)
    const sourceImage = images[imageIndex]
    if (!sourceImage) {
      ElMessage.warning('图片不存在')
      return
    }
    const text = currentText(product, detail)
    const updated = await api.updateProductLocalDetail(product.id, {
      ...text,
      variants: [],
      imageChanges: {
        images: images.filter((_, index) => index !== imageIndex),
        replacements: [],
        removeUrls: [sourceImage],
      },
    })
    mergeProduct(updated)
    ElMessage.success('商品图片已删除并同步')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '删除商品图片失败'))
  } finally {
    setSaving(product.id, false)
  }
}

function normalizeImageExt(ext: string, imageBase64: string) {
  const dataUrlMatch = imageBase64.match(/^data:image\/([a-z0-9.+-]+);base64,/i)
  const rawExt = String(ext || dataUrlMatch?.[1] || 'jpg').trim().replace(/^\./, '').toLowerCase()
  return rawExt === 'jpeg' ? 'jpg' : rawExt
}

async function submitAllProducts() {
  const productIds = eligibleProducts.value.map((product) => product.id)
  if (productIds.length < 1) {
    ElMessage.warning('本次采集没有可上架的待审核商品')
    return
  }
  if (listingForm.storeIds.length < 1) {
    ElMessage.warning('请先选择上架店铺')
    return
  }
  listing.value = true
  try {
    const payload = {
      productIds,
      storeIds: [...listingForm.storeIds],
      taskName: listingForm.taskName.trim() || `手动采集 ${props.task?.id || ''}`.trim(),
    }
    const preflight = await api.preflightListingTask(payload)
    if (!preflight.canProceed) {
      ElMessage.error(preflight.message || `有 ${preflight.summary.blockedCount} 个商品未通过上架检查`)
      return
    }
    const storeNames = selectableStores.value
      .filter((store) => listingForm.storeIds.includes(store.id))
      .map((store) => store.aliasName || store.storeName || store.storeCode)
      .join('、')
    await ElMessageBox.confirm(
      `确认将本次采集的 ${productIds.length} 个商品全部上架到 ${listingForm.storeIds.length} 个店铺（${storeNames}）？`,
      '创建上架任务',
      {
        confirmButtonText: '确认上架',
        cancelButtonText: '取消',
        type: 'success',
      },
    )
    await api.createListingTask(payload)
    await loadResult(props.task?.id || '')
    ElMessage.success('上架任务已创建，请到上架任务中查看进度')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '创建上架任务失败'))
    }
  } finally {
    listing.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    class="manual-result-dialog"
    title="采集商品详情"
    width="92%"
    append-to-body
    destroy-on-close
  >
    <div v-loading="loading" class="manual-result-shell">
      <div class="result-summary">
        <div>
          <strong>采集商品：{{ products.length }} 个</strong>
          <span>可上架：{{ eligibleProducts.length }} 个</span>
        </div>
        <span>{{ task?.target }}</span>
      </div>

      <div class="result-scroll">
        <el-empty v-if="!loading && products.length < 1" description="本次采集没有已保存商品" />
        <div v-else class="product-list">
          <section
            v-for="(product, productIndex) in products"
            :key="product.id"
            class="product-section"
          >
            <div class="product-heading">
              <div class="product-title-line">
                <span>{{ productIndex + 1 }}. {{ drafts[product.id]?.title || product.title }}</span>
                <div v-if="product.listedStores?.length" class="listed-store-tags">
                  <el-tooltip
                    v-for="store in product.listedStores"
                    :key="`${product.id}-${store.storeId}`"
                    :content="listedStoreRealName(store)"
                    placement="top"
                  >
                    <el-tag size="small" type="success">
                      {{ listedStoreLabel(store) }}
                    </el-tag>
                  </el-tooltip>
                </div>
                <el-tag v-if="product.listingTaskId" size="small" type="info">已创建上架任务</el-tag>
                <el-tag v-else-if="product.reviewStatus !== 'pending'" size="small" type="warning">
                  {{ product.reviewStatus }}
                </el-tag>
              </div>
            </div>

            <div class="product-editor">
              <div class="text-editor">
                <el-input
                  v-model="drafts[product.id].title"
                  maxlength="127"
                  placeholder="商品标题"
                  :disabled="isSaving(product.id)"
                  @blur="saveText(product)"
                />
                <el-input
                  v-model="drafts[product.id].tagline"
                  maxlength="174"
                  placeholder="商品副标题"
                  :disabled="isSaving(product.id)"
                  @blur="saveText(product)"
                />
              </div>

              <div class="image-grid">
                <div
                  v-for="(image, imageIndex) in productImages(product)"
                  :key="`${product.id}-${image}-${imageIndex}`"
                  class="image-card"
                >
                  <el-image
                    class="product-image"
                    :src="image"
                    fit="cover"
                    lazy
                    :preview-src-list="productImages(product)"
                    :initial-index="imageIndex"
                    preview-teleported
                  />
                  <div class="image-actions">
                    <el-tooltip content="编辑图片" placement="top">
                      <el-button
                        :icon="EditPen"
                        type="success"
                        plain
                        aria-label="编辑图片"
                        :loading="isSaving(product.id)"
                        @click="editImage(product, imageIndex)"
                      />
                    </el-tooltip>
                    <el-tooltip content="替换图片" placement="top">
                      <el-button
                        :icon="Upload"
                        aria-label="替换图片"
                        :loading="isSaving(product.id)"
                        @click="replaceImage(product, imageIndex)"
                      />
                    </el-tooltip>
                    <el-tooltip content="删除图片" placement="top">
                      <el-button
                        :icon="Delete"
                        type="danger"
                        plain
                        aria-label="删除图片"
                        :loading="isSaving(product.id)"
                        @click="deleteImage(product, imageIndex)"
                      />
                    </el-tooltip>
                  </div>
                </div>
                <button
                  v-if="productImages(product).length < 1"
                  class="image-empty"
                  type="button"
                  :disabled="isSaving(product.id)"
                  @click="replaceImage(product, 0)"
                >
                  添加图片
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="listing-panel">
        <el-select
          v-model="listingForm.storeIds"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择上架店铺"
        >
          <el-option
            v-for="store in selectableStores"
            :key="store.id"
            :label="store.aliasName || store.storeName || store.storeCode"
            :value="store.id"
          />
        </el-select>
        <el-input v-model="listingForm.taskName" maxlength="255" placeholder="上架任务名称（可选）" />
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
      <el-button
        type="success"
        :loading="listing"
        :disabled="loading || eligibleProducts.length < 1"
        @click="submitAllProducts"
      >
        全部上架
      </el-button>
    </template>

    <input ref="fileInput" class="hidden-file-input" type="file" accept="image/*" @change="handleImageFile">
  </el-dialog>
</template>

<style scoped>
.manual-result-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 68vh;
  min-height: 420px;
}

.result-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 14px;
  color: var(--text-muted);
}

.result-summary > div {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--text-main);
}

.result-scroll {
  min-height: 0;
  overflow-y: auto;
  padding-right: 6px;
}

.product-list {
  display: grid;
  gap: 18px;
}

.product-section {
  border: 1px solid var(--border-color);
  background: var(--surface-card);
}

.product-heading {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-muted);
}

.product-title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.product-title-line > span {
  flex: 1 1 420px;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listed-store-tags {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  gap: 6px;
}

.product-editor {
  padding: 14px;
}

.text-editor {
  display: grid;
  gap: 10px;
  margin-bottom: 14px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 12px;
}

.image-card,
.image-empty {
  min-width: 0;
  border: 1px solid var(--border-color);
  background: var(--surface-card);
}

.product-image {
  width: 100%;
  aspect-ratio: 1;
  display: block;
}

.image-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
}

.image-actions :deep(.el-button) {
  width: 100%;
  margin: 0;
}

.image-empty {
  min-height: 150px;
  color: var(--text-muted);
  cursor: pointer;
}

.listing-panel {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.hidden-file-input {
  display: none;
}

@media (max-width: 1200px) {
  .image-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .manual-result-shell {
    height: 72vh;
    min-height: 0;
  }

  .result-summary,
  .result-summary > div {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .image-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .listing-panel {
    grid-template-columns: 1fr;
  }
}
</style>
