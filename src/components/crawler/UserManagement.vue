<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, Connection, CopyDocument, Delete, EditPen, Lock, Plus, Refresh, Shop, User } from '@element-plus/icons-vue'

import { useCollectorApi } from '../../composables/useCollectorApi'
import { useServerPagination } from '../../composables/useServerPagination'
import type { AuthSession, AvailabilityStatus, StoreAccount, StorePayload, UserAccount } from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import { confirmStoreDeletion } from '../../utils/confirmStoreDeletion'
import { PAGINATION_PREFERENCE_KEYS } from '../../utils/paginationPreferenceKeys'
import CopyableTableText from './CopyableTableText.vue'

const props = defineProps<{
  session: AuthSession | null
}>()

const api = useCollectorApi()
const loading = shallowRef(false)
const saving = shallowRef(false)
const users = shallowRef<UserAccount[]>([])
const createDialogOpen = shallowRef(false)
const editDialogOpen = shallowRef(false)
const editingUser = shallowRef<UserAccount | null>(null)
const {
  currentPage,
  pageSize,
  pageSizes,
  paginationLayout,
  total,
  resetPage,
  setPageResult,
} = useServerPagination(PAGINATION_PREFERENCE_KEYS.users)
const {
  currentPage: storeCurrentPage,
  pageSize: storePageSize,
  pageSizes: storePageSizes,
  paginationLayout: storePaginationLayout,
  total: storeTotal,
  resetPage: resetStorePage,
  setPageResult: setStorePageResult,
} = useServerPagination(PAGINATION_PREFERENCE_KEYS.userManagedStores)

const createForm = reactive({
  username: '',
  displayName: '',
  password: '',
})

const GENERATED_PASSWORD_LENGTH = 14
const PASSWORD_CHARACTER_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%&*+-_',
] as const
const PASSWORD_CHARACTERS = PASSWORD_CHARACTER_GROUPS.join('')

const canManageUsers = computed(() => props.session?.role === 'superadmin')

const editForm = reactive({
  displayName: '',
  enabled: true,
})

const storeDialogOpen = shallowRef(false)
const storeFormDialogOpen = shallowRef(false)
const storeLoading = shallowRef(false)
const storeSaving = shallowRef(false)
const storeVerifying = shallowRef(false)
const storeVerifyingId = shallowRef<number | null>(null)
const managedStoreUser = shallowRef<UserAccount | null>(null)
const userStores = shallowRef<StoreAccount[]>([])
const storeEditingId = shallowRef<number | null>(null)
const storeForm = reactive<StorePayload>({
  ownerUsername: '',
  aliasName: '',
  platform: 'rakuten',
  enabled: true,
  description: '',
  rakutenServiceSecret: '',
  rakutenLicenseKey: '',
})
const managedStoreTitle = computed(() => {
  const user = managedStoreUser.value
  return user ? `${user.displayName || user.username}（${user.username}）` : ''
})

onMounted(() => {
  if (canManageUsers.value) {
    void loadUsers()
  }
})

async function loadUsers() {
  loading.value = true
  try {
    const result = await api.listUsersPage({ page: currentPage.value, pageSize: pageSize.value })
    users.value = result.items
    setPageResult(result)
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
    await api.createUser({
      username: createForm.username.trim(),
      displayName: createForm.displayName.trim(),
      password: createForm.password,
    })
    await loadUsers()
    createForm.username = ''
    createForm.displayName = ''
    createForm.password = ''
    createDialogOpen.value = false
    ElMessage.success('用户已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建用户失败'))
  } finally {
    saving.value = false
  }
}

function openCreateDialog() {
  createForm.username = ''
  createForm.displayName = ''
  createForm.password = ''
  createDialogOpen.value = true
}

function generateCreatePassword() {
  const passwordCharacters = PASSWORD_CHARACTER_GROUPS.map((characters) => (
    characters[secureRandomIndex(characters.length)]
  ))

  while (passwordCharacters.length < GENERATED_PASSWORD_LENGTH) {
    passwordCharacters.push(PASSWORD_CHARACTERS[secureRandomIndex(PASSWORD_CHARACTERS.length)])
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1)
    const currentCharacter = passwordCharacters[index]
    passwordCharacters[index] = passwordCharacters[swapIndex]
    passwordCharacters[swapIndex] = currentCharacter
  }

  createForm.password = passwordCharacters.join('')
  ElMessage.success('已生成随机密码')
}

function secureRandomIndex(maxExclusive: number) {
  const randomValues = new Uint32Array(1)
  const maxUnbiasedValue = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  let value = 0

  do {
    window.crypto.getRandomValues(randomValues)
    value = randomValues[0]
  } while (value >= maxUnbiasedValue)

  return value % maxExclusive
}

async function updateEnabled(row: UserAccount, enabled: boolean) {
  try {
    await api.updateUser(row.username, { enabled })
    await loadUsers()
    ElMessage.success(enabled ? '用户已启用' : '用户已停用')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新用户状态失败'))
    await loadUsers()
  }
}

function openEditDialog(row: UserAccount) {
  editingUser.value = row
  editForm.displayName = row.displayName || row.username
  editForm.enabled = row.enabled
  editDialogOpen.value = true
}

async function saveUserSettings() {
  if (!editingUser.value) {
    return
  }
  saving.value = true
  try {
    await api.updateUser(editingUser.value.username, {
      displayName: editForm.displayName.trim(),
      enabled: editForm.enabled,
    })
    await loadUsers()
    editDialogOpen.value = false
    ElMessage.success('用户设置已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存用户失败'))
  } finally {
    saving.value = false
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
    await api.resetPassword(row.username, value.value)
    ElMessage.success('密码已重置')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(toApiErrorMessage(error, '重置密码失败'))
    }
  }
}

async function removeUser(row: UserAccount) {
  if (row.role === 'superadmin') {
    ElMessage.warning('不能删除超级管理员')
    return
  }
  const confirmationText = `删除用户 ${row.username}`
  try {
    const result = await ElMessageBox.prompt(
      `此操作将永久删除用户「${row.displayName || row.username}」及其店铺、商品、采集记录、任务记录、订单数据、配置和商品图片，删除后无法恢复。\n\n请输入：${confirmationText}`,
      '彻底删除用户',
      {
        type: 'error',
        confirmButtonText: '永久删除',
        cancelButtonText: '取消',
        inputPlaceholder: confirmationText,
        inputValidator: (value) => (
          value === confirmationText || `请输入完整确认文字：${confirmationText}`
        ),
        dangerouslyUseHTMLString: false,
        distinguishCancelAndClose: true,
      },
    )
    const deleted = await api.deleteUser(row.username, result.value)
    await loadUsers()
    ElMessage.success(`用户已删除，同时清理 ${deleted.deletedProductCount} 个商品及其图片`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(toApiErrorMessage(error, '删除用户失败'))
    }
  }
}

function handlePageSizeChange() {
  resetPage()
  void loadUsers()
}

function openStoreDialog(row: UserAccount) {
  if (row.role === 'superadmin') {
    return
  }
  managedStoreUser.value = row
  storeDialogOpen.value = true
  resetStorePage()
  void loadUserStores()
}

async function loadUserStores() {
  if (!managedStoreUser.value) {
    return
  }
  storeLoading.value = true
  try {
    const result = await api.listStoresPage({
      page: storeCurrentPage.value,
      pageSize: storePageSize.value,
      ownerUsername: managedStoreUser.value.username,
    })
    userStores.value = result.items
    setStorePageResult(result)
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '加载用户店铺失败'))
  } finally {
    storeLoading.value = false
  }
}

function resetStoreForm() {
  storeEditingId.value = null
  storeForm.ownerUsername = managedStoreUser.value?.username || ''
  storeForm.aliasName = ''
  storeForm.platform = 'rakuten'
  storeForm.enabled = true
  storeForm.description = ''
  storeForm.rakutenServiceSecret = ''
  storeForm.rakutenLicenseKey = ''
}

function openStoreCreateDialog() {
  if (!managedStoreUser.value) {
    return
  }
  resetStoreForm()
  storeFormDialogOpen.value = true
}

function openStoreEditDialog(row: StoreAccount) {
  storeEditingId.value = row.id
  storeForm.ownerUsername = row.ownerUsername
  storeForm.aliasName = row.aliasName
  storeForm.platform = row.platform
  storeForm.enabled = row.enabled
  storeForm.description = row.description
  storeForm.rakutenServiceSecret = ''
  storeForm.rakutenLicenseKey = ''
  storeFormDialogOpen.value = true
}

async function saveStore() {
  if (!managedStoreUser.value) {
    return
  }
  const ownerUsername = managedStoreUser.value.username
  if (!storeEditingId.value && (!storeForm.rakutenServiceSecret?.trim() || !storeForm.rakutenLicenseKey?.trim())) {
    ElMessage.warning('新增店铺时必须填写乐天 Secret 和乐天 Key')
    return
  }
  storeSaving.value = true
  try {
    await api.saveStore({ ...storeForm, ownerUsername }, storeEditingId.value ?? undefined)
    await loadUserStores()
    storeFormDialogOpen.value = false
    ElMessage.success('店铺已保存')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '保存店铺失败'))
  } finally {
    storeSaving.value = false
  }
}

async function checkStoreKeys() {
  if (!managedStoreUser.value) {
    return
  }
  storeVerifying.value = true
  try {
    const result = await api.verifyStores(managedStoreUser.value.username)
    await loadUserStores()
    if (result.summary.error > 0) {
      ElMessage.warning(`密钥检测完成，异常店铺 ${result.summary.error} 个`)
    } else {
      ElMessage.success('密钥检测完成，全部店铺可用')
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '密钥检测失败'))
  } finally {
    storeVerifying.value = false
  }
}

async function checkSingleStoreKeys(row: StoreAccount) {
  if (!managedStoreUser.value) {
    return
  }
  storeVerifyingId.value = row.id
  try {
    const result = await api.verifyStore(row.id, managedStoreUser.value.username)
    userStores.value = userStores.value.map((store) => (
      store.id === result.id
        ? {
            ...result,
            rakutenServiceSecret: result.rakutenServiceSecret || store.rakutenServiceSecret,
            rakutenLicenseKey: result.rakutenLicenseKey || store.rakutenLicenseKey,
            recentYearOrderCount: store.recentYearOrderCount,
          }
        : store
    ))
    if (result.lastError) {
      ElMessage.warning(`店铺「${result.aliasName || result.storeName || result.storeCode}」密钥检测异常`)
    } else {
      ElMessage.success(`店铺「${result.aliasName || result.storeName || result.storeCode}」密钥检测完成`)
    }
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '店铺密钥检测失败'))
  } finally {
    storeVerifyingId.value = null
  }
}

async function removeStore(row: StoreAccount) {
  if (!managedStoreUser.value) {
    return
  }
  try {
    await confirmStoreDeletion({
      storeName: row.storeName || row.aliasName || row.storeCode,
      ownerLabel: managedStoreTitle.value,
    })
    await api.deleteStore(row.id, managedStoreUser.value.username)
    await loadUserStores()
    ElMessage.success('店铺已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(toApiErrorMessage(error, '删除店铺失败'))
    }
  }
}

function handleStorePageSizeChange() {
  resetStorePage()
  void loadUserStores()
}

function availabilityLabel(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, string> = {
    available: '可用',
    error: '异常',
    unchecked: '未检测',
  }
  return labels[status] ?? '未检测'
}

function availabilityTagType(status: AvailabilityStatus) {
  const tagTypes: Record<AvailabilityStatus, 'success' | 'danger' | 'info'> = {
    available: 'success',
    error: 'danger',
    unchecked: 'info',
  }
  return tagTypes[status] ?? 'info'
}

function timeText(value?: string | null) {
  return value || '-'
}

async function copySecret(value: string, label: string) {
  if (!value) {
    ElMessage.warning(`${label}为空`)
    return
  }
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
    } else {
      const input = document.createElement('textarea')
      input.value = value
      input.setAttribute('readonly', 'true')
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      document.body.appendChild(input)
      input.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(input)
      if (!copied) {
        throw new Error('copy failed')
      }
    }
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.error(`${label}复制失败`)
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
      <div class="head-actions">
        <el-button
          :icon="Refresh"
          :loading="loading"
          :disabled="!canManageUsers"
          @click="loadUsers"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          :disabled="!canManageUsers"
          @click="openCreateDialog"
        >
          新增用户
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="!canManageUsers"
      type="warning"
      :closable="false"
      show-icon
      title="当前账号没有用户管理权限。"
    />

    <section v-if="canManageUsers" class="work-panel">
      <el-table v-loading="loading" :data="users" empty-text="暂无用户" height="max(520px, calc(100vh - 230px))">
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column prop="displayName" label="显示名称" min-width="160" />
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
        <el-table-column class-name="table-action-column" label="操作" width="152" fixed="right">
          <template #default="{ row }">
            <el-button :disabled="row.role === 'superadmin'" :icon="Shop" link type="primary" @click="openStoreDialog(row)">
              店铺
            </el-button>
            <el-button :disabled="row.role === 'superadmin'" :icon="EditPen" link type="primary" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button :icon="CircleCheck" link type="primary" @click="resetPassword(row)">
              重置密码
            </el-button>
            <el-button :disabled="row.role === 'superadmin'" :icon="Delete" link type="danger" @click="removeUser(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :layout="paginationLayout"
          @current-change="loadUsers"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="createDialogOpen" title="新增用户" width="620px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="用户名">
          <el-input v-model="createForm.username" :prefix-icon="User" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="createForm.displayName" placeholder="请输入显示名称" />
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input
            v-model="createForm.password"
            :prefix-icon="Lock"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="请输入至少 6 位初始密码"
          >
            <template #append>
              <el-button :icon="Refresh" @click="generateCreatePassword">
                随机生成
              </el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createUser">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogOpen" title="用户设置" width="560px">
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="显示名称">
          <el-input v-model="editForm.displayName" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="editForm.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUserSettings">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="storeDialogOpen"
      :title="`用户店铺管理 - ${managedStoreTitle}`"
      width="1180px"
      destroy-on-close
    >
      <div class="store-dialog-stack">
        <div class="store-dialog-head">
          <div class="head-actions">
            <el-button :icon="Connection" :loading="storeVerifying" @click="checkStoreKeys">
              密钥检测
            </el-button>
            <el-button type="primary" :icon="Plus" @click="openStoreCreateDialog">
              新增店铺
            </el-button>
          </div>
        </div>

        <el-table v-loading="storeLoading" :data="userStores" empty-text="暂无店铺" height="460">
          <el-table-column label="店铺编号" min-width="140">
            <template #default="{ row }">
              <CopyableTableText :value="row.storeCode" />
            </template>
          </el-table-column>
          <el-table-column label="店铺名称" min-width="170">
            <template #default="{ row }">
              <CopyableTableText :value="row.storeName" />
            </template>
          </el-table-column>
          <el-table-column label="店铺别称" min-width="150">
            <template #default="{ row }">
              <CopyableTableText :value="row.aliasName" />
            </template>
          </el-table-column>
          <el-table-column label="添加时间" min-width="170">
            <template #default="{ row }">
              {{ timeText(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="可用性状态" width="120">
            <template #default="{ row }">
              <CopyableTableText :value="row.lastError || ''" :display="availabilityLabel(row.availabilityStatus)" :always="Boolean(row.lastError)">
                <el-tag :type="availabilityTagType(row.availabilityStatus)">
                  {{ availabilityLabel(row.availabilityStatus) }}
                </el-tag>
              </CopyableTableText>
            </template>
          </el-table-column>
          <el-table-column label="启用状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'">
                {{ row.enabled ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="乐天 Service Secret" min-width="250">
            <template #default="{ row }">
              <div class="secret-cell">
                <span>{{ row.rakutenServiceSecret || '-' }}</span>
                <el-button
                  :icon="CopyDocument"
                  link
                  type="primary"
                  title="复制 Service Secret"
                  @click="copySecret(row.rakutenServiceSecret, 'Service Secret')"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="乐天 License Key" min-width="250">
            <template #default="{ row }">
              <div class="secret-cell">
                <span>{{ row.rakutenLicenseKey || '-' }}</span>
                <el-button
                  :icon="CopyDocument"
                  link
                  type="primary"
                  title="复制 License Key"
                  @click="copySecret(row.rakutenLicenseKey, 'License Key')"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column class-name="table-action-column" label="操作" width="132" fixed="right">
            <template #default="{ row }">
              <el-button :icon="EditPen" link type="primary" @click="openStoreEditDialog(row)">
                编辑
              </el-button>
              <el-button :icon="Delete" link type="danger" @click="removeStore(row)">
                删除
              </el-button>
              <el-button
                :icon="Connection"
                :loading="storeVerifyingId === row.id"
                link
                type="primary"
                @click="checkSingleStoreKeys(row)"
              >
                密钥检测
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-row">
          <el-pagination
            v-model:current-page="storeCurrentPage"
            v-model:page-size="storePageSize"
            :page-sizes="storePageSizes"
            :total="storeTotal"
            :layout="storePaginationLayout"
            @current-change="loadUserStores"
            @size-change="handleStorePageSizeChange"
          />
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="storeFormDialogOpen"
      :title="storeEditingId ? '编辑店铺信息' : '新增店铺信息'"
      width="760px"
      append-to-body
      destroy-on-close
    >
      <div class="dialog-form">
        <el-input v-model="storeForm.aliasName" placeholder="店铺别称" />
        <el-switch v-model="storeForm.enabled" active-text="启用" inactive-text="停用" />
        <el-input v-model="storeForm.rakutenServiceSecret" type="password" show-password placeholder="乐天 Secret，留空则不修改" />
        <el-input v-model="storeForm.rakutenLicenseKey" type="password" show-password placeholder="乐天 Key，留空则不修改" />
        <el-input v-model="storeForm.description" class="full-row" type="textarea" :rows="3" placeholder="店铺介绍" />
      </div>
      <template #footer>
        <el-button @click="storeFormDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="storeSaving" @click="saveStore">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.page-head,
.store-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
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
  font-weight: 800;
}

.page-head h1 {
  font-size: 26px;
}

.work-panel {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.store-dialog-stack {
  display: grid;
  gap: 14px;
}

.secret-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-main);
}

.secret-cell span {
  min-width: 0;
  flex: 1;
  line-height: 1.45;
  overflow-wrap: anywhere;
  user-select: text;
}

.dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-row {
  width: 100%;
}

.full-row {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .page-head,
  .store-dialog-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .head-actions {
    justify-content: flex-start;
  }

  .dialog-form {
    grid-template-columns: 1fr;
  }

}
</style>
