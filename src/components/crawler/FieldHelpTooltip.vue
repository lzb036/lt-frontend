<script setup lang="ts">
import { QuestionFilled } from '@element-plus/icons-vue'

defineProps<{
  content: string
  label: string
}>()
</script>

<template>
  <el-tooltip
    :content="content"
    effect="dark"
    placement="top"
    :fallback-placements="['top', 'bottom', 'right', 'left']"
    :hide-after="0"
    :popper-style="{ maxWidth: '360px', lineHeight: '1.6' }"
  >
    <button
      class="field-help-trigger"
      type="button"
      :aria-label="`查看${label}说明`"
    >
      <el-icon><QuestionFilled /></el-icon>
    </button>
  </el-tooltip>
</template>

<style scoped>
.field-help-trigger {
  display: inline-grid;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: help;
  place-items: center;
}

.field-help-trigger:hover,
.field-help-trigger:focus-visible {
  color: var(--accent);
  outline: none;
}

.field-help-trigger:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent);
}
</style>
