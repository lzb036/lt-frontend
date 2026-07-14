<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { MagicStick, Select } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { ProductItem, ProductTitleVersion } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{ modelValue: boolean; product: ProductItem | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
const api = useCollectorApi()
const loading = shallowRef(false)
const generating = shallowRef(false)
const saving = shallowRef(false)
const versions = shallowRef<ProductTitleVersion[]>([])
const selectedVersionId = shallowRef<number | null>(null)
const streamText = shallowRef('')
const current = reactive({ title: '', subtitle: '' })
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const selectedVersion = computed(() => versions.value.find((item) => item.id === selectedVersionId.value) || null)

watch(
  () => [props.modelValue, props.product?.id] as const,
  ([open]) => { if (open && props.product) void loadVersions() },
)

async function loadVersions() {
  if (!props.product) return
  loading.value = true
  try {
    const result = await api.listProductTitleVersions(props.product.id)
    Object.assign(current, result.current)
    versions.value = result.versions
    selectedVersionId.value = result.versions.find((item) => item.isSelected)?.id || null
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载标题历史失败'))
  } finally {
    loading.value = false
  }
}

async function generateVersion() {
  if (!props.product || generating.value) return
  generating.value = true
  streamText.value = ''
  try {
    await api.streamProductTitleVersion(props.product.id, {
      onDelta: (content) => { streamText.value += content },
      onCompleted: (version) => { versions.value = [version, ...versions.value] },
    })
    ElMessage.success('已生成新的优化版本，请手动选择后保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '生成标题失败'))
  } finally {
    generating.value = false
  }
}

async function saveVersion() {
  if (!props.product || !selectedVersionId.value) {
    ElMessage.warning('请选择要使用的标题版本')
    return
  }
  saving.value = true
  try {
    await api.saveProductTitleVersion(props.product.id, selectedVersionId.value)
    await loadVersions()
    emit('saved')
    ElMessage.success('标题版本已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存标题版本失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="优化标题" width="860px" destroy-on-close append-to-body>
    <div v-loading="loading" class="optimization-dialog">
      <section class="current-block">
        <strong>当前商品内容</strong>
        <div><span>标题</span><p>{{ current.title || '-' }}</p></div>
        <div><span>副标题</span><p>{{ current.subtitle || '-' }}</p></div>
      </section>
      <section v-if="generating || streamText" class="stream-block">
        <div class="section-title">
          <strong>实时生成</strong>
          <el-tag v-if="generating" type="warning">生成中</el-tag>
        </div>
        <pre>{{ streamText || '正在理解商品文本和主图...' }}</pre>
      </section>
      <section>
        <div class="section-title">
          <strong>历史优化版本</strong>
          <el-button type="primary" :icon="MagicStick" :loading="generating" @click="generateVersion">开始优化</el-button>
        </div>
        <el-radio-group v-model="selectedVersionId" class="version-list">
          <label v-for="version in versions" :key="version.id" class="version-row">
            <el-radio :value="version.id" />
            <div class="version-content">
              <div class="version-meta">
                <el-tag size="small" :type="version.isSelected ? 'success' : 'info'">
                  {{ version.isSelected ? '当前使用' : 'AI 版本' }}
                </el-tag>
                <span>{{ version.modelName || '-' }}</span>
                <span>{{ version.createdAt || '-' }}</span>
              </div>
              <p><b>标题：</b>{{ version.title }}</p>
              <p><b>副标题：</b>{{ version.subtitle || '-' }}</p>
            </div>
          </label>
        </el-radio-group>
        <el-empty v-if="versions.length === 0" description="暂无优化历史，点击开始优化生成第一个版本" />
      </section>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :icon="Select" :loading="saving" :disabled="!selectedVersion" @click="saveVersion">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.optimization-dialog { display: grid; gap: 18px; }
.current-block, .stream-block { border: 1px solid var(--panel-border); border-radius: 8px; padding: 14px; background: var(--panel-soft); }
.current-block > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; margin-top: 10px; }
.current-block span { color: var(--text-muted); }
.current-block p, .version-content p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.stream-block pre { margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.6; }
.version-list { display: grid; gap: 10px; width: 100%; }
.version-row { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; border: 1px solid var(--panel-border); border-radius: 8px; padding: 12px; cursor: pointer; }
.version-row:has(.is-checked) { border-color: var(--accent); background: var(--panel-soft); }
.version-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; color: var(--text-muted); font-size: 12px; }
.version-content { min-width: 0; display: grid; gap: 6px; }
</style>
