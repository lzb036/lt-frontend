<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, EditPen, Refresh, Search, Upload } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  ProductDetail,
  ProductItem,
  ProductReplacement,
  ProductVariantEditPayload,
  RakutenGenreOption,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { openMeituImageEditor, type MeituImageSaveResult } from '../../utils/meituImageEditor'
import PendingProductGenreSelect from './PendingProductGenreSelect.vue'

type PendingImageOperation =
  | { type: 'replace'; sourceUrl: string; file: File; previewUrl: string }
  | { type: 'replaceBase64'; sourceUrl: string; imageBase64: string; ext: string; previewUrl: string }
  | { type: 'delete'; sourceUrl: string }

interface ImageDraftItem {
  sourceUrl: string
  currentUrl: string
}

const props = defineProps<{
  product: ProductItem | null
}>()

const emit = defineEmits<{
  created: [product: ProductItem]
  completed: [product: ProductItem]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const sourceUrl = shallowRef('')
const collecting = shallowRef(false)
const saving = shallowRef(false)
const confirming = shallowRef(false)
const imageOperating = shallowRef(false)
const replacement = shallowRef<ProductReplacement | null>(null)
const pendingDetail = shallowRef<ProductDetail | null>(null)
const activeTab = shallowRef('before')
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const replacingImageIndex = shallowRef<number | null>(null)
const imageDraft = shallowRef<ImageDraftItem[]>([])
const imageOperations = shallowRef<PendingImageOperation[]>([])
const previewUrls = shallowRef<Set<string>>(new Set())
const draft = ref({
  title: '',
  tagline: '',
  genreId: '',
  genrePath: '',
  genrePathZh: '',
  variants: [] as ProductVariantEditPayload[],
})
let pollTimer: ReturnType<typeof setTimeout> | null = null

const beforeImages = computed(() => {
  const images = replacement.value?.before.detail?.images || replacement.value?.before.images || []
  return Array.from(new Set(images.filter(Boolean)))
})
const currentImages = computed(() => imageDraft.value.map((image) => image.currentUrl))
const beforeVariants = computed(() => replacement.value?.before.detail?.variants || [])
const changedFields = computed(() => ({
  title: normalizeText(replacement.value?.before.title) !== normalizeText(draft.value.title),
  tagline: normalizeText(replacement.value?.before.tagline) !== normalizeText(draft.value.tagline),
  genre: normalizeText(replacement.value?.before.genreId) !== normalizeText(draft.value.genreId),
  price: beforePriceSignature() !== afterPriceSignature(),
  variants: variantSignature(beforeVariants.value) !== variantSignature(draft.value.variants),
  images: imageSignature(beforeImages.value) !== imageSignature(currentImages.value),
}))
const changedCount = computed(() => Object.values(changedFields.value).filter(Boolean).length)
const taskRunning = computed(() => ['queued', 'running'].includes(replacement.value?.task.status || ''))
const targetManageNumber = computed(() =>
  replacement.value?.pendingProduct?.replacementTargetManageNumber
  || props.product?.rakutenManageNumber
  || props.product?.itemNumber
  || ''
)
const draftGenreProduct = computed<ProductItem | null>(() => {
  const pending = replacement.value?.pendingProduct
  if (!pending) {
    return null
  }
  return {
    ...pending,
    genreId: draft.value.genreId,
    genrePath: draft.value.genrePath,
    genrePathZh: draft.value.genrePathZh,
  }
})

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    resetDialog()
  }
})

onBeforeUnmount(stopPolling)

async function collectSourceProduct() {
  if (!props.product) {
    return
  }
  const normalizedUrl = sourceUrl.value.trim()
  if (!normalizedUrl) {
    ElMessage.warning('请输入来源商品链接')
    return
  }
  collecting.value = true
  try {
    const result = await api.createProductReplacement(props.product.id, normalizedUrl)
    if (!result.pendingProduct) {
      throw new Error('替换采集未生成待审核商品')
    }
    replacement.value = result
    pendingDetail.value = await api.getProductDetail(result.pendingProduct.id)
    fillDraft(pendingDetail.value)
    activeTab.value = 'after'
    emit('created', result.pendingProduct)
    ElMessage.success('来源商品采集完成，已放入待审核商品')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '采集来源商品失败'))
  } finally {
    collecting.value = false
  }
}

function fillDraft(product: ProductDetail) {
  draft.value = {
    title: product.detail.title || product.title || '',
    tagline: product.detail.tagline || product.tagline || '',
    genreId: product.genreId || '',
    genrePath: product.genrePath || '',
    genrePathZh: product.genrePathZh || '',
    variants: product.detail.variants.map((variant) => ({
      variantId: variant.variantId,
      standardPrice: Number(variant.standardPrice || 0),
      hidden: Boolean(variant.hidden),
      singleProduct: Boolean(variant.singleProduct),
    })),
  }
  imageDraft.value = detailImageUrls(product).map((url) => ({ sourceUrl: url, currentUrl: url }))
  imageOperations.value = []
  clearPreviewUrls()
}

function selectDraftGenre(genre: RakutenGenreOption) {
  draft.value.genreId = genre.genreId
  draft.value.genrePath = genre.genrePath
  draft.value.genrePathZh = genre.genrePathZh
}

function fieldChanged(key: keyof typeof changedFields.value) {
  return changedFields.value[key]
}

function differenceText(key: keyof typeof changedFields.value) {
  if (!fieldChanged(key)) {
    return '未变化'
  }
  if (key === 'images') {
    return `${beforeImages.value.length} → ${currentImages.value.length}`
  }
  if (key === 'variants') {
    return `${beforeVariants.value.length} → ${draft.value.variants.length}`
  }
  return '已变更'
}

function beforePriceSignature() {
  return beforeVariants.value
    .map((variant) => `${variant.variantId}:${Number(variant.standardPrice || 0)}`)
    .sort()
    .join('|')
}

function afterPriceSignature() {
  return draft.value.variants
    .map((variant) => `${variant.variantId}:${Number(variant.standardPrice || 0)}`)
    .sort()
    .join('|')
}

function variantSignature(variants: Array<{ variantId: string; hidden?: boolean | null; singleProduct?: boolean }>) {
  return variants
    .map((variant) => `${variant.variantId}:${Boolean(variant.hidden)}:${Boolean(variant.singleProduct)}`)
    .sort()
    .join('|')
}

function imageSignature(images: string[]) {
  return images.map((image) => normalizeText(image)).filter(Boolean).join('|')
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function detailImageUrls(product: ProductDetail) {
  const images = [...(product.detail.images || [])]
  if (product.imageUrl && !images.includes(product.imageUrl)) {
    images.unshift(product.imageUrl)
  }
  return Array.from(new Set(images.filter(Boolean)))
}

function triggerReplaceImage(index: number) {
  replacingImageIndex.value = index
  if (imageFileInputRef.value) {
    imageFileInputRef.value.value = ''
    imageFileInputRef.value.click()
  }
}

function handleReplaceImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const index = replacingImageIndex.value
  if (!file || index == null) {
    return
  }
  const image = imageDraft.value[index]
  if (!image) {
    ElMessage.warning('图片不存在')
    return
  }
  const previewUrl = URL.createObjectURL(file)
  previewUrls.value = new Set(previewUrls.value).add(previewUrl)
  appendImageOperation({ type: 'replace', sourceUrl: image.sourceUrl, file, previewUrl })
  imageDraft.value = imageDraft.value.map((item, itemIndex) => (
    itemIndex === index ? { ...item, currentUrl: previewUrl } : item
  ))
  replacingImageIndex.value = null
  input.value = ''
}

async function editImage(index: number) {
  const image = imageDraft.value[index]
  if (!image) {
    ElMessage.warning('图片不存在')
    return
  }
  imageOperating.value = true
  try {
    await openMeituImageEditor({
      imageSrc: image.currentUrl,
      title: '编辑图片',
      onSave: (result) => applyImageEdit(image.sourceUrl, result),
    })
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '打开图片编辑器失败'))
  } finally {
    imageOperating.value = false
  }
}

function applyImageEdit(sourceUrl: string, result: MeituImageSaveResult) {
  const imageBase64 = String(result.imageBase64 || '').trim()
  if (!imageBase64) {
    ElMessage.warning('图片编辑结果为空')
    return
  }
  const ext = normalizeImageExt(result.ext, imageBase64)
  const previewUrl = /^data:image\/[a-z0-9.+-]+;base64,/i.test(imageBase64)
    ? imageBase64
    : `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${imageBase64}`
  appendImageOperation({ type: 'replaceBase64', sourceUrl, imageBase64, ext, previewUrl })
  imageDraft.value = imageDraft.value.map((image) => (
    image.sourceUrl === sourceUrl ? { ...image, currentUrl: previewUrl } : image
  ))
}

async function deleteImage(index: number) {
  try {
    await ElMessageBox.confirm('确认删除这张商品图片？点击保存草稿后才会生效。', '删除图片', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const image = imageDraft.value[index]
    if (!image) {
      return
    }
    appendImageOperation({ type: 'delete', sourceUrl: image.sourceUrl })
    imageDraft.value = imageDraft.value.filter((_, itemIndex) => itemIndex !== index)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '删除图片失败'))
    }
  }
}

function appendImageOperation(operation: PendingImageOperation) {
  imageOperations.value = [
    ...imageOperations.value.filter((item) => item.sourceUrl !== operation.sourceUrl),
    operation,
  ]
}

async function buildImageChanges(productId: number) {
  if (imageOperations.value.length < 1) {
    return undefined
  }
  const replaceMap: Record<string, string> = {}
  for (const operation of imageOperations.value) {
    if (operation.type === 'replace') {
      const uploaded = await api.uploadProductImageDraft(productId, operation.file)
      replaceMap[operation.sourceUrl] = uploaded.url
      replaceMap[operation.previewUrl] = uploaded.url
    } else if (operation.type === 'replaceBase64') {
      const uploaded = await api.uploadProductImageDraftBase64(productId, {
        imageBase64: operation.imageBase64,
        ext: operation.ext,
      })
      replaceMap[operation.sourceUrl] = uploaded.url
      replaceMap[operation.previewUrl] = uploaded.url
    }
  }
  const originalImages = detailImageUrls(pendingDetail.value!)
  const currentSourceUrls = new Set(imageDraft.value.map((image) => image.sourceUrl))
  return {
    images: imageDraft.value.map((image) => replaceMap[image.currentUrl] || image.currentUrl),
    replacements: imageOperations.value
      .filter((operation) => operation.type === 'replace' || operation.type === 'replaceBase64')
      .map((operation) => ({ from: operation.sourceUrl, to: replaceMap[operation.sourceUrl] || '' }))
      .filter((operation) => operation.to),
    removeUrls: originalImages.filter((image) => !currentSourceUrls.has(image)),
  }
}

async function saveDraft() {
  const pendingProductId = replacement.value?.pendingProduct?.id
  if (!pendingProductId || !pendingDetail.value) {
    return false
  }
  if (!draft.value.title.trim()) {
    ElMessage.warning('替换后商品标题不能为空')
    return false
  }
  if (!/^\d{6}$/.test(draft.value.genreId) || !draft.value.genrePath) {
    ElMessage.warning('请选择有效品类')
    return false
  }
  if (imageDraft.value.length < 1) {
    ElMessage.warning('替换后商品至少需要一张图片')
    return false
  }
  for (const variant of draft.value.variants) {
    if (!Number.isInteger(variant.standardPrice) || variant.standardPrice <= 0) {
      ElMessage.warning(`${variant.singleProduct ? '价格' : `SKU ${variant.variantId} 价格`}必须为大于 0 的整数`)
      return false
    }
  }
  saving.value = true
  try {
    const imageChanges = await buildImageChanges(pendingProductId)
    const saved = await api.updateProductLocalDetail(pendingProductId, {
      title: draft.value.title.trim(),
      tagline: draft.value.tagline.trim(),
      genreId: draft.value.genreId,
      variants: draft.value.variants,
      imageChanges,
    })
    pendingDetail.value = saved
    if (replacement.value) {
      replacement.value = {
        ...replacement.value,
        pendingProduct: saved,
      }
    }
    fillDraft(saved)
    emit('created', saved)
    ElMessage.success('替换草稿已保存到待审核商品')
    return true
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存替换草稿失败'))
    return false
  } finally {
    saving.value = false
  }
}

async function confirmReplacement() {
  if (!replacement.value || !(await saveDraft())) {
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `确认后将直接替换目标店铺商品。请输入商品管理编号「${targetManageNumber.value}」确认。`,
      '确认替换店铺商品',
      {
        confirmButtonText: '确认替换',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: '输入目标商品管理编号',
        inputValidator: (value) => value === targetManageNumber.value || '商品管理编号不正确',
      },
    )
    confirming.value = true
    replacement.value = await api.confirmProductReplacement(replacement.value.task.id, result.value)
    ElMessage.success('替换任务已提交，请等待执行完成')
    startPolling()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '确认替换失败'))
    }
  } finally {
    confirming.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setTimeout(pollReplacement, 1500)
}

async function pollReplacement() {
  if (!replacement.value) {
    return
  }
  try {
    const next = await api.getProductReplacement(replacement.value.task.id)
    replacement.value = next
    if (next.task.status === 'success') {
      const product = next.result?.product
      if (product) {
        emit('completed', product)
      }
      ElMessage.success('店铺商品替换完成')
      visible.value = false
      return
    }
    if (['failed', 'partial', 'cancelled'].includes(next.task.status)) {
      ElMessage.error(next.task.errorDetail || next.task.message || '店铺商品替换失败')
      return
    }
    startPolling()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '查询替换任务失败'))
  }
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function normalizeImageExt(ext: string, imageBase64: string) {
  const matched = imageBase64.match(/^data:image\/([a-z0-9.+-]+);base64,/i)
  const normalized = String(matched?.[1] || ext || 'jpg').toLowerCase().replace(/^\./, '')
  return normalized === 'jpeg' ? 'jpg' : normalized
}

function clearPreviewUrls() {
  for (const url of previewUrls.value) {
    URL.revokeObjectURL(url)
  }
  previewUrls.value = new Set()
}

function resetDialog() {
  stopPolling()
  clearPreviewUrls()
  sourceUrl.value = ''
  replacement.value = null
  pendingDetail.value = null
  activeTab.value = 'before'
  imageDraft.value = []
  imageOperations.value = []
  replacingImageIndex.value = null
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="替换店铺商品"
    width="1080px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
  >
    <div class="replacement-dialog">
      <div v-if="!replacement" class="replacement-source">
        <el-input
          v-model="sourceUrl"
          placeholder="输入用于替换的乐天商品链接"
          clearable
          @keydown.enter="collectSourceProduct"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" :icon="Refresh" :loading="collecting" @click="collectSourceProduct">
          开始采集
        </el-button>
        <el-button @click="visible = false">取消</el-button>
      </div>

      <template v-else>
        <el-alert
          v-if="taskRunning"
          :title="replacement.task.message || '正在执行商品替换'"
          type="info"
          show-icon
          :closable="false"
        />
        <div class="replacement-differences">
          <span class="replacement-difference-title">共 {{ changedCount }} 项变更</span>
          <el-tag
            v-for="(label, key) in {
              title: '标题',
              tagline: '副标题',
              genre: '品类',
              price: '价格',
              variants: 'SKU',
              images: '图片',
            }"
            :key="key"
            :type="fieldChanged(key as keyof typeof changedFields) ? 'warning' : 'info'"
            effect="plain"
          >
            {{ label }}：{{ differenceText(key as keyof typeof changedFields) }}
          </el-tag>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="替换前" name="before">
            <div class="replacement-readonly">
              <h3>{{ replacement.before.title }}</h3>
              <p>{{ replacement.before.tagline || '无副标题' }}</p>
              <dl>
                <dt>品类</dt><dd>{{ replacement.before.genrePathZh || replacement.before.genrePath || '-' }}</dd>
                <dt>价格</dt><dd>{{ replacement.before.price ?? '-' }} 日元</dd>
                <dt>SKU</dt><dd>{{ beforeVariants.length }} 个</dd>
                <dt>图片</dt><dd>{{ beforeImages.length }} 张</dd>
              </dl>
              <div class="replacement-images">
                <el-image
                  v-for="(image, index) in beforeImages"
                  :key="`${image}-${index}`"
                  :src="image"
                  fit="cover"
                  preview-teleported
                  :preview-src-list="beforeImages"
                  :initial-index="index"
                />
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`替换后（${changedCount}）`" name="after">
            <el-form label-position="top" class="replacement-form">
              <el-form-item label="商品品类" :class="{ 'is-changed': fieldChanged('genre') }">
                <PendingProductGenreSelect
                  v-if="draftGenreProduct"
                  :product="draftGenreProduct"
                  mode="draft"
                  @selected="selectDraftGenre"
                />
              </el-form-item>
              <el-form-item label="商品标题" :class="{ 'is-changed': fieldChanged('title') }">
                <el-input v-model="draft.title" type="textarea" :rows="2" maxlength="500" />
              </el-form-item>
              <el-form-item label="商品副标题" :class="{ 'is-changed': fieldChanged('tagline') }">
                <el-input v-model="draft.tagline" type="textarea" :rows="2" maxlength="1000" />
              </el-form-item>

              <div class="replacement-section" :class="{ 'is-changed': fieldChanged('variants') || fieldChanged('price') }">
                <h4>SKU 与价格</h4>
                <el-table :data="draft.variants" border max-height="280">
                  <el-table-column prop="variantId" label="SKU ID" min-width="180" />
                  <el-table-column label="价格（日元）" width="200">
                    <template #default="{ row }">
                      <el-input-number v-model="row.standardPrice" :min="1" :precision="0" />
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <div class="replacement-section" :class="{ 'is-changed': fieldChanged('images') }">
                <h4>商品图片</h4>
                <div v-loading="imageOperating" class="replacement-images">
                  <div v-for="(image, index) in imageDraft" :key="`${image.sourceUrl}-${index}`" class="replacement-image">
                    <el-image :src="image.currentUrl" fit="cover" preview-teleported :preview-src-list="currentImages" :initial-index="index" />
                    <div class="replacement-image-actions">
                      <el-button :icon="EditPen" link type="success" @click="editImage(index)">编辑</el-button>
                      <el-button :icon="Upload" link type="warning" @click="triggerReplaceImage(index)">替换</el-button>
                      <el-button :icon="Delete" link type="danger" @click="deleteImage(index)">删除</el-button>
                    </div>
                  </div>
                </div>
                <input
                  ref="imageFileInputRef"
                  class="hidden-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  @change="handleReplaceImage"
                />
              </div>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>

    <template #footer>
      <el-button v-if="replacement" @click="visible = false">{{ taskRunning ? '关闭' : '取消' }}</el-button>
      <template v-if="replacement && !taskRunning">
        <el-button :loading="saving" @click="saveDraft">保存</el-button>
        <el-button type="danger" :loading="confirming" @click="confirmReplacement">确认替换</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.replacement-dialog,
.replacement-source,
.replacement-readonly,
.replacement-form,
.replacement-section {
  display: grid;
  gap: 14px;
}

.replacement-source {
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
}

.replacement-differences {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.replacement-difference-title {
  margin-right: 4px;
  font-weight: 600;
}

.replacement-readonly dl {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0;
}

.replacement-readonly dt {
  color: var(--text-muted);
}

.replacement-readonly dd {
  margin: 0;
}

.replacement-images {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.replacement-images :deep(.el-image) {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
}

.replacement-image {
  display: grid;
  gap: 6px;
}

.replacement-image-actions {
  display: flex;
  justify-content: center;
  gap: 2px;
}

.replacement-section {
  padding-top: 12px;
  border-top: 1px solid var(--panel-border);
}

.replacement-section h4 {
  margin: 0;
}

.is-changed {
  padding-left: 10px;
  border-left: 3px solid var(--el-color-warning);
}

.hidden-file-input {
  display: none;
}

@media (max-width: 720px) {
  .replacement-source {
    grid-template-columns: 1fr;
  }

  .replacement-images {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
