<script setup lang="ts">
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { SwitchButton } from '@element-plus/icons-vue'

import type { AuthSession } from '../../types/crawler'

const props = defineProps<{
  session: AuthSession | null
}>()

const emit = defineEmits<{
  logout: []
}>()

const roleLabel = computed(() => {
  if (props.session?.role === 'superadmin') {
    return '超级管理员'
  }
  return '普通操作员'
})

const statusLabel = computed(() => (props.session?.enabled ? '正常' : '已停用'))
const permissionLabels = computed(() => {
  const permissions = props.session?.permissions
  if (!permissions) {
    return []
  }

  const labels: string[] = []
  if (permissions.manageOwnSecrets) labels.push('个人配置')
  if (permissions.manageCrawler) labels.push('商品采集')
  if (permissions.manageProducts) labels.push('商品管理')
  if (permissions.manageStores) labels.push('店铺管理')
  if (permissions.manageSettings) labels.push('系统设置')
  if (permissions.manageAi) labels.push('AI 功能')
  if (permissions.manageUsers) labels.push('用户管理')
  return labels
})

const formatDate = (value?: string | null) => {
  if (!value) {
    return '未记录'
  }
  return value.replace('T', ' ').replace('Z', '')
}

async function confirmLogout() {
  try {
    await ElMessageBox.confirm('确认退出当前账号？', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
    })
    emit('logout')
  } catch {
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Account Center</p>
        <h1>个人中心</h1>
      </div>
      <el-button
        type="danger"
        plain
        :icon="SwitchButton"
        @click="confirmLogout"
      >
        退出登录
      </el-button>
    </div>

    <section class="work-panel profile-panel">
      <div class="panel-head">
        <div>
          <h2>身份信息</h2>
          <p>以下信息来自当前登录会话。</p>
        </div>
        <el-tag :type="props.session?.enabled ? 'success' : 'danger'">
          {{ statusLabel }}
        </el-tag>
      </div>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="显示名称">
          {{ props.session?.displayName || '未设置' }}
        </el-descriptions-item>
        <el-descriptions-item label="用户名">
          {{ props.session?.username || '未记录' }}
        </el-descriptions-item>
        <el-descriptions-item label="身份">
          {{ roleLabel }}
        </el-descriptions-item>
        <el-descriptions-item label="账号状态">
          {{ statusLabel }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ formatDate(props.session?.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ formatDate(props.session?.updatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="可用权限" :span="2">
          <el-space v-if="permissionLabels.length" wrap>
            <el-tag
              v-for="permission in permissionLabels"
              :key="permission"
              effect="plain"
            >
              {{ permission }}
            </el-tag>
          </el-space>
          <span v-else>暂无权限信息</span>
        </el-descriptions-item>
      </el-descriptions>
    </section>
  </section>
</template>

<style scoped>
.profile-panel {
  max-width: 920px;
}
</style>
