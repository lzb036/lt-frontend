<script setup lang="ts">
import { computed } from 'vue'
import { Clock, SwitchButton, Tools } from '@element-plus/icons-vue'

import type { MaintenanceSettings } from '../../types/crawler'

const props = defineProps<{
  maintenance: MaintenanceSettings
}>()

const emit = defineEmits<{
  logout: []
}>()

const startTime = computed(() => formatDateTime(props.maintenance.startsAt))
const estimatedEndTime = computed(() => formatDateTime(props.maintenance.estimatedEndsAt))
const maintenanceDate = computed(() => {
  const value = props.maintenance.startsAt
  if (!value) {
    return { month: '--', day: '--' }
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { month: '--', day: '--' }
  }
  return {
    month: new Intl.DateTimeFormat('zh-CN', { month: '2-digit' }).format(date),
    day: new Intl.DateTimeFormat('zh-CN', { day: '2-digit' }).format(date),
  }
})

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
    <header class="maintenance-header">
      <div class="maintenance-brand">
        <span class="brand-mark">
          <img src="/favicon.svg" alt="" />
        </span>
        <div>
          <strong>商品采集系统</strong>
          <span>PRODUCT COLLECTOR</span>
        </div>
      </div>
      <div class="maintenance-status">
        <span class="status-indicator"></span>
        维护窗口进行中
      </div>
    </header>

    <section class="maintenance-content">
      <div class="maintenance-main">
        <div class="maintenance-symbol" aria-hidden="true">
          <el-icon><Tools /></el-icon>
          <span class="symbol-orbit"></span>
        </div>

        <p class="maintenance-eyebrow">SCHEDULED MAINTENANCE</p>
        <h1>{{ maintenance.title }}</h1>
        <p class="maintenance-message">{{ maintenance.message }}</p>

        <div class="maintenance-progress" aria-label="维护进度">
          <div class="progress-line"></div>
          <div class="progress-step is-complete">
            <span></span>
            <strong>服务暂停</strong>
          </div>
          <div class="progress-step is-active">
            <span></span>
            <strong>维护处理中</strong>
          </div>
          <div class="progress-step">
            <span></span>
            <strong>服务恢复</strong>
          </div>
        </div>

        <p class="maintenance-auto-note">维护结束后，当前页面会自动恢复系统访问。</p>
        <button class="logout-button" type="button" @click="emit('logout')">
          <el-icon><SwitchButton /></el-icon>
          退出当前账号
        </button>
      </div>

      <aside class="maintenance-window">
        <div class="window-date">
          <span>{{ maintenanceDate.month }}月</span>
          <strong>{{ maintenanceDate.day }}</strong>
          <em>维护窗口</em>
        </div>

        <div class="window-details">
          <div class="window-heading">
            <span class="window-heading-icon"><el-icon><Clock /></el-icon></span>
            <div>
              <span>MAINTENANCE WINDOW</span>
              <strong>计划维护时间</strong>
            </div>
          </div>

          <div class="time-row">
            <span>开始维护时间</span>
            <strong>{{ startTime }}</strong>
          </div>
          <div class="time-separator"></div>
          <div class="time-row">
            <span>预计恢复时间</span>
            <strong>{{ estimatedEndTime }}</strong>
          </div>

          <div class="window-state">
            <span class="status-indicator"></span>
            <div>
              <strong>系统暂时不可用</strong>
              <span>维护团队正在按计划处理</span>
            </div>
          </div>
        </div>
      </aside>
    </section>

    <footer class="maintenance-footer">
      <span>RAKUTEN PRODUCT COLLECTOR</span>
      <span>系统状态 · 维护中</span>
    </footer>
  </main>
</template>

<style scoped>
.maintenance-page {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  color: #17212b;
  background: #f4f7f6;
}

.maintenance-header {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 clamp(24px, 5vw, 80px);
  border-bottom: 1px solid #d9e1df;
  background: #ffffff;
}

.maintenance-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid #b9d7d2;
  border-radius: 8px;
  background: #e8f4f1;
}

.brand-mark img {
  width: 29px;
  height: 29px;
}

.maintenance-brand strong,
.maintenance-brand span,
.window-heading span,
.window-heading strong,
.time-row span,
.time-row strong,
.window-state span,
.window-state strong {
  display: block;
}

.maintenance-brand strong {
  font-size: 16px;
}

.maintenance-brand div > span {
  margin-top: 3px;
  color: #74817e;
  font-size: 10px;
  font-weight: 700;
}

.maintenance-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #596662;
  font-size: 12px;
  font-weight: 700;
}

.status-indicator {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #d9902f;
  box-shadow: 0 0 0 5px rgba(217, 144, 47, 0.13);
}

.maintenance-content {
  width: min(1180px, calc(100% - 48px));
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.65fr);
  align-items: center;
  gap: clamp(54px, 8vw, 120px);
  margin: 0 auto;
  padding: 64px 0;
}

.maintenance-main {
  min-width: 0;
}

.maintenance-symbol {
  position: relative;
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  color: #17685d;
  border: 1px solid #a9cbc5;
  border-radius: 50%;
  background: #e5f2ef;
  font-size: 38px;
}

.symbol-orbit {
  position: absolute;
  inset: -9px;
  border: 1px dashed #91b9b2;
  border-radius: 50%;
}

.maintenance-eyebrow {
  margin: 34px 0 0;
  color: #687873;
  font-size: 12px;
  font-weight: 800;
}

.maintenance-main h1 {
  max-width: 700px;
  margin: 12px 0 0;
  color: #18202b;
  font-size: clamp(36px, 5vw, 62px);
  line-height: 1.12;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.maintenance-message {
  max-width: 680px;
  margin: 22px 0 0;
  color: #62706c;
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.maintenance-progress {
  position: relative;
  width: min(600px, 100%);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 48px;
}

.progress-line {
  position: absolute;
  top: 8px;
  left: 10px;
  right: 10px;
  height: 2px;
  background: #cdd8d5;
}

.progress-step {
  position: relative;
  display: grid;
  gap: 12px;
  color: #8b9793;
  font-size: 12px;
}

.progress-step:nth-child(3) {
  justify-items: center;
}

.progress-step:last-child {
  justify-items: end;
}

.progress-step > span {
  z-index: 1;
  width: 18px;
  height: 18px;
  border: 4px solid #f4f7f6;
  border-radius: 50%;
  background: #b9c6c2;
}

.progress-step.is-complete,
.progress-step.is-active {
  color: #2a3935;
}

.progress-step.is-complete > span {
  background: #27796d;
}

.progress-step.is-active > span {
  background: #d9902f;
  box-shadow: 0 0 0 5px rgba(217, 144, 47, 0.14);
}

.maintenance-auto-note {
  margin: 32px 0 0;
  color: #7a8783;
  font-size: 12px;
}

.logout-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 18px;
  padding: 0;
  border: 0;
  color: #5f6e69;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.logout-button:hover {
  color: #17685d;
}

.maintenance-window {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  min-height: 390px;
  border-top: 1px solid #bbc9c5;
  border-bottom: 1px solid #bbc9c5;
}

.window-date {
  display: grid;
  align-content: start;
  justify-items: center;
  padding: 38px 18px;
  color: #ffffff;
  background: #17685d;
}

.window-date span {
  font-size: 13px;
  font-weight: 700;
}

.window-date strong {
  margin-top: 6px;
  font-size: 54px;
  line-height: 1;
}

.window-date em {
  margin-top: 18px;
  font-size: 11px;
  font-style: normal;
  opacity: 0.72;
}

.window-details {
  display: grid;
  align-content: center;
  padding: 36px 30px;
  background: #ffffff;
}

.window-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 28px;
  border-bottom: 1px solid #e0e6e4;
}

.window-heading-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #17685d;
  background: #e7f2ef;
}

.window-heading div > span {
  color: #8a9692;
  font-size: 9px;
  font-weight: 800;
}

.window-heading strong {
  margin-top: 4px;
  font-size: 15px;
}

.time-row {
  padding: 24px 0;
}

.time-row span {
  color: #8a9692;
  font-size: 11px;
}

.time-row strong {
  margin-top: 7px;
  color: #24312d;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.time-separator {
  height: 1px;
  background: #e0e6e4;
}

.window-state {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  padding: 16px;
  border-left: 3px solid #d9902f;
  background: #fbf7ef;
}

.window-state strong {
  color: #3b352a;
  font-size: 12px;
}

.window-state div > span {
  margin-top: 3px;
  color: #8d8068;
  font-size: 10px;
}

.maintenance-footer {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 clamp(24px, 5vw, 80px);
  border-top: 1px solid #d9e1df;
  color: #87928f;
  background: #eef2f1;
  font-size: 10px;
  font-weight: 700;
}

@media (max-width: 860px) {
  .maintenance-content {
    grid-template-columns: 1fr;
    gap: 54px;
    align-items: start;
    padding: 46px 0;
  }

  .maintenance-window {
    min-height: 0;
  }
}

@media (max-width: 560px) {
  .maintenance-header {
    min-height: 74px;
    padding: 0 18px;
  }

  .maintenance-brand div > span {
    display: none;
  }

  .maintenance-status {
    font-size: 10px;
  }

  .maintenance-content {
    width: calc(100% - 36px);
    padding: 38px 0;
  }

  .maintenance-symbol {
    width: 70px;
    height: 70px;
    font-size: 30px;
  }

  .maintenance-message {
    font-size: 14px;
  }

  .maintenance-window {
    grid-template-columns: 80px minmax(0, 1fr);
  }

  .window-date {
    padding: 30px 10px;
  }

  .window-date strong {
    font-size: 40px;
  }

  .window-details {
    padding: 28px 20px;
  }

  .maintenance-footer {
    padding: 0 18px;
  }
}
</style>
