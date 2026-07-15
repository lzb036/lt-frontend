<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Refresh, Search } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  ProductItem,
  ProductReplacement,
  ProductReplacementDraft,
  RakutenGenreOption,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import PendingProductGenreSelect from './PendingProductGenreSelect.vue'

const props = defineProps<{
  product: ProductItem | null
}>()

const emit = defineEmits<{
  completed: [product: ProductItem]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const sourceUrl = shallowRef('')
const collecting = shallowRef(false)
const saving = shallowRef(false)
const confirming = shallowRef(false)
const replacement = shallowRef<ProductReplacement | null>(null)
const draft = ref<ProductReplacementDraft | null>(null)
const activeTab = shallowRef('before')
const newImageUrl = shallowRef('')
let pollTimer: ReturnType<typeof setTimeout> | null = null

const taskRunning = computed(() => ['queued', 'running'].includes(replacement.value?.task.status || ''))
const targetManageNumber = computed(() => props.product?.rakutenManageNumber || props.product?.itemNumber || '')
const changedCount = computed(() =>
  Object.values(replacement.value?.difference || {}).filter((item) => item.changed).length
)
const draftGenreProduct = computed<ProductItem | null>(() => {
  if (!props.product || !draft.value) {
    return null
  }
  return {
    ...props.product,
    genreId: draft.value.genreId,
    genrePath: draft.value.genrePath,
    genrePathZh: draft.value.genrePathZh,
  }
})
const variantEntries = computed(() => Object.entries(draft.value?.variants || {}))

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    const pendingTaskId = replacement.value?.task.status === 'preview_ready'
      ? replacement.value.task.id
      : ''
    if (pendingTaskId) {
      void api.cancelProductReplacement(pendingTaskId).catch(() => undefined)
    }
    stopPolling()
    sourceUrl.value = ''
    replacement.value = null
    draft.value = null
    activeTab.value = 'before'
    newImageUrl.value = ''
  }
})

onBeforeUnmount(stopPolling)

async function collectSourceProduct() {
  if (!props.product) {
    return
  }
  if (!sourceUrl.value.trim()) {
    ElMessage.warning('请输入来源商品链接')
    return
  }
  collecting.value = true
  try {
    const result = await api.createProductReplacement(props.product.id, sourceUrl.value.trim())
    applyReplacement(result)
    activeTab.value = 'after'
    ElMessage.success('来源商品采集完成')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '采集来源商品失败'))
  } finally {
    collecting.value = false
  }
}

function applyReplacement(value: ProductReplacement) {
  replacement.value = value
  draft.value = JSON.parse(JSON.stringify(value.after)) as ProductReplacementDraft
}

function selectDraftGenre(genre: RakutenGenreOption) {
  if (!draft.value) {
    return
  }
  draft.value.genreId = genre.genreId
  draft.value.genrePath = genre.genrePath
  draft.value.genrePathZh = genre.genrePathZh
}

function addImage() {
  const url = newImageUrl.value.trim()
  if (!draft.value || !url) {
    return
  }
  if (!draft.value.images.includes(url)) {
    draft.value.images.push(url)
  }
  newImageUrl.value = ''
}

function removeImage(index: number) {
  draft.value?.images.splice(index, 1)
}

function variantPrice(variant: Record<string, unknown>) {
  return Number(variant.standardPrice || 0)
}

function setVariantPrice(variant: Record<string, unknown>, value: number | undefined) {
  variant.standardPrice = String(Number(value || 0))
}

async function saveDraft(showMessage = true) {
  if (!replacement.value || !draft.value) {
    return false
  }
  if (!draft.value.title.trim()) {
    ElMessage.warning('替换后商品标题不能为空')
    return false
  }
  if (!/^\d{6}$/.test(draft.value.genreId)) {
    ElMessage.warning('请选择有效品类')
    return false
  }
  if (draft.value.images.length < 1) {
    ElMessage.warning('替换后商品至少需要一张图片')
    return false
  }
  if (variantEntries.value.length < 1) {
    ElMessage.warning('替换后商品缺少 SKU')
    return false
  }
  saving.value = true
  try {
    const result = await api.updateProductReplacementDraft(replacement.value.task.id, {
      title: draft.value.title.trim(),
      tagline: draft.value.tagline.trim(),
      genreId: draft.value.genreId,
      price: draft.value.price,
      images: draft.value.images,
      descriptions: draft.value.descriptions,
      variants: draft.value.variants,
    })
    applyReplacement(result)
    if (showMessage) {
      ElMessage.success('替换草稿已保存')
    }
    return true
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存替换草稿失败'))
    return false
  } finally {
    saving.value = false
  }
}

async function confirmReplacement() {
  if (!replacement.value || !(await saveDraft(false))) {
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `将保留商品管理编号和商品 URL，并替换标题、品类、价格、SKU、图片和详情说明。请输入商品管理编号「${targetManageNumber.value}」确认。`,
      '确认替换店铺商品',
      {
        confirmButtonText: '确认替换',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: '输入当前商品管理编号',
        inputValidator: (value) => value === targetManageNumber.value || '商品管理编号不正确',
      },
    )
    confirming.value = true
    const next = await api.confirmProductReplacement(replacement.value.task.id, result.value)
    replacement.value = next
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

function fieldChanged(key: string) {
  return Boolean(replacement.value?.difference?.[key]?.changed)
}

function differenceText(key: string) {
  const item = replacement.value?.difference?.[key]
  if (!item?.changed) {
    return '未变化'
  }
  if (item.beforeCount !== undefined || item.afterCount !== undefined) {
    return `${item.beforeCount || 0} → ${item.afterCount || 0}`
  }
  return '已变更'
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
              descriptions: '详情说明',
            }"
            :key="key"
            :type="fieldChanged(key) ? 'warning' : 'info'"
            effect="plain"
          >
            {{ label }}：{{ differenceText(key) }}
          </el-tag>
        </div>

        <el-tabs v-model="activeTab" class="replacement-tabs">
          <el-tab-pane label="替换前" name="before">
            <div class="replacement-readonly">
              <h3>{{ replacement.before.title }}</h3>
              <p>{{ replacement.before.tagline || '无副标题' }}</p>
              <dl>
                <dt>品类</dt><dd>{{ replacement.before.genrePathZh || replacement.before.genrePath || '-' }}</dd>
                <dt>价格</dt><dd>{{ replacement.before.price ?? '-' }} 日元</dd>
                <dt>SKU</dt><dd>{{ Object.keys(replacement.before.detail.raw?.variants || {}).length }} 个</dd>
                <dt>图片</dt><dd>{{ replacement.before.detail.images.length }} 张</dd>
              </dl>
              <div class="replacement-images">
                <el-image
                  v-for="image in replacement.before.detail.images"
                  :key="image"
                  :src="image"
                  fit="cover"
                  preview-teleported
                  :preview-src-list="replacement.before.detail.images"
                />
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`替换后（${changedCount}）`" name="after">
            <el-form v-if="draft" label-position="top" class="replacement-form">
              <el-form-item label="商品品类" :class="{ 'is-changed': fieldChanged('genre') }">
                <PendingProductGenreSelect
                  v-if="draftGenreProduct"
                  :product="draftGenreProduct"
                  mode="draft"
                  :disabled="taskRunning"
                  @selected="selectDraftGenre"
                />
              </el-form-item>
              <el-form-item label="商品标题" :class="{ 'is-changed': fieldChanged('title') }">
                <el-input v-model="draft.title" type="textarea" :rows="2" maxlength="500" />
              </el-form-item>
              <el-form-item label="商品副标题" :class="{ 'is-changed': fieldChanged('tagline') }">
                <el-input v-model="draft.tagline" type="textarea" :rows="2" maxlength="1000" />
              </el-form-item>
              <el-form-item label="参考价格（日元）" :class="{ 'is-changed': fieldChanged('price') }">
                <el-input-number v-model="draft.price" :min="1" :precision="0" />
              </el-form-item>

              <div class="replacement-section" :class="{ 'is-changed': fieldChanged('variants') }">
                <h4>SKU</h4>
                <el-table :data="variantEntries" border max-height="260">
                  <el-table-column label="SKU ID" min-width="180">
                    <template #default="{ row }">{{ row[0] }}</template>
                  </el-table-column>
                  <el-table-column label="价格（日元）" width="190">
                    <template #default="{ row }">
                      <el-input-number
                        :model-value="variantPrice(row[1])"
                        :min="1"
                        :precision="0"
                        @update:model-value="setVariantPrice(row[1], $event)"
                      />
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <div class="replacement-section" :class="{ 'is-changed': fieldChanged('images') }">
                <h4>商品图片</h4>
                <div class="replacement-images">
                  <div v-for="(image, index) in draft.images" :key="`${image}-${index}`" class="replacement-image">
                    <el-image :src="image" fit="cover" preview-teleported :preview-src-list="draft.images" />
                    <el-button :icon="Delete" type="danger" link @click="removeImage(index)">删除</el-button>
                  </div>
                </div>
                <div class="replacement-add-image">
                  <el-input v-model="newImageUrl" placeholder="添加图片 URL" @keydown.enter="addImage" />
                  <el-button @click="addImage">添加</el-button>
                </div>
              </div>

              <div class="replacement-section" :class="{ 'is-changed': fieldChanged('descriptions') }">
                <h4>商品详情说明</h4>
                <el-form-item v-for="(description, index) in draft.descriptions" :key="`${description.label}-${index}`" :label="description.label">
                  <el-input v-model="description.value" type="textarea" :rows="4" />
                </el-form-item>
              </div>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>

    <template #footer>
      <el-button v-if="replacement" @click="visible = false">{{ taskRunning ? '关闭' : '取消' }}</el-button>
      <template v-if="replacement && !taskRunning">
        <el-button :loading="saving" @click="saveDraft()">保存草稿</el-button>
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
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.replacement-images :deep(.el-image) {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
}

.replacement-image {
  display: grid;
  gap: 4px;
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

.replacement-add-image {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

@media (max-width: 720px) {
  .replacement-source,
  .replacement-add-image {
    grid-template-columns: 1fr;
  }

  .replacement-images {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
