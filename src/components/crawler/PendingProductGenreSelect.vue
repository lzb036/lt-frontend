<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem, RakutenGenreOption } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = withDefaults(defineProps<{
  product: ProductItem
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  updated: [product: ProductItem]
}>()

const api = useCollectorApi()
const selectedGenreId = shallowRef(props.product.genreId || '')
const options = shallowRef<RakutenGenreOption[]>(currentOption())
const searching = shallowRef(false)
const saving = shallowRef(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => [props.product.genreId, props.product.genrePath] as const,
  () => {
    selectedGenreId.value = props.product.genreId || ''
    options.value = mergeCurrentOption(options.value)
  },
)

function currentOption(): RakutenGenreOption[] {
  if (!props.product.genreId || !props.product.genrePath) {
    return []
  }
  return [{ genreId: props.product.genreId, genrePath: props.product.genrePath }]
}

function mergeCurrentOption(values: RakutenGenreOption[]) {
  const current = currentOption()
  if (current.length < 1 || values.some((option) => option.genreId === current[0]?.genreId)) {
    return values
  }
  return [...current, ...values]
}

function searchGenres(keyword: string) {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      options.value = mergeCurrentOption(await api.searchRakutenGenres(keyword.trim(), 50))
    } catch (error) {
      ElMessage.error(toApiErrorMessage(error, '加载品类失败'))
    } finally {
      searching.value = false
    }
  }, 250)
}

async function saveGenre(genreId: string) {
  const previousGenreId = props.product.genreId || ''
  if (!genreId || genreId === previousGenreId) {
    return
  }
  saving.value = true
  try {
    const updated = await api.updatePendingProductGenre(props.product.id, genreId)
    selectedGenreId.value = updated.genreId
    options.value = mergeCurrentOption([
      { genreId: updated.genreId, genrePath: updated.genrePath },
      ...options.value.filter((option) => option.genreId !== updated.genreId),
    ])
    emit('updated', updated)
    ElMessage.success('品类已更新')
  } catch (error) {
    selectedGenreId.value = previousGenreId
    ElMessage.error(toApiErrorMessage(error, '更新品类失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="pending-product-genre">
    <el-select
      v-model="selectedGenreId"
      class="pending-product-genre-select"
      filterable
      remote
      reserve-keyword
      :remote-method="searchGenres"
      :loading="searching"
      :disabled="disabled || saving"
      placeholder="请选择品类"
      @visible-change="$event && searchGenres('')"
      @change="saveGenre"
    >
      <el-option
        v-for="option in options"
        :key="option.genreId"
        :label="option.genrePath"
        :value="option.genreId"
      >
        <div class="pending-product-genre-option">
          <span>{{ option.genrePath }}</span>
          <span class="pending-product-genre-option-id">{{ option.genreId }}</span>
        </div>
      </el-option>
    </el-select>
    <span class="pending-product-genre-id">
      品类编号：{{ product.genreId || '未设置' }}
    </span>
  </div>
</template>

<style scoped>
.pending-product-genre {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}

.pending-product-genre-select {
  width: 100%;
}

.pending-product-genre-id,
.pending-product-genre-option-id {
  color: var(--text-muted);
  font-size: 12px;
}

.pending-product-genre-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
}

.pending-product-genre-option > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .pending-product-genre {
    grid-template-columns: 1fr;
  }
}
</style>
