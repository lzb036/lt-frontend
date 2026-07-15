<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  product: ProductItem | null
}>()

const emit = defineEmits<{
  created: [product: ProductItem]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const sourceUrl = shallowRef('')
const collecting = shallowRef(false)

watch(visible, (nextVisible) => {
  if (!nextVisible) {
    sourceUrl.value = ''
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
    emit('created', result.pendingProduct)
    ElMessage.success('替换商品已采集，并放入待审核商品')
    visible.value = false
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '采集来源商品失败'))
  } finally {
    collecting.value = false
  }
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
    <el-form label-position="top">
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

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :icon="Refresh" :loading="collecting" @click="collectSourceProduct">
        开始采集
      </el-button>
    </template>
  </el-dialog>
</template>
