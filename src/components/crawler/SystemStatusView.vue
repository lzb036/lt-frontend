<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Refresh, Setting, Warning } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { SystemHealth } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const api = useCollectorApi()
const loading = shallowRef(false)
const health = shallowRef<SystemHealth | null>(null)

const overallTagType = computed(() => {
  if (!health.value) {
    return 'info'
  }
  return health.value.status === 'ok' ? 'success' : 'warning'
})

const overallText = computed(() => {
  if (!health.value) {
    return '未检查'
  }
  return health.value.status === 'ok' ? '运行正常' : '存在异常'
})

const checkItems = computed(() => {
  const checks = health.value?.checks
  return [
    {
      key: 'database',
      label: '数据库连接',
      description: '接口会执行一次轻量查询确认数据库可用。',
      ok: Boolean(checks?.database),
    },
    {
      key: 'productImagesWritable',
      label: '正式图片目录',
      description: '检查 data/product-images 是否存在且可写。',
      ok: Boolean(checks?.productImagesWritable),
    },
    {
      key: 'productImageDraftsWritable',
      label: '草稿图片目录',
      description: '检查 data/product-image-drafts 是否存在且可写。',
      ok: Boolean(checks?.productImageDraftsWritable),
    },
  ]
})

async function loadHealth() {
  loading.value = true
  try {
    health.value = await api.getSystemHealth()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '读取系统状态失败'))
  } finally {
    loading.value = false
  }
}

onMounted(loadHealth)
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">System</p>
        <h1>系统状态</h1>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadHealth">
          刷新
        </el-button>
      </div>
    </div>

    <div class="status-band">
      <div class="status-main">
        <el-icon class="status-icon" :class="{ ok: health?.status === 'ok', warn: health?.status !== 'ok' }">
          <component :is="health?.status === 'ok' ? CircleCheck : Warning" />
        </el-icon>
        <div>
          <span class="muted-label">健康检查</span>
          <strong>{{ overallText }}</strong>
          <span class="version-text">{{ health?.name || 'LT Product Collector API' }} · {{ health?.version || '-' }}</span>
        </div>
      </div>
      <el-tag :type="overallTagType" size="large">
        {{ health?.status || 'unchecked' }}
      </el-tag>
    </div>

    <section class="section-panel">
      <div class="section-title">
        <el-icon><CircleCheck /></el-icon>
        <span>健康检查项</span>
      </div>
      <div class="check-grid">
        <div v-for="item in checkItems" :key="item.key" class="check-item">
          <el-icon class="check-icon" :class="{ ok: item.ok, error: !item.ok }">
            <component :is="item.ok ? CircleCheck : CircleClose" />
          </el-icon>
          <div>
            <strong>{{ item.label }}</strong>
            <p>{{ item.description }}</p>
          </div>
          <el-tag :type="item.ok ? 'success' : 'danger'">
            {{ item.ok ? '正常' : '异常' }}
          </el-tag>
        </div>
      </div>
    </section>

    <section class="section-panel">
      <div class="section-title">
        <el-icon><Setting /></el-icon>
        <span>运行策略</span>
      </div>
      <div class="settings-grid">
        <div class="setting-item">
          <span class="muted-label">任务队列模式</span>
          <strong>{{ health?.settings.taskQueueMode || '-' }}</strong>
          <p>thread 为原进程内后台线程；redis 为 Redis + RQ worker。</p>
        </div>
        <div class="setting-item">
          <span class="muted-label">队列名称</span>
          <strong>{{ health?.settings.taskQueueName || '-' }}</strong>
          <p>Redis 模式下采集、同步、上架任务会投递到该队列。</p>
        </div>
        <div class="setting-item">
          <span class="muted-label">采集批次</span>
          <strong>每批 {{ health?.settings.crawlerBatchSize || '-' }} 个</strong>
          <p>批次之间暂停 {{ health?.settings.crawlerBatchPauseSeconds ?? '-' }} 秒。</p>
        </div>
        <div class="setting-item">
          <span class="muted-label">草稿图片清理</span>
          <strong>{{ health?.settings.productImageDraftRetentionDays || '-' }} 天</strong>
          <p>系统会自动清理超过该天数的 data/product-image-drafts 文件，并删除空目录。</p>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-head,
.status-band,
.section-panel {
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 8px;
}

.page-head h1 {
  margin: 2px 0 0;
  font-size: 22px;
}

.eyebrow,
.muted-label {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 8px;
}

.status-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-main strong {
  display: block;
  margin-top: 3px;
  font-size: 20px;
}

.version-text {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 13px;
}

.status-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  font-size: 24px;
}

.status-icon.ok {
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
}

.status-icon.warn {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.section-panel {
  padding: 18px 20px;
  border-radius: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-weight: 700;
}

.check-grid,
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.check-item,
.setting-item {
  min-height: 98px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 14px;
  background: var(--page-bg);
}

.check-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
}

.check-item strong,
.setting-item strong {
  display: block;
  font-size: 15px;
}

.check-item p,
.setting-item p {
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.check-icon {
  margin-top: 2px;
  font-size: 20px;
}

.check-icon.ok {
  color: var(--el-color-success);
}

.check-icon.error {
  color: var(--el-color-danger);
}
</style>
