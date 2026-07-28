<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AuthSession,
  CollectionGenreConfig,
  CollectionGenreExplicitPolicy,
  CollectionGenreNode,
  CollectionGenrePolicy,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import CollectionGenrePolicySelect from './CollectionGenrePolicySelect.vue'

defineProps<{
  session: AuthSession | null
}>()

interface LazyTreeNode {
  level: number
  data?: CollectionGenreNode
}

type TreeResolve = (nodes: CollectionGenreNode[]) => void

const api = useCollectorApi()
const loadingConfig = shallowRef(false)
const savingConfig = shallowRef(false)
const searching = shallowRef(false)
const searchKeyword = shallowRef('')
const searchResults = shallowRef<CollectionGenreNode[]>([])
const savingPaths = shallowRef<Set<string>>(new Set())
const treeRevision = shallowRef(0)
const persistedConfig = shallowRef<Pick<CollectionGenreConfig, 'defaultPolicy' | 'unknownGenrePolicy'>>({
  defaultPolicy: 'allow',
  unknownGenrePolicy: 'allow',
})

const config = reactive<CollectionGenreConfig>({
  defaultPolicy: 'allow',
  unknownGenrePolicy: 'allow',
  ruleCount: 0,
})

const policyOptions: Array<{ label: string; value: CollectionGenrePolicy }> = [
  { label: '允许采集', value: 'allow' },
  { label: '禁止采集', value: 'deny' },
]

const treeProps = {
  label: 'labelZh',
  isLeaf: 'leaf',
}

onMounted(() => {
  void loadConfig()
})

async function loadConfig() {
  loadingConfig.value = true
  try {
    const loadedConfig = await api.getCollectionGenreConfig()
    Object.assign(config, loadedConfig)
    persistedConfig.value = {
      defaultPolicy: loadedConfig.defaultPolicy,
      unknownGenrePolicy: loadedConfig.unknownGenrePolicy,
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载采集品类设置失败'))
  } finally {
    loadingConfig.value = false
  }
}

async function saveConfig(
  field: 'defaultPolicy' | 'unknownGenrePolicy',
  value: CollectionGenrePolicy,
) {
  config[field] = value
  savingConfig.value = true
  try {
    const savedConfig = await api.updateCollectionGenreConfig({
      defaultPolicy: config.defaultPolicy,
      unknownGenrePolicy: config.unknownGenrePolicy,
    })
    Object.assign(config, savedConfig)
    persistedConfig.value = {
      defaultPolicy: savedConfig.defaultPolicy,
      unknownGenrePolicy: savedConfig.unknownGenrePolicy,
    }
    refreshGenreViews()
    ElMessage.success(field === 'defaultPolicy' ? '默认品类策略已保存' : '未识别品类策略已保存')
  } catch (error) {
    Object.assign(config, persistedConfig.value)
    ElMessage.error(toApiErrorMessage(error, '保存采集品类设置失败'))
  } finally {
    savingConfig.value = false
  }
}

async function loadTreeNode(node: LazyTreeNode, resolve: TreeResolve) {
  try {
    const parentPath = node.level === 0 ? '' : node.data?.genrePath || ''
    resolve(await api.listCollectionGenreChildren(parentPath))
  } catch (error) {
    resolve([])
    ElMessage.error(toApiErrorMessage(error, '加载品类层级失败'))
  }
}

async function searchGenres() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    searchResults.value = []
    return
  }
  searching.value = true
  try {
    searchResults.value = await api.searchCollectionGenres(keyword, 100)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '搜索采集品类失败'))
  } finally {
    searching.value = false
  }
}

function resetSearch() {
  searchKeyword.value = ''
  searchResults.value = []
}

function setPathSaving(path: string, saving: boolean) {
  const next = new Set(savingPaths.value)
  if (saving) {
    next.add(path)
  } else {
    next.delete(path)
  }
  savingPaths.value = next
}

function isPathSaving(path: string) {
  return savingPaths.value.has(path)
}

async function changeGenrePolicy(
  genre: CollectionGenreNode,
  policy: CollectionGenreExplicitPolicy,
) {
  setPathSaving(genre.genrePath, true)
  try {
    if (policy === 'inherit') {
      if (genre.ruleId) {
        await api.deleteCollectionGenreRule(genre.ruleId)
      }
    } else {
      await api.saveCollectionGenreRule({
        genrePath: genre.genrePath,
        genreId: genre.genreId,
        policy,
      })
    }
    await loadConfig()
    refreshGenreViews()
    ElMessage.success(policy === 'inherit' ? '已恢复继承上级规则' : '采集品类规则已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存采集品类规则失败'))
  } finally {
    setPathSaving(genre.genrePath, false)
  }
}

function refreshGenreViews() {
  treeRevision.value += 1
  if (searchKeyword.value.trim()) {
    void searchGenres()
  }
}

function genreDisplayPath(genre: CollectionGenreNode) {
  return genre.genrePathZh || genre.genrePath
}

function inheritedRuleText(genre: CollectionGenreNode) {
  if (genre.policySourceType === 'default') {
    return '用户默认策略'
  }
  if (genre.policySourceType === 'unknown') {
    return '未识别品类策略'
  }
  return genre.inheritedFromPathZh || genre.inheritedFromPath || '当前品类'
}
</script>

<template>
  <section class="genre-settings-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">COLLECTION POLICY</p>
        <h1>采集品类</h1>
      </div>
    </header>

    <div v-loading="loadingConfig" class="settings-band">
      <div class="setting-field">
        <span class="setting-label">默认品类策略</span>
        <el-segmented
          v-model="config.defaultPolicy"
          :options="policyOptions"
          :disabled="savingConfig"
          @change="saveConfig('defaultPolicy', $event)"
        />
      </div>
      <div class="setting-field">
        <span class="setting-label">未识别品类</span>
        <el-segmented
          v-model="config.unknownGenrePolicy"
          :options="policyOptions"
          :disabled="savingConfig"
          @change="saveConfig('unknownGenrePolicy', $event)"
        />
      </div>
      <div class="settings-actions">
        <span>已设置 {{ config.ruleCount }} 条规则</span>
        <span v-if="savingConfig">保存中...</span>
      </div>
    </div>

    <div class="genre-workspace">
      <div class="genre-toolbar">
        <el-input
          v-model="searchKeyword"
          clearable
          :prefix-icon="Search"
          placeholder="输入品类编号、中文名称或日文名称"
          @clear="resetSearch"
          @keydown.enter="searchGenres"
        />
        <el-button type="primary" :icon="Search" :loading="searching" @click="searchGenres">
          搜索
        </el-button>
        <el-button @click="resetSearch">返回品类树</el-button>
      </div>

      <el-table
        v-if="searchKeyword.trim()"
        v-loading="searching"
        :data="searchResults"
        row-key="genrePath"
        height="100%"
        empty-text="没有匹配的品类"
      >
        <el-table-column label="品类" min-width="420">
          <template #default="{ row }">
            <div class="genre-name-cell">
              <strong>{{ genreDisplayPath(row) }}</strong>
              <span>{{ row.genrePath }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="品类编号" width="120">
          <template #default="{ row }">{{ row.genreId || '-' }}</template>
        </el-table-column>
        <el-table-column label="规则来源" min-width="220">
          <template #default="{ row }">{{ inheritedRuleText(row) }}</template>
        </el-table-column>
        <el-table-column label="采集规则" width="260" fixed="right">
          <template #default="{ row }">
            <CollectionGenrePolicySelect
              :model-value="row.explicitPolicy"
              :effective-policy="row.effectivePolicy"
              :loading="isPathSaving(row.genrePath)"
              @change="changeGenrePolicy(row, $event)"
            />
          </template>
        </el-table-column>
      </el-table>

      <el-tree
        v-else
        :key="treeRevision"
        class="genre-tree"
        node-key="genrePath"
        lazy
        :load="loadTreeNode"
        :props="treeProps"
      >
        <template #default="{ data }">
          <div class="genre-tree-row">
            <div class="genre-name-cell">
              <strong>{{ data.labelZh || data.label }}</strong>
              <span>
                {{ data.label }}
                <template v-if="data.genreId"> · {{ data.genreId }}</template>
              </span>
            </div>
            <span class="rule-source">{{ inheritedRuleText(data) }}</span>
            <CollectionGenrePolicySelect
              :model-value="data.explicitPolicy"
              :effective-policy="data.effectivePolicy"
              :loading="isPathSaving(data.genrePath)"
              @click.stop
              @change="changeGenrePolicy(data, $event)"
            />
          </div>
        </template>
      </el-tree>
    </div>
  </section>
</template>

<style scoped>
.genre-settings-page {
  display: grid;
  min-height: 100%;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 26px;
}

.settings-band {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 28px;
  border-top: 1px solid var(--panel-border);
  border-bottom: 1px solid var(--panel-border);
  padding: 14px 0;
}

.setting-field {
  display: grid;
  gap: 8px;
}

.setting-label {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
}

.settings-actions {
  display: flex;
  margin-left: auto;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.genre-workspace {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.genre-toolbar {
  display: grid;
  grid-template-columns: minmax(280px, 620px) auto auto;
  gap: 10px;
}

.genre-tree {
  min-height: 0;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 8px 0;
  overflow: auto;
}

.genre-tree :deep(.el-tree-node__content) {
  min-height: 58px;
  height: auto;
  padding-right: 16px;
}

.genre-tree-row {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(260px, 1fr) minmax(180px, 300px) 250px;
  align-items: center;
  gap: 18px;
}

.genre-name-cell {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.genre-name-cell strong,
.genre-name-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.genre-name-cell strong {
  color: var(--text-main);
  font-size: 14px;
}

.genre-name-cell span,
.rule-source {
  color: var(--text-muted);
  font-size: 12px;
}

@media (max-width: 900px) {
  .settings-band,
  .settings-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .settings-actions {
    margin-left: 0;
  }

  .genre-toolbar {
    grid-template-columns: 1fr;
  }

  .genre-tree-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 8px 0;
  }
}
</style>
