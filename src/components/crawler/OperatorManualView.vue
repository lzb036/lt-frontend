<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import {
  CircleCheck,
  Key,
  Link,
  Location,
  Search,
  Warning,
} from '@element-plus/icons-vue'

import {
  operatorManualSections,
  searchOperatorManualSections,
  type OperatorManualImpact,
} from '../../utils/operatorManual'

const keyword = shallowRef('')
const activeSectionId = shallowRef(operatorManualSections[0]?.id || '')
const contentRef = useTemplateRef<HTMLElement>('contentRef')

const filteredSections = computed(() => searchOperatorManualSections(keyword.value))
const activeSection = computed(() => (
  filteredSections.value.find((section) => section.id === activeSectionId.value)
  || filteredSections.value[0]
  || null
))

const impactLabels: Record<OperatorManualImpact, string> = {
  local: '仅修改系统数据',
  rakuten: '会修改乐天店铺',
  mixed: '部分操作会修改乐天',
}

function selectSection(sectionId: string) {
  activeSectionId.value = sectionId
  void nextTick(() => {
    contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

function clearSearch() {
  keyword.value = ''
  activeSectionId.value = operatorManualSections[0]?.id || ''
}
</script>

<template>
  <section class="operator-manual">
    <header class="operator-manual-header">
      <div>
        <p class="operator-manual-eyebrow">Operator Guide</p>
        <h1>使用手册</h1>
        <p class="operator-manual-intro">
          面向普通商品操作员，覆盖采集、审核、上架、店铺商品、商品替换和任务处理。
        </p>
      </div>
      <div class="operator-manual-search">
        <el-input
          v-model="keyword"
          :prefix-icon="Search"
          clearable
          placeholder="搜索功能、操作或错误，例如：品类、替换、上架失败"
        />
        <span>{{ filteredSections.length }} 个相关章节</span>
      </div>
    </header>

    <div class="operator-manual-workspace">
      <nav class="operator-manual-nav" aria-label="使用手册章节">
        <button
          v-for="section in filteredSections"
          :key="section.id"
          type="button"
          class="operator-manual-nav-item"
          :class="{ 'is-active': activeSection?.id === section.id }"
          @click="selectSection(section.id)"
        >
          <strong>{{ section.title }}</strong>
          <span>{{ section.summary }}</span>
        </button>
        <div v-if="filteredSections.length < 1" class="operator-manual-empty">
          <Search />
          <strong>没有找到相关内容</strong>
          <span>尝试搜索“采集”“品类”“替换”或“失败”。</span>
          <el-button type="primary" plain @click="clearSearch">清除搜索</el-button>
        </div>
      </nav>

      <article v-if="activeSection" ref="contentRef" class="operator-manual-content">
        <div class="operator-manual-title-row">
          <div>
            <span class="operator-manual-index">
              {{ String(operatorManualSections.findIndex((item) => item.id === activeSection.id) + 1).padStart(2, '0') }}
            </span>
            <h2>{{ activeSection.title }}</h2>
            <p>{{ activeSection.summary }}</p>
          </div>
          <el-tag
            :type="activeSection.impact === 'rakuten' ? 'danger' : activeSection.impact === 'mixed' ? 'warning' : 'success'"
            effect="plain"
          >
            {{ impactLabels[activeSection.impact] }}
          </el-tag>
        </div>

        <dl class="operator-manual-meta">
          <div>
            <dt><el-icon><Location /></el-icon>进入路径</dt>
            <dd>{{ activeSection.route }}</dd>
          </div>
          <div>
            <dt><el-icon><Key /></el-icon>所需权限</dt>
            <dd>{{ activeSection.permission }}</dd>
          </div>
        </dl>

        <section class="operator-manual-section">
          <h3><el-icon><Link /></el-icon>操作步骤</h3>
          <ol class="operator-manual-steps">
            <li v-for="(step, index) in activeSection.steps" :key="step">
              <span>{{ index + 1 }}</span>
              <p>{{ step }}</p>
            </li>
          </ol>
        </section>

        <section class="operator-manual-section">
          <h3><el-icon><CircleCheck /></el-icon>完成前检查</h3>
          <ul class="operator-manual-checks">
            <li v-for="check in activeSection.checks" :key="check">{{ check }}</li>
          </ul>
        </section>

        <section v-if="activeSection.warnings.length" class="operator-manual-section operator-manual-warning">
          <h3><el-icon><Warning /></el-icon>注意事项</h3>
          <ul>
            <li v-for="warning in activeSection.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </section>
      </article>
    </div>
  </section>
</template>

<style scoped>
.operator-manual {
  display: grid;
  min-height: calc(100vh - 56px);
  grid-template-rows: auto minmax(0, 1fr);
  color: var(--text-main);
}

.operator-manual-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  align-items: end;
  gap: 28px;
  border-bottom: 1px solid var(--panel-border);
  padding: 4px 0 20px;
}

.operator-manual-eyebrow {
  margin: 0 0 7px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.operator-manual-header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
}

.operator-manual-intro {
  max-width: 720px;
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.operator-manual-search {
  display: grid;
  gap: 7px;
}

.operator-manual-search span {
  color: var(--text-faint);
  font-size: 12px;
  text-align: right;
}

.operator-manual-workspace {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
}

.operator-manual-nav {
  min-height: 0;
  border-right: 1px solid var(--panel-border);
  padding: 18px 16px 40px 0;
  overflow-y: auto;
}

.operator-manual-nav-item {
  display: grid;
  width: 100%;
  gap: 4px;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  padding: 11px 12px;
  text-align: left;
}

.operator-manual-nav-item:hover {
  background: var(--panel-muted);
}

.operator-manual-nav-item.is-active {
  border-left-color: var(--accent);
  background: var(--accent-soft);
}

.operator-manual-nav-item strong {
  font-size: 14px;
  line-height: 1.4;
}

.operator-manual-nav-item span {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.operator-manual-empty {
  display: grid;
  justify-items: start;
  gap: 10px;
  color: var(--text-muted);
  padding: 28px 18px;
}

.operator-manual-empty svg {
  width: 28px;
}

.operator-manual-empty span {
  font-size: 13px;
  line-height: 1.6;
}

.operator-manual-content {
  min-width: 0;
  max-width: 980px;
  padding: 28px 0 64px 36px;
  overflow-y: auto;
}

.operator-manual-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 22px;
}

.operator-manual-index {
  display: block;
  margin-bottom: 5px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}

.operator-manual-title-row h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}

.operator-manual-title-row p {
  margin: 7px 0 0;
  color: var(--text-muted);
  line-height: 1.7;
}

.operator-manual-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border-block: 1px solid var(--panel-border);
}

.operator-manual-meta div {
  min-width: 0;
  padding: 16px 18px 16px 0;
}

.operator-manual-meta div + div {
  border-left: 1px solid var(--panel-border);
  padding-left: 18px;
}

.operator-manual-meta dt,
.operator-manual-section h3 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 900;
}

.operator-manual-meta dd {
  margin: 7px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.operator-manual-section {
  padding-top: 28px;
}

.operator-manual-section h3 {
  font-size: 16px;
}

.operator-manual-steps,
.operator-manual-checks,
.operator-manual-warning ul {
  margin: 16px 0 0;
}

.operator-manual-steps {
  display: grid;
  gap: 0;
  list-style: none;
  padding: 0;
}

.operator-manual-steps li {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 13px;
  border-top: 1px solid var(--panel-border);
  padding: 14px 0;
}

.operator-manual-steps li > span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}

.operator-manual-steps p {
  margin: 2px 0 0;
  color: var(--text-main);
  font-size: 14px;
  line-height: 1.75;
}

.operator-manual-checks,
.operator-manual-warning ul {
  display: grid;
  gap: 9px;
  padding-left: 20px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.operator-manual-warning {
  margin-top: 28px;
  border-left: 3px solid var(--warning);
  background: var(--warning-soft);
  padding: 18px 20px;
}

.operator-manual-warning h3 {
  color: var(--warning);
}

.operator-manual-warning ul {
  margin-top: 10px;
}

@media (max-width: 900px) {
  .operator-manual {
    min-height: auto;
  }

  .operator-manual-header,
  .operator-manual-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .operator-manual-search span {
    text-align: left;
  }

  .operator-manual-nav {
    display: flex;
    gap: 6px;
    border-right: 0;
    border-bottom: 1px solid var(--panel-border);
    padding: 14px 0;
    overflow-x: auto;
  }

  .operator-manual-nav-item {
    min-width: 210px;
    border-left: 0;
    border-bottom: 3px solid transparent;
  }

  .operator-manual-nav-item.is-active {
    border-bottom-color: var(--accent);
  }

  .operator-manual-content {
    padding: 24px 0 52px;
    overflow: visible;
  }

  .operator-manual-meta {
    grid-template-columns: minmax(0, 1fr);
  }

  .operator-manual-meta div + div {
    border-top: 1px solid var(--panel-border);
    border-left: 0;
    padding-left: 0;
  }
}
</style>
