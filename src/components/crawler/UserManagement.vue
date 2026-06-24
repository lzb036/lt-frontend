<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Lock, Plus, Refresh, User } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type { AuthSession, UserAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const users = shallowRef<UserAccount[]>([])

const createForm = reactive({
  username: '',
  displayName: '',
  password: '',
})

const canManageUsers = computed(() => props.session?.role === 'superadmin')

onMounted(() => {
  if (canManageUsers.value) {
    void loadUsers()
  }
})

async function loadUsers() {
  loading.value = true
  try {
    users.value = await api.listUsers()
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载用户失败'))
  } finally {
    loading.value = false
  }
}

async function createUser() {
  if (!createForm.username.trim() || createForm.password.length < 6) {
    ElMessage.warning('请填写用户名和至少 6 位密码')
    return
  }
  saving.value = true
  try {
    const result = await api.createUser({
      username: createForm.username.trim(),
      displayName: createForm.displayName.trim(),
      password: createForm.password,
    })
    users.value = result.users
    createForm.username = ''
    createForm.displayName = ''
    createForm.password = ''
    ElMessage.success('用户已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建用户失败'))
  } finally {
    saving.value = false
  }
}

async function updateEnabled(row: UserAccount, enabled: boolean) {
  try {
    const result = await api.updateUser(row.username, { enabled })
    users.value = result.users
    ElMessage.success(enabled ? '用户已启用' : '用户已停用')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新用户状态失败'))
    await loadUsers()
  }
}

async function resetPassword(row: UserAccount) {
  try {
    const value = await ElMessageBox.prompt(`重置 ${row.displayName || row.username} 的密码`, '重置密码', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPlaceholder: '至少 6 位',
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码至少 6 位',
    })
    const result = await api.resetPassword(row.username, value.value)
    users.value = result.users
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重置密码失败'))
    }
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Users</p>
        <h1>用户管理</h1>
      </div>
      <el-button
        :icon="Refresh"
        :loading="loading"
        :disabled="!canManageUsers"
        @click="loadUsers"
      >
        刷新
      </el-button>
    </div>

    <el-alert
      v-if="!canManageUsers"
      type="warning"
      :closable="false"
      show-icon
      title="当前账号没有用户管理权限。"
    />

    <section v-else class="work-panel">
      <div class="panel-head">
        <div>
          <h2>创建运营用户</h2>
          <p>超级管理员只创建账号和初始密码，业务密钥由用户登录后自行填写。</p>
        </div>
        <el-tag type="info">不共享密钥</el-tag>
      </div>

      <div class="create-row">
        <el-input v-model="createForm.username" :prefix-icon="User" placeholder="用户名" />
        <el-input v-model="createForm.displayName" placeholder="显示名称" />
        <el-input v-model="createForm.password" :prefix-icon="Lock" type="password" show-password placeholder="初始密码" />
        <el-button type="primary" :icon="Plus" :loading="saving" @click="createUser">
          创建
        </el-button>
      </div>
    </section>

    <section v-if="canManageUsers" class="work-panel">
      <div class="panel-head">
        <div>
          <h2>账号列表</h2>
          <p>账号启停不影响各用户已保存的独立配置。</p>
        </div>
      </div>
      <el-table v-loading="loading" :data="users" empty-text="暂无用户" height="520">
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column prop="displayName" label="显示名称" min-width="160" />
        <el-table-column label="角色" width="130">
          <template #default="{ row }">
            <el-tag :type="row.role === 'superadmin' ? 'warning' : 'info'">
              {{ row.role === 'superadmin' ? '超级管理员' : '运营用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              :disabled="row.role === 'superadmin'"
              active-text="启用"
              inactive-text="停用"
              @change="updateEnabled(row, Boolean($event))"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="170" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button :icon="CircleCheck" link type="primary" @click="resetPassword(row)">
              重置密码
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
}

.page-head h1,
.panel-head h2 {
  margin: 0;
  color: var(--text-main);
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.panel-head h2 {
  font-size: 17px;
}

.panel-head p {
  margin: 5px 0 0;
  color: var(--text-soft);
  font-size: 13px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.create-row {
  display: grid;
  margin-top: 16px;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 12px;
}

@media (max-width: 980px) {
  .create-row {
    grid-template-columns: 1fr;
  }

  .page-head,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
