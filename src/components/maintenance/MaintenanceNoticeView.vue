<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Lock, RefreshRight, SwitchButton, Tools } from '@element-plus/icons-vue'

import type { MaintenanceSettings } from '../../types/crawler'

const props = defineProps<{
  maintenance: MaintenanceSettings
  authenticated: boolean
  refreshing?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  logout: []
  adminLogin: []
}>()

const startTime = computed(() => formatDateTime(props.maintenance.startsAt))
const estimatedEndTime = computed(() => formatDateTime(props.maintenance.estimatedEndsAt))

function formatDateTime(value?: string | null) {
  if (!value) {
    return '未指定'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
</script>

<template>
  <main class="maintenance-page">
    <section class="maintenance-panel">
      <div class="maintenance-status">
        <span class="status-indicator"></span>
        系统维护进行中
      </div>

      <div class="maintenance-icon" aria-hidden="true">
        <el-icon><Tools /></el-icon>
      </div>

      <p class="maintenance-eyebrow">SYSTEM MAINTENANCE</p>
      <h1>{{ maintenance.title }}</h1>
      <p class="maintenance-message">{{ maintenance.message }}</p>

      <div class="maintenance-timeline">
        <div class="timeline-item">
          <span class="timeline-icon"><el-icon><Clock /></el-icon></span>
          <div>
            <span>开始维护时间</span>
            <strong>{{ startTime }}</strong>
          </div>
        </div>
        <div class="timeline-divider"></div>
        <div class="timeline-item">
          <span class="timeline-icon timeline-icon-end"><el-icon><Clock /></el-icon></span>
          <div>
            <span>预计恢复时间</span>
            <strong>{{ estimatedEndTime }}</strong>
          </div>
        </div>
      </div>

      <div class="maintenance-actions">
        <el-button :icon="RefreshRight" :loading="refreshing" @click="emit('refresh')">
          刷新状态
        </el-button>
        <el-button
          v-if="authenticated"
          :icon="SwitchButton"
          @click="emit('logout')"
        >
          退出登录
        </el-button>
        <el-button
          v-else
          :icon="Lock"
          @click="emit('adminLogin')"
        >
          管理员登录
        </el-button>
      </div>

      <p class="maintenance-footnote">
        维护完成后刷新页面即可继续使用
      </p>
    </section>
  </main>
</template>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px 20px;
  color: #18202b;
  background:
    linear-gradient(rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.92)),
    repeating-linear-gradient(135deg, #dfe6ec 0, #dfe6ec 1px, transparent 1px, transparent 18px);
}

.maintenance-panel {
  width: min(720px, 100%);
  display: grid;
  justify-items: center;
  padding: 48px 52px 36px;
  border: 1px solid #d8e0e7;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(24, 32, 43, 0.13);
  text-align: center;
}

.maintenance-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #5b6571;
  font-size: 13px;
  font-weight: 700;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e6a23c;
  box-shadow: 0 0 0 5px rgba(230, 162, 60, 0.14);
}

.maintenance-icon {
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  margin-top: 28px;
  border: 1px solid #ced8e1;
  border-radius: 8px;
  color: #2c5f7d;
  background: #eef5f8;
  font-size: 34px;
}

.maintenance-eyebrow {
  margin: 24px 0 0;
  color: #71808d;
  font-size: 12px;
  font-weight: 800;
}

.maintenance-panel h1 {
  margin: 10px 0 0;
  color: #18202b;
  font-size: 30px;
  line-height: 1.3;
  letter-spacing: 0;
}

.maintenance-message {
  max-width: 560px;
  margin: 16px 0 0;
  color: #5f6b76;
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.maintenance-timeline {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
  gap: 22px;
  margin-top: 32px;
  padding: 22px 24px;
  border: 1px solid #e1e7ec;
  border-radius: 8px;
  background: #f8fafb;
  text-align: left;
}

.timeline-item {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.timeline-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: #2c5f7d;
  background: #e5f0f5;
}

.timeline-icon-end {
  color: #6b5835;
  background: #f5eddd;
}

.timeline-item div {
  min-width: 0;
}

.timeline-item span {
  display: block;
  color: #7b8792;
  font-size: 12px;
}

.timeline-item strong {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: #26313c;
  font-size: 14px;
}

.timeline-divider {
  background: #dfe5ea;
}

.maintenance-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.maintenance-footnote {
  margin: 24px 0 0;
  color: #939ca5;
  font-size: 12px;
}

@media (max-width: 640px) {
  .maintenance-page {
    padding: 16px;
  }

  .maintenance-panel {
    padding: 34px 20px 28px;
  }

  .maintenance-panel h1 {
    font-size: 24px;
  }

  .maintenance-timeline {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 18px;
  }

  .timeline-divider {
    width: 100%;
    height: 1px;
  }
}
</style>
