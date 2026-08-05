<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'
</script>

<template>
  <aside class="theme-preview" aria-label="主题效果预览">
    <div class="preview-window">
      <div class="preview-sidebar">
        <div class="preview-brand">
          <span class="preview-brand-mark" />
          <span class="preview-brand-line" />
        </div>
        <span class="preview-nav-item is-active">
          <i />
          <b />
        </span>
        <span class="preview-nav-item">
          <i />
          <b />
        </span>
        <span class="preview-nav-item">
          <i />
          <b />
        </span>
      </div>

      <div class="preview-content">
        <div class="preview-toolbar">
          <el-input placeholder="搜索商品" :prefix-icon="Search" />
          <el-button type="primary">新建任务</el-button>
        </div>

        <div class="preview-metrics">
          <div class="preview-metric">
            <span>今日采集</span>
            <strong>1,284</strong>
          </div>
          <div class="preview-metric">
            <span>待处理</span>
            <strong>36</strong>
          </div>
        </div>

        <div class="preview-table">
          <div class="preview-table-row preview-table-head">
            <span>商品</span>
            <span>状态</span>
            <span>更新时间</span>
          </div>
          <div class="preview-table-row">
            <span>家居收纳套装</span>
            <span><el-tag type="success" size="small">已完成</el-tag></span>
            <span>10:24</span>
          </div>
          <div class="preview-table-row">
            <span>厨房清洁用品</span>
            <span><el-tag type="warning" size="small">处理中</el-tag></span>
            <span>09:48</span>
          </div>
          <div class="preview-table-row">
            <span>户外便携桌椅</span>
            <span><el-tag size="small">待审核</el-tag></span>
            <span>08:16</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.theme-preview {
  position: sticky;
  top: 0;
  min-width: 0;
}

.preview-window {
  display: grid;
  min-height: 420px;
  grid-template-columns: 112px minmax(0, 1fr);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background-color: var(--page-bg);
  background-image: var(--surface-page-image);
  background-size: var(--surface-page-size);
  box-shadow: var(--shadow-md);
  backdrop-filter: var(--surface-backdrop-filter);
  -webkit-backdrop-filter: var(--surface-backdrop-filter);
  overflow: hidden;
}

.preview-sidebar {
  display: grid;
  align-content: start;
  gap: 7px;
  border-right: 1px solid var(--sidebar-border);
  background: var(--sidebar-bg);
  padding: 15px 10px;
}

.preview-brand {
  display: flex;
  height: 34px;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}

.preview-brand-mark {
  width: 26px;
  height: 26px;
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-sm);
  background: var(--accent-soft);
}

.preview-brand-line,
.preview-nav-item b {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: currentColor;
  opacity: 0.72;
}

.preview-brand-line {
  width: 48px;
  color: var(--text-main);
}

.preview-nav-item {
  display: flex;
  height: 34px;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  color: var(--sidebar-text);
  padding: 0 8px;
}

.preview-nav-item i {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-radius: var(--radius-xs);
}

.preview-nav-item b {
  width: 48px;
}

.preview-nav-item.is-active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
}

.preview-content {
  display: grid;
  align-content: start;
  gap: var(--layout-gap);
  min-width: 0;
  padding: var(--panel-padding);
}

.preview-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--control-gap);
}

.preview-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--control-gap);
}

.preview-metric {
  display: grid;
  gap: 4px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: var(--metric-padding);
  backdrop-filter: var(--surface-backdrop-filter);
  -webkit-backdrop-filter: var(--surface-backdrop-filter);
}

.preview-metric span {
  color: var(--text-faint);
  font-size: 11px;
}

.preview-metric strong {
  color: var(--text-main);
  font-size: 20px;
}

.preview-table {
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  backdrop-filter: var(--surface-backdrop-filter);
  -webkit-backdrop-filter: var(--surface-backdrop-filter);
  overflow: hidden;
}

.preview-table-row {
  display: grid;
  min-height: calc(var(--control-height) + 14px);
  grid-template-columns: minmax(110px, 1.3fr) minmax(86px, 0.8fr) 70px;
  align-items: center;
  border-bottom: 1px solid var(--panel-border);
  color: var(--text-soft);
  font-size: 12px;
  padding: 0 12px;
}

.preview-table-row:last-child {
  border-bottom: 0;
}

.preview-table-head {
  min-height: calc(var(--control-height) + 6px);
  background: var(--table-header-bg);
  color: var(--text-soft);
  font-weight: 800;
}

:global([data-theme-table="striped"]) .preview-table-row:nth-child(odd):not(.preview-table-head) {
  background: color-mix(in srgb, var(--panel-muted), var(--panel-bg) 28%);
}

:global([data-theme-table="grid"]) .preview-table-row > span + span {
  height: 100%;
  border-left: 1px solid var(--panel-border);
  padding-left: 12px;
}

@media (max-width: 760px) {
  .preview-window {
    min-height: 360px;
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .preview-brand-line,
  .preview-nav-item b {
    display: none;
  }

  .preview-brand,
  .preview-nav-item {
    justify-content: center;
  }

  .preview-content {
    padding: 14px;
  }

  .preview-toolbar {
    grid-template-columns: 1fr;
  }

  .preview-table-row {
    grid-template-columns: minmax(100px, 1fr) 78px;
  }

  .preview-table-row > span:last-child {
    display: none;
  }
}
</style>
