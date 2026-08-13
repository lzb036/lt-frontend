<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  AlarmClock,
  Brush,
  Calendar,
  CircleCloseFilled,
  Clock,
  Collection,
  CollectionTag,
  Connection,
  DeleteFilled,
  DocumentChecked,
  EditPen,
  Expand,
  Files,
  Fold,
  Goods,
  GoodsFilled,
  MagicStick,
  Management,
  MapLocation,
  Memo,
  NoSmoking,
  OfficeBuilding,
  Picture,
  Pointer,
  Promotion,
  Reading,
  SetUp,
  Shop,
  SoldOut,
  SwitchButton,
  Tools,
  Upload,
  UserFilled,
} from '@element-plus/icons-vue'

import type { AuthSession } from '../../types/crawler'
import { getDefaultRoutePath, hasAnyPermission, hasPermission, isSuperadmin as isSuperadminSession } from '../../utils/permissions'
import AnnouncementCenterDialog from './AnnouncementCenterDialog.vue'

type MenuEntry = {
  path: string
  label: string
  icon: unknown
}

type MenuGroup = {
  key: string
  label: string
  icon: unknown
  children: MenuEntry[]
}

const props = defineProps<{
  session: AuthSession | null
}>()

const emit = defineEmits<{
  logout: []
}>()

const route = useRoute()
const router = useRouter()
const systemVersion = 'v1.0.0'

const isSuperadmin = computed(() => isSuperadminSession(props.session))
const defaultRoutePath = computed(() => getDefaultRoutePath(props.session))
const activePath = computed(() => {
  const path = route.path || defaultRoutePath.value
  return path === '/' ? defaultRoutePath.value : path
})
const sidebarCollapsed = ref(false)
const announcementDialogOpen = ref(false)
const sessionDisplayName = computed(() => props.session?.displayName || props.session?.username || '')

const menuGroups = computed(() => {
  const groups: Array<MenuEntry | MenuGroup> = []
  const collectionChildren: MenuEntry[] = []
  if (hasPermission(props.session, 'crawler.manage')) {
    collectionChildren.push(
      { path: '/ltJobs/wjJobs', label: '手动采集', icon: Pointer },
      { path: '/ltJobs/wjProductJob', label: '定时采集', icon: AlarmClock },
      { path: '/ltHj/collectionShops', label: '采集店铺', icon: MapLocation },
      { path: '/system/collection-genres', label: '采集品类', icon: CollectionTag },
    )
  }
  if (isSuperadmin.value) {
    collectionChildren.push(
      { path: '/system/sensitive-words', label: '敏感词管理', icon: NoSmoking },
    )
  }
  if (collectionChildren.length > 0) {
    groups.push({
      key: 'collection-management',
      label: '采集管理',
      icon: Collection,
      children: collectionChildren,
    })
  }
  const jobChildren: MenuEntry[] = []
  if (hasPermission(props.session, 'products.manage')) {
    jobChildren.push({ path: '/ltJobs/upGoodsJob', label: '上架任务', icon: Upload })
  }
  if (hasAnyPermission(props.session, ['products.manage', 'stores.manage'])) {
    jobChildren.push({ path: '/ltJobs/syncJob', label: '同步任务', icon: Connection })
  }
  if (hasPermission(props.session, 'ai.manage')) {
    jobChildren.push({ path: '/ltJobs/titleOptimizationJob', label: '标题优化任务', icon: MagicStick })
  }
  if (hasPermission(props.session, 'stores.manage')) {
    jobChildren.push({ path: '/ltJobs/imageCleanupJob', label: '图片清理任务', icon: DeleteFilled })
    jobChildren.push({ path: '/ltJobs/orderSyncHistory', label: '订单获取记录', icon: Files })
  }
  if (jobChildren.length > 0) {
    groups.push({
      key: 'jobs',
      label: '任务日志',
      icon: Memo,
      children: jobChildren,
    })
  }
  const productChildren: MenuEntry[] = []
  if (hasPermission(props.session, 'products.manage')) {
    productChildren.push(
      { path: '/ltShop/wjMerchantGoods', label: '手动采集待审核', icon: EditPen },
      { path: '/ltShop/wjMerchantGoodsScheduled', label: '定时采集待审核', icon: Clock },
      { path: '/ltShop/wjMerchantGoodsTrue', label: '已审核商品', icon: DocumentChecked },
      { path: '/ltShop/wjListedGoods', label: '已上架商品', icon: GoodsFilled },
    )
  }
  if (hasPermission(props.session, 'stores.manage')) {
    productChildren.push(
      { path: '/ltShop/GoodsUp', label: '店铺商品', icon: Shop },
    )
  }
  if (hasPermission(props.session, 'products.manage')) {
    productChildren.push(
      { path: '/ltShop/wjMerchantGoodsError', label: '异常商品', icon: CircleCloseFilled },
    )
  }
  if (productChildren.length > 0) {
    groups.push({
      key: 'rakuten-shop',
      label: '商品管理',
      icon: Goods,
      children: productChildren,
    })
  }
  const automationChildren: MenuEntry[] = []
  if (hasPermission(props.session, 'products.manage')) {
    automationChildren.push(
      { path: '/automation/auto-listing', label: '自动上架管理', icon: Promotion },
      { path: '/automation/auto-deletion', label: '自动删除管理', icon: SoldOut },
    )
  }
  automationChildren.push(
    { path: '/system/time', label: '其他定时管理', icon: Calendar },
    { path: '/system/deleted-product-images', label: '待清理图片', icon: Picture },
  )
  if (hasPermission(props.session, 'ai.manage')) {
    automationChildren.push(
      { path: '/ai/title-optimization', label: '标题优化配置', icon: SetUp },
    )
  }
  groups.push({
    key: 'automation-management',
    label: '自动化管理',
    icon: Management,
    children: automationChildren,
  })
  if (hasPermission(props.session, 'stores.manage')) {
    groups.push({
      path: '/ltHj/wjMerchant',
      label: '店铺管理',
      icon: OfficeBuilding,
    })
  }
  if (isSuperadmin.value) {
    groups.push({
      path: '/system/user',
      label: '用户管理',
      icon: UserFilled,
    })
    groups.push({
      path: '/system/maintenance',
      label: '系统维护管理',
      icon: Tools,
    })
  }
  groups.push({
    path: '/system/theme',
    label: '主题设置',
    icon: Brush,
  })
  return groups
})

const sidebarCollapseIcon = computed(() => (sidebarCollapsed.value ? Expand : Fold))

async function handleMenuSelect(path: string) {
  if (path !== activePath.value) {
    await router.push(path)
  }
}

function toggleSidebarCollapsed() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function openAnnouncementCenter() {
  announcementDialogOpen.value = true
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

function forwardLogout() {
  emit('logout')
}

function menuItemKey(item: MenuEntry | MenuGroup) {
  return 'path' in item ? item.path : item.key
}
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'app-shell-sidebar-collapsed': sidebarCollapsed }"
  >
    <aside
      class="shell-sidebar"
      :class="{ 'shell-sidebar-collapsed': sidebarCollapsed }"
    >
      <div class="shell-brand-block">
        <div class="shell-brand">
          <span class="brand-mark">
            <img src="/favicon.svg" alt="" />
          </span>
          <span class="brand-copy">
            <strong>商品采集系统</strong>
            <em>Product Collector</em>
          </span>
        </div>
        <div v-if="sessionDisplayName" class="shell-user-name">
          {{ sessionDisplayName }}
        </div>
      </div>

      <el-menu
        class="shell-menu"
        :collapse="sidebarCollapsed"
        :collapse-transition="false"
        :default-active="activePath"
        @select="handleMenuSelect"
      >
        <template v-for="item in menuGroups" :key="menuItemKey(item)">
          <el-menu-item
            v-if="'path' in item"
            :index="item.path"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
          <el-sub-menu v-else :index="item.key">
            <template #title>
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.path"
              :index="child.path"
            >
              <el-icon>
                <component :is="child.icon" />
              </el-icon>
              <span>{{ child.label }}</span>
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>

      <footer class="shell-sidebar-footer">
        <button
          type="button"
          class="sidebar-action-button"
          :aria-label="sidebarCollapsed ? '公告' : undefined"
          @click="openAnnouncementCenter"
        >
          <el-icon class="sidebar-action-icon">
            <Reading />
          </el-icon>
          <span class="sidebar-action-label">公告</span>
          <span class="sidebar-system-version">{{ systemVersion }}</span>
        </button>
        <button
          type="button"
          class="sidebar-action-button sidebar-logout-button"
          :aria-label="sidebarCollapsed ? '退出登录' : undefined"
          @click="confirmLogout"
        >
          <el-icon class="sidebar-action-icon">
            <SwitchButton />
          </el-icon>
          <span class="sidebar-action-label">退出登录</span>
        </button>
        <button
          type="button"
          class="sidebar-action-button sidebar-collapse-button"
          :aria-label="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleSidebarCollapsed"
        >
          <el-icon class="sidebar-action-icon">
            <component :is="sidebarCollapseIcon" />
          </el-icon>
          <span class="sidebar-action-label">{{ sidebarCollapsed ? '展开' : '收起' }}</span>
        </button>
      </footer>
    </aside>

    <div class="shell-main">
      <main class="shell-content">
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :session="session"
            @logout="forwardLogout"
          />
        </RouterView>
      </main>
    </div>

    <AnnouncementCenterDialog
      v-model="announcementDialogOpen"
      :session="session"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  height: 100vh;
  min-height: 0;
  grid-template-columns: 196px minmax(0, 1fr);
  background-color: var(--page-bg);
  background-image: var(--surface-page-image);
  background-size: var(--surface-page-size);
  background-attachment: fixed;
  overflow: hidden;
  transition: grid-template-columns var(--motion-normal) cubic-bezier(0.22, 1, 0.36, 1);
}

.app-shell-sidebar-collapsed {
  grid-template-columns: 72px minmax(0, 1fr);
}

.shell-sidebar {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--sidebar-border);
  background: var(--sidebar-bg);
  overflow: hidden;
  transition: width var(--motion-normal) cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-brand-block {
  flex: 0 0 auto;
  border-bottom: 1px solid var(--sidebar-border);
  overflow: hidden;
  padding: 12px 14px 10px;
}

.shell-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  overflow: hidden;
  transition: justify-content var(--motion-normal) ease;
}

.brand-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  flex: 0 0 auto;
}

.brand-mark img {
  display: block;
  width: 28px;
  height: 28px;
}

.brand-copy {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 1;
  max-width: none;
  visibility: visible;
  transform: translateX(0);
  transition:
    opacity var(--motion-fast) ease,
    max-width var(--motion-normal) ease,
    transform var(--motion-normal) ease;
}

.shell-brand strong {
  display: block;
  color: var(--sidebar-text);
  font-size: 16px;
  line-height: 1.2;
}

.shell-brand em {
  display: block;
  color: var(--text-faint);
  font-size: 12px;
  font-style: normal;
}

.shell-user-name {
  margin: 7px 0 0 46px;
  overflow: hidden;
  color: var(--sidebar-text);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.3;
  max-width: 118px;
  opacity: 0.88;
  text-overflow: ellipsis;
  transform: translateX(0);
  transition:
    opacity var(--motion-fast) ease,
    max-width var(--motion-normal) ease,
    margin var(--motion-normal) ease,
    transform var(--motion-normal) ease;
  white-space: nowrap;
}

.shell-sidebar-collapsed .shell-brand-block {
  padding: 12px 10px 10px;
}

.shell-sidebar-collapsed .shell-brand {
  justify-content: center;
}

.shell-sidebar-collapsed .brand-copy {
  opacity: 0;
  max-width: 0;
  transform: translateX(-6px);
}

.shell-sidebar-collapsed .shell-user-name {
  margin-left: 0;
  max-width: 0;
  opacity: 0;
  transform: translateX(-6px);
}

.shell-menu {
  flex: 1;
  min-height: 0;
  border-right: 0;
  background: transparent;
  padding: 12px 8px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.shell-menu::-webkit-scrollbar {
  width: 6px;
}

.shell-menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--sidebar-text), transparent 72%);
}

.shell-menu::-webkit-scrollbar-track {
  background: transparent;
}

.shell-sidebar-collapsed .shell-menu {
  width: auto;
  padding: 12px 8px;
}

.shell-menu :deep(.el-menu-item) {
  position: relative;
  height: var(--menu-item-height);
  margin: 2px 0;
  border-radius: var(--radius-sm);
  color: var(--sidebar-text);
  font-weight: 700;
  overflow: hidden;
  transition:
    background-color var(--motion-fast) ease,
    color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease,
    transform var(--motion-fast) cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-menu :deep(.el-menu-item .el-icon),
.shell-menu :deep(.el-sub-menu__title .el-icon) {
  flex: 0 0 auto;
}

.shell-menu :deep(.el-sub-menu__title) {
  position: relative;
  height: var(--menu-item-height);
  margin: 2px 0;
  border-radius: var(--radius-sm);
  color: var(--sidebar-text);
  font-weight: 800;
  overflow: hidden;
  transition:
    background-color var(--motion-fast) ease,
    color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease,
    transform var(--motion-fast) cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-menu :deep(.el-menu-item::before),
.shell-menu :deep(.el-sub-menu__title::before) {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--sidebar-active-text);
  content: "";
  opacity: 0;
  transform: scaleY(0.35);
  transform-origin: center;
  transition:
    opacity var(--motion-fast) ease,
    transform var(--motion-fast) cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-menu :deep(.el-sub-menu__title:hover),
.shell-menu :deep(.el-menu-item:hover) {
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-text);
  box-shadow: inset 0 0 0 1px var(--sidebar-border);
  transform: translateX(2px);
}

.shell-menu :deep(.el-sub-menu__title:hover::before),
.shell-menu :deep(.el-menu-item:hover::before),
.shell-menu :deep(.el-menu-item.is-active::before) {
  opacity: 1;
  transform: scaleY(1);
}

.shell-menu :deep(.el-menu-item .el-icon),
.shell-menu :deep(.el-sub-menu__title .el-icon) {
  transition:
    color var(--motion-fast) ease,
    transform var(--motion-fast) cubic-bezier(0.22, 1, 0.36, 1);
}

.shell-menu :deep(.el-menu-item:hover .el-icon),
.shell-menu :deep(.el-sub-menu__title:hover .el-icon) {
  transform: scale(1.1);
}

.shell-menu :deep(.el-sub-menu .el-menu-item) {
  height: var(--submenu-item-height);
  padding-left: 38px !important;
  font-size: 13px;
}

.shell-menu :deep(.el-menu-item.is-active) {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
}

.shell-sidebar-collapsed .shell-menu :deep(.el-menu-item),
.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu__title) {
  justify-content: center;
  padding: 0 !important;
}

.shell-sidebar-collapsed .shell-menu :deep(.el-menu-item span),
.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu__title span),
.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu__icon-arrow) {
  display: none;
}

.shell-sidebar-collapsed .shell-menu :deep(.el-sub-menu .el-menu-item) {
  padding: 0 !important;
}

.shell-sidebar-footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--sidebar-border);
  padding: 12px 8px 14px;
}

.sidebar-action-button {
  display: inline-flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  justify-content: flex-start;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text);
  cursor: pointer;
  font: inherit;
  padding: 0 10px;
  transition:
    border-color var(--motion-fast) ease,
    background var(--motion-fast) ease,
    color var(--motion-fast) ease;
}

.sidebar-action-button + .sidebar-action-button {
  margin-top: 6px;
}

.sidebar-action-button:hover,
.sidebar-action-button:focus-visible {
  border-color: var(--sidebar-border);
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-text);
  outline: none;
}

.sidebar-action-button.is-active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
}

.sidebar-logout-button {
  color: var(--danger);
}

.sidebar-logout-button:hover,
.sidebar-logout-button:focus-visible {
  border-color: color-mix(in srgb, var(--danger), transparent 58%);
  background: var(--danger-soft);
  color: var(--danger);
}

.sidebar-action-icon {
  flex: 0 0 auto;
  font-size: 18px;
}

.sidebar-action-label {
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  font-weight: 800;
  max-width: 90px;
  opacity: 1;
  text-overflow: ellipsis;
  transform: translateX(0);
  transition:
    opacity var(--motion-fast) ease,
    max-width var(--motion-normal) ease,
    transform var(--motion-normal) ease;
  white-space: nowrap;
}

.sidebar-system-version {
  margin-left: 6px;
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.9;
  white-space: nowrap;
}

.shell-sidebar-collapsed .shell-sidebar-footer {
  padding: 12px 8px 14px;
}

.shell-sidebar-collapsed .sidebar-action-button {
  justify-content: center;
  padding-inline: 0;
}

.shell-sidebar-collapsed .sidebar-action-label {
  opacity: 0;
  max-width: 0;
  transform: translateX(-6px);
}

.shell-sidebar-collapsed .sidebar-system-version {
  display: none;
}

.shell-main {
  display: flex;
  height: 100vh;
  min-height: 0;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
}

.shell-content {
  flex: 1;
  min-height: 0;
  padding: var(--page-padding-top) var(--page-padding-x) var(--page-padding-bottom);
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.shell-content > :deep(*) {
  width: 100%;
  max-width: var(--content-max-width);
  margin-inline: auto;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .app-shell-sidebar-collapsed {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .shell-sidebar {
    height: 100%;
  }

  .shell-brand-block {
    padding: 12px 10px 10px;
  }

  .shell-brand {
    justify-content: center;
  }

  .brand-copy,
  .shell-user-name {
    display: none;
  }

  .shell-menu {
    padding: 10px 8px;
  }

  .shell-menu :deep(.el-menu-item) {
    justify-content: center;
    padding: 0 !important;
  }

  .shell-menu :deep(.el-sub-menu__title) {
    justify-content: center;
    padding: 0 !important;
  }

  .shell-menu :deep(.el-sub-menu__icon-arrow),
  .shell-menu :deep(.el-menu-item span),
  .shell-menu :deep(.el-sub-menu__title span) {
    display: none;
  }

  .shell-menu :deep(.el-sub-menu .el-menu-item) {
    padding: 0 !important;
  }

  .shell-sidebar-footer {
    padding: 12px 8px 14px;
  }

  .sidebar-action-button {
    justify-content: center;
    padding-inline: 0;
  }

  .sidebar-action-label,
  .sidebar-system-version {
    display: none;
  }

  .shell-content {
    padding: 16px;
  }
}
</style>
