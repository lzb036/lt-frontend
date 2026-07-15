<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowRight, Refresh, Search } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem, ProductReplacement } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  product: ProductItem | null
}>()

const emit = defineEmits<{
  created: [product: ProductItem]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const router = useRouter()
const sourceUrl = shallowRef('')
const collecting = shallowRef(false)
const replacement = shallowRef<ProductReplacement | null>(null)
const activeTab = shallowRef('before')

const beforeImages = computed(() => {
  const images = replacement.value?.before.detail?.images || replacement.value?.before.images || []
  return Array.from(new Set(images.filter(Boolean)))
})

const afterImages = computed(() => {
  const images = replacement.value?.pendingProduct?.images || replacement.value?.after.images || []
  return Array.from(new Set(images.filter(Boolean)))
})

const beforeVariantCount = computed(() => replacement.value?.before.detail?.variants?.length || 0)
const afterVariantCount = computed(() => Object.keys(replacement.value?.after.variants || {}).length)

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    sourceUrl.value = ''
    replacement.value = null
    activeTab.value = 'before'
  }
})

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
    activeTab.value = 'after'
    emit('created', result.pendingProduct)
    ElMessage.success('替换商品已采集，并放入待审核商品')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '采集来源商品失败'))
  } finally {
    collecting.value = false
  }
}

async function openPendingProducts() {
  visible.value = false
  await router.push({ name: 'pending-products' })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="替换店铺商品"
    width="720px"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
  >
    <el-form v-if="!replacement" label-position="top">
      <el-form-item label="来源商品链接">
        <el-input
          v-model="sourceUrl"
          placeholder="输入用于替换的乐天商品链接"
          clearable
          @keydown.enter="collectSourceProduct"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>
    </el-form>

    <el-tabs v-else v-model="activeTab" class="replacement-tabs">
      <el-tab-pane label="替换前" name="before">
        <section class="replacement-preview">
          <header>
            <h3>{{ replacement.before.title }}</h3>
            <p>{{ replacement.before.tagline || '无副标题' }}</p>
          </header>
          <dl>
            <dt>商品品类</dt>
            <dd>{{ replacement.before.genrePathZh || replacement.before.genrePath || replacement.before.genreId || '-' }}</dd>
            <dt>价格</dt>
            <dd>{{ replacement.before.price ?? '-' }} 日元</dd>
            <dt>SKU</dt>
            <dd>{{ beforeVariantCount }} 个</dd>
            <dt>图片</dt>
            <dd>{{ beforeImages.length }} 张</dd>
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
            <el-empty v-if="beforeImages.length < 1" description="暂无图片" />
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="替换后" name="after">
        <section class="replacement-preview">
          <header>
            <h3>{{ replacement.pendingProduct?.title || replacement.after.title }}</h3>
            <p>{{ replacement.pendingProduct?.tagline || replacement.after.tagline || '无副标题' }}</p>
          </header>
          <dl>
            <dt>商品品类</dt>
            <dd>
              {{
                replacement.pendingProduct?.genrePathZh
                  || replacement.pendingProduct?.genrePath
                  || replacement.after.genrePathZh
                  || replacement.after.genrePath
                  || replacement.after.genreId
                  || '-'
              }}
            </dd>
            <dt>价格</dt>
            <dd>{{ replacement.pendingProduct?.price ?? replacement.after.price ?? '-' }} 日元</dd>
            <dt>SKU</dt>
            <dd>{{ afterVariantCount }} 个</dd>
            <dt>图片</dt>
            <dd>{{ afterImages.length }} 张</dd>
          </dl>
          <div class="replacement-images">
            <el-image
              v-for="(image, index) in afterImages"
              :key="`${image}-${index}`"
              :src="image"
              fit="cover"
              preview-teleported
              :preview-src-list="afterImages"
              :initial-index="index"
            />
            <el-empty v-if="afterImages.length < 1" description="暂无图片" />
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="visible = false">{{ replacement ? '关闭' : '取消' }}</el-button>
      <el-button
        v-if="!replacement"
        type="primary"
        :icon="Refresh"
        :loading="collecting"
        @click="collectSourceProduct"
      >
        开始采集
      </el-button>
      <el-button v-else type="primary" :icon="ArrowRight" @click="openPendingProducts">
        前往待审核商品
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.replacement-preview {
  display: grid;
  gap: 16px;
}

.replacement-preview header {
  display: grid;
  gap: 6px;
}

.replacement-preview h3,
.replacement-preview p {
  margin: 0;
}

.replacement-preview p {
  color: var(--text-muted);
}

.replacement-preview dl {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0;
}

.replacement-preview dt {
  color: var(--text-muted);
}

.replacement-preview dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
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

.replacement-images :deep(.el-empty) {
  grid-column: 1 / -1;
}

@media (max-width: 720px) {
  .replacement-images {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
