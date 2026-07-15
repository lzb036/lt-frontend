<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, Search } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem, RakutenGenreNode, RakutenGenreOption } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

interface CascaderLazyNode {
  root: boolean
  data?: RakutenGenreNode
}

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
const saving = shallowRef(false)
const searching = shallowRef(false)
const searchGenreId = shallowRef('')
const searchOptions = shallowRef<RakutenGenreOption[]>([])
const selectedPath = shallowRef<string[]>([])
const genreIdsByPath = new Map<string, string>()
let searchTimer: ReturnType<typeof setTimeout> | null = null

const currentSegments = computed(() => splitGenrePath(props.product.genrePath))
const currentLabel = computed(() => currentSegments.value.at(-1) || '请选择品类')
const cascaderProps = {
  lazy: true,
  emitPath: true,
  value: 'genrePath',
  label: 'label',
  leaf: 'leaf',
  lazyLoad: loadGenreChildren,
}

watch(
  () => props.product.genreId,
  () => {
    searchGenreId.value = ''
    selectedPath.value = []
  },
)

function splitGenrePath(path: string) {
  return String(path || '').split('>').map((segment) => segment.trim()).filter(Boolean)
}

async function loadGenreChildren(node: CascaderLazyNode, resolve: (nodes: RakutenGenreNode[]) => void) {
  try {
    const parentPath = node.root ? '' : String(node.data?.genrePath || '')
    const children = await api.listRakutenGenreChildren(parentPath)
    for (const child of children) {
      if (child.genreId) {
        genreIdsByPath.set(child.genrePath, child.genreId)
      }
    }
    resolve(children)
  } catch (error) {
    resolve([])
    ElMessage.error(toApiErrorMessage(error, '加载品类层级失败'))
  }
}

async function selectCascaderGenre(paths: string[]) {
  const genrePath = paths.at(-1) || ''
  const genreId = genreIdsByPath.get(genrePath) || ''
  if (!genreId) {
    return
  }
  await saveGenre(genreId)
  selectedPath.value = []
}

function searchGenres(keyword: string) {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  const normalizedKeyword = keyword.trim()
  if (!normalizedKeyword) {
    searchOptions.value = []
    searching.value = false
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      searchOptions.value = await api.searchRakutenGenres(normalizedKeyword, 50)
    } catch (error) {
      ElMessage.error(toApiErrorMessage(error, '搜索品类失败'))
    } finally {
      searching.value = false
    }
  }, 250)
}

async function selectSearchGenre(genreId: string) {
  if (!genreId) {
    return
  }
  await saveGenre(genreId)
  searchGenreId.value = ''
  searchOptions.value = []
}

async function saveGenre(genreId: string) {
  if (!genreId || genreId === props.product.genreId || saving.value) {
    return
  }
  saving.value = true
  try {
    const updated = await api.updatePendingProductGenre(props.product.id, genreId)
    emit('updated', updated)
    ElMessage.success('品类已更新')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新品类失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="pending-product-genre">
    <el-popover
      placement="bottom-start"
      trigger="click"
      :width="760"
      :disabled="disabled || saving"
      popper-class="pending-product-genre-popper"
    >
      <template #reference>
        <el-button
          class="pending-product-genre-trigger"
          :loading="saving"
          :disabled="disabled"
        >
          <span class="pending-product-genre-trigger-text">{{ currentLabel }}</span>
          <el-icon><ArrowDown /></el-icon>
        </el-button>
      </template>

      <div class="pending-product-genre-panel">
        <div v-if="currentSegments.length" class="pending-product-genre-current">
          <span class="pending-product-genre-caption">当前品类</span>
          <div class="pending-product-genre-breadcrumb">
            <template v-for="(segment, index) in currentSegments" :key="`${segment}-${index}`">
              <span v-if="index > 0" class="pending-product-genre-separator">/</span>
              <el-tag size="small" effect="plain">{{ segment }}</el-tag>
            </template>
          </div>
        </div>

        <el-select
          v-model="searchGenreId"
          class="pending-product-genre-search"
          filterable
          remote
          reserve-keyword
          clearable
          :remote-method="searchGenres"
          :loading="searching"
          :prefix-icon="Search"
          placeholder="输入品类编号或路径关键词快速搜索"
          @change="selectSearchGenre"
        >
          <el-option
            v-for="option in searchOptions"
            :key="option.genreId"
            :label="option.genrePath"
            :value="option.genreId"
          >
            <div class="pending-product-genre-search-option">
              <div class="pending-product-genre-breadcrumb">
                <template
                  v-for="(segment, index) in splitGenrePath(option.genrePath)"
                  :key="`${option.genreId}-${index}`"
                >
                  <span v-if="index > 0" class="pending-product-genre-separator">/</span>
                  <span class="pending-product-genre-segment">{{ segment }}</span>
                </template>
              </div>
              <span class="pending-product-genre-option-id">{{ option.genreId }}</span>
            </div>
          </el-option>
        </el-select>

        <el-cascader-panel
          v-model="selectedPath"
          class="pending-product-genre-cascader"
          :props="cascaderProps"
          @change="selectCascaderGenre"
        />
      </div>
    </el-popover>

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

.pending-product-genre-trigger {
  justify-content: space-between;
  width: 100%;
  min-width: 0;
}

.pending-product-genre-trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-product-genre-id,
.pending-product-genre-option-id,
.pending-product-genre-caption {
  color: var(--text-muted);
  font-size: 12px;
}

.pending-product-genre-panel {
  display: grid;
  gap: 12px;
}

.pending-product-genre-current {
  display: grid;
  gap: 6px;
}

.pending-product-genre-breadcrumb {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.pending-product-genre-separator {
  color: var(--text-faint);
}

.pending-product-genre-search {
  width: 100%;
}

.pending-product-genre-search-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.pending-product-genre-segment {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-product-genre-cascader {
  width: 100%;
  min-height: 260px;
}

@media (max-width: 720px) {
  .pending-product-genre {
    grid-template-columns: 1fr;
  }
}
</style>
