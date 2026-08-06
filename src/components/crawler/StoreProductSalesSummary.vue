<script setup lang="ts">
import { computed } from 'vue'

import type { StoreProductSalesSummary } from '../../types/crawler'

const props = defineProps<{
  summary: StoreProductSalesSummary | null
  periodLabel: string
}>()

const periodRange = computed(() => {
  if (!props.summary) {
    return ''
  }
  return `${props.summary.periodFrom} 至 ${props.summary.periodTo}`
})

function countText(value: number | null | undefined) {
  return value == null ? '-' : value.toLocaleString('zh-CN')
}
</script>

<template>
  <section v-if="summary" class="sales-summary" aria-label="店铺销量汇总">
    <div class="sales-summary-heading">
      <strong>{{ periodLabel }}汇总</strong>
      <span>{{ periodRange }}</span>
    </div>
    <div v-if="summary.syncCompleted" class="sales-summary-grid">
      <div class="sales-summary-item">
        <span>全部有效销量</span>
        <strong>{{ countText(summary.totalEffectiveUnits) }}</strong>
        <small>件</small>
      </div>
      <div class="sales-summary-item">
        <span>当前商品销量</span>
        <strong>{{ countText(summary.currentProductEffectiveUnits) }}</strong>
        <small>件</small>
      </div>
      <div class="sales-summary-item sales-summary-item-warning">
        <span>列表外销量</span>
        <strong>{{ countText(summary.outsideCurrentProductEffectiveUnits) }}</strong>
        <small>件</small>
      </div>
      <div class="sales-summary-item">
        <span>当前商品</span>
        <strong>{{ countText(summary.currentProductCount) }}</strong>
        <small>个</small>
      </div>
      <div class="sales-summary-item sales-summary-item-warning">
        <span>列表外商品</span>
        <strong>{{ countText(summary.outsideCurrentProductCount) }}</strong>
        <small>个</small>
      </div>
    </div>
    <div v-else class="sales-summary-unavailable">
      该店铺尚未完成首次订单同步
    </div>
  </section>
</template>

<style scoped>
.sales-summary {
  display: flex;
  min-height: 70px;
  margin: 0 0 14px;
  border-top: 1px solid var(--panel-border);
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel-muted);
}

.sales-summary-heading {
  display: flex;
  flex: 0 0 180px;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 12px 16px;
}

.sales-summary-heading strong {
  color: var(--text-main);
  font-size: 14px;
  font-weight: 700;
}

.sales-summary-heading span {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.sales-summary-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  min-width: 0;
}

.sales-summary-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  padding: 15px 18px;
  border-left: 1px solid var(--panel-border);
}

.sales-summary-item span {
  color: var(--text-secondary);
  font-size: 13px;
}

.sales-summary-item strong {
  color: var(--text-main);
  font-size: 22px;
  font-weight: 750;
}

.sales-summary-item small {
  color: var(--text-muted);
  font-size: 12px;
}

.sales-summary-item-warning strong {
  color: var(--el-color-warning-dark-2);
}

.sales-summary-unavailable {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  padding: 12px 18px;
  border-left: 1px solid var(--panel-border);
  color: var(--text-secondary);
  font-size: 14px;
}

@media (max-width: 1080px) {
  .sales-summary {
    display: block;
  }

  .sales-summary-heading {
    min-height: 58px;
  }

  .sales-summary-grid {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }

  .sales-summary-item {
    border-top: 1px solid var(--panel-border);
  }
}

@media (max-width: 640px) {
  .sales-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
