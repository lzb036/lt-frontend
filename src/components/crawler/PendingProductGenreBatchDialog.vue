<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, Close } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem, RakutenGenreOption } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import PendingProductGenreSelect from './PendingProductGenreSelect.vue'

interface GenreDraft {
  genreId: string
  genrePath: string
  genrePathZh: string
}

const props = defineProps<{
  modelValue: boolean
  products: ProductItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [products: ProductItem[]]
}>()

const api = useCollectorApi()
const saving = shallowRef(false)
const currentPage = shallowRef(1)
const drafts = reactive<Record<number, GenreDraft>>({})

const currentIndex = computed(() => Math.max(0, Math.min(props.products.length - 1, currentPage.value - 1)))
const currentProduct = computed(() => props.products[currentIndex.value] || null)
const selectedCount = computed(() => props.products.filter((product) => hasSelectedGenre(product.id)).length)
const unselectedCount = computed(() => Math.max(0, props.products.length - selectedCount.value))
const allSelected = computed(() => props.products.length > 0 && unselectedCount.value === 0)
const currentGenreProduct = computed<ProductItem | null>(() => {
  const product = currentProduct.value
  if (!product) {
    return null
  }
  const draft = drafts[product.id]
  return {
    ...product,
    genreId: draft?.genreId || '',
    genrePath: draft?.genrePath || '',
    genrePathZh: draft?.genrePathZh || '',
  }
})

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      return
    }
    resetDrafts()
  },
)

watch(
  () => props.products.map((product) => product.id).join(','),
  () => {
    if (props.modelValue) {
      resetDrafts()
    }
  },
)

function resetDrafts() {
  for (const key of Object.keys(drafts)) {
    delete drafts[Number(key)]
  }
  for (const product of props.products) {
    drafts[product.id] = {
      genreId: product.genreId || '',
      genrePath: product.genrePath || '',
      genrePathZh: product.genrePathZh || '',
    }
  }
  currentPage.value = 1
}

function hasSelectedGenre(productId: number) {
  const draft = drafts[productId]
  return Boolean(draft && /^\d{6}$/.test(draft.genreId) && draft.genrePath)
}

function selectGenre(genre: RakutenGenreOption) {
  const product = currentProduct.value
  if (!product) {
    return
  }
  drafts[product.id] = {
    genreId: genre.genreId,
    genrePath: genre.genrePath,
    genrePathZh: genre.genrePathZh,
  }
  const nextMissingIndex = props.products.findIndex(
    (item, index) => index > currentIndex.value && !hasSelectedGenre(item.id),
  )
  if (nextMissingIndex >= 0) {
    currentPage.value = nextMissingIndex + 1
    return
  }
  const firstMissingIndex = props.products.findIndex((item) => !hasSelectedGenre(item.id))
  if (firstMissingIndex >= 0) {
    currentPage.value = firstMissingIndex + 1
  }
}

function pageClass(page: number) {
  const product = props.products[page - 1]
  return product && hasSelectedGenre(product.id) ? 'is-genre-selected' : 'is-genre-missing'
}

function previousProduct() {
  currentPage.value = Math.max(1, currentPage.value - 1)
}

function nextProduct() {
  currentPage.value = Math.min(props.products.length, currentPage.value + 1)
}

async function saveAllGenres() {
  if (!allSelected.value) {
    ElMessage.warning(`还有 ${unselectedCount.value} 个商品未选择品类`)
    const firstMissingIndex = props.products.findIndex((product) => !hasSelectedGenre(product.id))
    if (firstMissingIndex >= 0) {
      currentPage.value = firstMissingIndex + 1
    }
    return
  }
  saving.value = true
  try {
    const updatedProducts = await api.updatePendingProductGenres(
      props.products.map((product) => ({
        productId: product.id,
        genreId: drafts[product.id].genreId,
      })),
    )
    emit('saved', updatedProducts)
    emit('update:modelValue', false)
    ElMessage.success(`已保存 ${updatedProducts.length} 个商品的品类`)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '批量保存商品品类失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="补充商品品类"
    width="960px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="genre-batch-dialog">
      <div class="genre-batch-summary">
        <div class="genre-summary-item is-selected">
          <el-icon><Check /></el-icon>
          <span>已选择</span>
          <strong>{{ selectedCount }}</strong>
        </div>
        <div class="genre-summary-item is-missing">
          <el-icon><Close /></el-icon>
          <span>未选择</span>
          <strong>{{ unselectedCount }}</strong>
        </div>
        <span class="genre-summary-total">共 {{ products.length }} 个商品</span>
      </div>

      <div v-if="currentProduct && currentGenreProduct" class="genre-product-page">
        <div class="genre-product-overview">
          <el-image
            v-if="currentProduct.imageUrl"
            class="genre-product-image"
            :src="currentProduct.imageUrl"
            fit="cover"
            :preview-src-list="currentProduct.images?.length ? currentProduct.images : [currentProduct.imageUrl]"
            preview-teleported
          />
          <div v-else class="genre-product-image genre-product-image-empty">无图</div>
          <div class="genre-product-info">
            <div class="genre-product-position">
              商品 {{ currentPage }} / {{ products.length }}
            </div>
            <h3>{{ currentProduct.title || `商品 ${currentProduct.id}` }}</h3>
            <p v-if="currentProduct.tagline">{{ currentProduct.tagline }}</p>
            <div class="genre-product-meta">
              <span>价格：{{ currentProduct.priceMin ?? currentProduct.price ?? '-' }} 日元</span>
              <span>店铺：{{ currentProduct.shopName || '-' }}</span>
              <span>采集时间：{{ currentProduct.createdAt || '-' }}</span>
            </div>
          </div>
        </div>

        <div class="genre-only-editor">
          <div class="genre-editor-heading">
            <div>
              <span>商品品类</span>
              <small>此窗口只能修改品类</small>
            </div>
            <el-tag :type="hasSelectedGenre(currentProduct.id) ? 'success' : 'danger'" effect="plain">
              {{ hasSelectedGenre(currentProduct.id) ? '已选择' : '未选择' }}
            </el-tag>
          </div>
          <PendingProductGenreSelect
            :product="currentGenreProduct"
            mode="draft"
            :disabled="saving"
            @selected="selectGenre"
          />
        </div>
      </div>

      <div class="genre-page-navigation">
        <el-button
          :icon="ArrowLeft"
          :disabled="currentPage <= 1"
          @click="previousProduct"
        >
          上一个
        </el-button>
        <div class="genre-status-pagination" aria-label="商品品类选择进度">
          <el-button
            v-for="(_, index) in products"
            :key="products[index].id"
            class="genre-page-button"
            :class="[pageClass(index + 1), { 'is-current': currentPage === index + 1 }]"
            :aria-label="`切换到第 ${index + 1} 个商品`"
            @click="currentPage = index + 1"
          >
            {{ index + 1 }}
          </el-button>
        </div>
        <el-button
          :icon="ArrowRight"
          :disabled="currentPage >= products.length"
          @click="nextProduct"
        >
          下一个
        </el-button>
      </div>
      <div class="genre-pagination-legend">
        <span><i class="is-selected" />已选择品类</span>
        <span><i class="is-missing" />未选择品类</span>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!allSelected" @click="saveAllGenres">
        保存全部品类
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.genre-batch-dialog {
  display: grid;
  gap: 18px;
}

.genre-batch-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-muted);
}

.genre-summary-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.genre-summary-item.is-selected {
  color: var(--success);
}

.genre-summary-item.is-missing {
  color: var(--danger);
}

.genre-summary-item strong {
  font-size: 18px;
}

.genre-summary-total {
  margin-left: auto;
  color: var(--text-soft);
}

.genre-product-page {
  display: grid;
  gap: 18px;
}

.genre-product-overview {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.genre-product-image {
  width: 180px;
  aspect-ratio: 1;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-muted);
}

.genre-product-image-empty {
  display: grid;
  place-items: center;
  color: var(--text-faint);
}

.genre-product-info {
  min-width: 0;
}

.genre-product-position {
  color: var(--text-faint);
  font-size: 13px;
}

.genre-product-info h3 {
  margin: 8px 0;
  color: var(--text-main);
  font-size: 20px;
  line-height: 1.45;
}

.genre-product-info p {
  margin: 0 0 12px;
  color: var(--text-soft);
  font-weight: 600;
  line-height: 1.6;
}

.genre-product-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  color: var(--text-faint);
  font-size: 13px;
}

.genre-only-editor {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
}

.genre-editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.genre-editor-heading > div {
  display: grid;
  gap: 3px;
}

.genre-editor-heading span {
  color: var(--text-main);
  font-weight: 700;
}

.genre-editor-heading small {
  color: var(--text-faint);
}

.genre-page-navigation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.genre-status-pagination {
  display: flex;
  align-items: center;
  justify-self: stretch;
  gap: 6px;
  max-width: 100%;
  padding: 2px;
  overflow-x: auto;
}

.genre-page-button {
  flex: 0 0 34px;
  width: 34px;
  min-width: 34px;
  height: 34px;
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  font-weight: 700;
}

.genre-page-button.is-genre-selected {
  border-color: var(--success);
  color: var(--success);
  background: var(--success-soft);
}

.genre-page-button.is-genre-missing {
  border-color: var(--danger);
  color: var(--danger);
  background: var(--danger-soft);
}

.genre-page-button.is-current {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.genre-pagination-legend {
  display: flex;
  justify-content: center;
  gap: 18px;
  color: var(--text-faint);
  font-size: 12px;
}

.genre-pagination-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.genre-pagination-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.genre-pagination-legend i.is-selected {
  background: var(--success);
}

.genre-pagination-legend i.is-missing {
  background: var(--danger);
}

@media (max-width: 720px) {
  .genre-product-overview {
    grid-template-columns: 1fr;
  }

  .genre-product-image {
    width: min(180px, 100%);
  }

  .genre-page-navigation {
    grid-template-columns: 1fr 1fr;
  }

  .genre-status-pagination {
    grid-column: 1 / -1;
    grid-row: 1;
  }
}
</style>
