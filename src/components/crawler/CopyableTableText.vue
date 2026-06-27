<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = withDefaults(defineProps<{
  value: unknown
  display?: unknown
  always?: boolean
}>(), {
  display: undefined,
  always: false,
})

const triggerRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)
const copyText = computed(() => normalizeText(props.value))
const displayText = computed(() => {
  const text = props.display === undefined ? copyText.value : normalizeText(props.display)
  return text || '-'
})
const tooltipDisabled = computed(() => !copyText.value || copyText.value === '-' || (!props.always && !isOverflowing.value))

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateOverflow()
  if (typeof ResizeObserver !== 'undefined' && triggerRef.value) {
    resizeObserver = new ResizeObserver(updateOverflow)
    resizeObserver.observe(triggerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch([copyText, displayText], () => {
  updateOverflow()
})

function updateOverflow() {
  void nextTick(() => {
    const element = triggerRef.value
    isOverflowing.value = Boolean(element && element.scrollWidth > element.clientWidth)
  })
}

function normalizeText(value: unknown) {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function fallbackCopyText(text: string) {
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.top = '0'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(input)
  if (!copied) {
    throw new Error('copy failed')
  }
}

async function copyContent() {
  const text = copyText.value.trim()
  if (!text || text === '-') {
    ElMessage.warning('没有可复制的内容')
    return
  }
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      fallbackCopyText(text)
    }
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}
</script>

<template>
  <el-tooltip placement="top" effect="dark" :enterable="true" :disabled="tooltipDisabled">
    <template #content>
      <button class="copy-tooltip-content" type="button" @click.stop="copyContent">
        {{ copyText }}
      </button>
    </template>
    <span ref="triggerRef" class="copyable-table-trigger" @mouseenter="updateOverflow">
      <slot :display-text="displayText">
        {{ displayText }}
      </slot>
    </span>
  </el-tooltip>
</template>

<style scoped>
.copyable-table-trigger {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.copy-tooltip-content {
  display: block;
  max-width: 420px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  word-break: break-all;
}
</style>
