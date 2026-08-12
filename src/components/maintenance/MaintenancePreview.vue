<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Tools } from '@element-plus/icons-vue'

import type { MaintenanceSettingsPayload } from '../../types/crawler'

const props = defineProps<{
  settings: MaintenanceSettingsPayload
}>()

const startLabel = computed(() => formatDateTime(props.settings.startsAt))
const endLabel = computed(() => formatDateTime(props.settings.estimatedEndsAt))

function formatDateTime(value?: string | null) {
  if (!value) {
    return '未指定'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
</script>

<template>
  <section class="preview-panel">
    <div class="preview-toolbar">
      <span>普通用户维护页预览</span>
      <span class="preview-live"><i></i> 实时预览</span>
    </div>
    <div class="preview-canvas">
      <div class="preview-icon"><el-icon><Tools /></el-icon></div>
      <p class="preview-eyebrow">SYSTEM MAINTENANCE</p>
      <h2>{{ settings.title || '系统维护中' }}</h2>
      <p class="preview-message">{{ settings.message || '系统正在进行维护升级，请稍后再试。' }}</p>
      <div class="preview-times">
        <div>
          <el-icon><Clock /></el-icon>
          <span>开始时间</span>
          <strong>{{ startLabel }}</strong>
        </div>
        <div>
          <el-icon><Clock /></el-icon>
          <span>预计恢复</span>
          <strong>{{ endLabel }}</strong>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview-panel {
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

.preview-toolbar {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--panel-border);
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 700;
}

.preview-live {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-faint);
  font-size: 12px;
}

.preview-live i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #67c23a;
}

.preview-canvas {
  min-height: 430px;
  display: grid;
  place-items: center;
  align-content: center;
  padding: 38px 26px;
  color: #17212b;
  background:
    linear-gradient(rgba(250, 252, 253, 0.92), rgba(250, 252, 253, 0.96)),
    repeating-linear-gradient(135deg, #dfe5ea 0, #dfe5ea 1px, transparent 1px, transparent 16px);
  text-align: center;
}

.preview-icon {
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  border: 1px solid #cbd8df;
  border-radius: 8px;
  color: #2c5f7d;
  background: #eaf3f7;
  font-size: 28px;
}

.preview-eyebrow {
  margin: 20px 0 0;
  color: #74828f;
  font-size: 11px;
  font-weight: 800;
}

.preview-canvas h2 {
  margin: 8px 0 0;
  font-size: 23px;
  line-height: 1.35;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.preview-message {
  max-width: 440px;
  margin: 12px 0 0;
  color: #65717c;
  font-size: 13px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.preview-times {
  width: min(440px, 100%);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 26px;
  overflow: hidden;
  border: 1px solid #dde4e9;
  border-radius: 8px;
  background: #dde4e9;
}

.preview-times div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 5px 8px;
  padding: 16px;
  background: #ffffff;
  text-align: left;
}

.preview-times .el-icon {
  grid-row: span 2;
  color: #507186;
  font-size: 18px;
}

.preview-times span {
  color: #89939c;
  font-size: 11px;
}

.preview-times strong {
  color: #33404c;
  font-size: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 560px) {
  .preview-times {
    grid-template-columns: 1fr;
  }
}
</style>
