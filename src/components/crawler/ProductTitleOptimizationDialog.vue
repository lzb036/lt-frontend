<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
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
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const selectedVersion = computed(() => versions.value.find((item) => item.id === selectedVersionId.value) || null)
const streamPreview = computed(() => parseStreamPreview(streamText.value))

function decodeJsonFragment(value: string) {
  try {
    return JSON.parse(`"${value.replace(/"$/, '')}"`)
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }
}

function streamField(text: string, field: 'title' | 'subtitle') {
  const match = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)(?:"|$)`))
  return match ? decodeJsonFragment(match[1]) : ''
}

function parseStreamPreview(text: string) {
  const normalized = text.trim()
  const start = normalized.indexOf('{')
  const end = normalized.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      const payload = JSON.parse(normalized.slice(start, end + 1))
      return {
        title: String(payload.title || ''),
        subtitle: String(payload.subtitle || ''),
      }
    } catch {
    }
  }
  return {
    title: streamField(normalized, 'title'),
    subtitle: streamField(normalized, 'subtitle'),
  }
}

function sourceLabel(version: ProductTitleVersion) {
  if (version.source === 'original') return '原文'
  if (version.source === 'ai') return 'AI 生成'
  if (version.source === 'final') return '最终版本'
  return '人工版本'
}

function sourceTagType(version: ProductTitleVersion) {
  return version.source === 'original' ? 'info' : version.source === 'ai' ? 'primary' : 'success'
}

watch(
  () => [props.modelValue, props.product?.id] as const,
  ([open]) => { if (open && props.product) void loadVersions() },
)

async function loadVersions() {
  if (!props.product) return
  loading.value = true
  try {
    const result = await api.listProductTitleVersions(props.product.id)
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
      onCompleted: (version) => {
        versions.value = [version, ...versions.value]
        streamText.value = ''
      },
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
      <section v-if="generating || streamText" class="stream-block">
        <div class="section-title">
          <strong>实时生成</strong>
          <el-tag v-if="generating" type="warning">生成中</el-tag>
        </div>
        <div class="title-fields">
          <div><span>标题</span><p>{{ streamPreview.title || '正在生成标题...' }}</p></div>
          <div><span>副标题</span><p>{{ streamPreview.subtitle || '正在生成副标题...' }}</p></div>
        </div>
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
                <el-tag size="small" :type="sourceTagType(version)">{{ sourceLabel(version) }}</el-tag>
                <el-tag v-if="version.isSelected" size="small" type="success">当前使用</el-tag>
                <span v-if="version.modelName">{{ version.modelName }}</span>
                <span>{{ version.createdAt || '-' }}</span>
              </div>
              <div class="title-fields">
                <div><span>标题</span><p>{{ version.title }}</p></div>
                <div><span>副标题</span><p>{{ version.subtitle || '-' }}</p></div>
              </div>
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
.stream-block { border: 1px solid var(--panel-border); border-radius: 8px; padding: 14px; background: var(--panel-soft); }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.version-list { display: grid; gap: 10px; width: 100%; }
.version-row { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; border: 1px solid var(--panel-border); border-radius: 8px; padding: 12px; cursor: pointer; }
.version-row:has(.is-checked) { border-color: var(--accent); background: var(--panel-soft); }
.version-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; color: var(--text-muted); font-size: 12px; }
.version-content { min-width: 0; display: grid; gap: 6px; }
.title-fields { display: grid; gap: 10px; }
.title-fields > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; }
.title-fields span { color: var(--text-muted); }
.title-fields p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
</style>
