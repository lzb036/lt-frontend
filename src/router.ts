import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppShell from './components/crawler/AppShell.vue'

const AiTitleSettingsView = () => import('./components/crawler/AiTitleSettingsView.vue')
const CollectionShopView = () => import('./components/crawler/CollectionShopView.vue')
const CrawlTaskManager = () => import('./components/crawler/CrawlTaskManager.vue')
const DeletedProductImageCleanupView = () => import('./components/crawler/DeletedProductImageCleanupView.vue')
const ListingTaskView = () => import('./components/crawler/ListingTaskView.vue')
const ManualCrawlView = () => import('./components/crawler/ManualCrawlView.vue')
const OperatorManualView = () => import('./components/crawler/OperatorManualView.vue')
const SalesOrderSyncHistoryView = () => import('./components/crawler/SalesOrderSyncHistoryView.vue')
const ProductWorkflowView = () => import('./components/crawler/ProductWorkflowView.vue')
const ProductResultTable = () => import('./components/crawler/ProductResultTable.vue')
const ScheduledCrawlView = () => import('./components/crawler/ScheduledCrawlView.vue')
const SensitiveWordManagementView = () => import('./components/crawler/SensitiveWordManagementView.vue')
const StoreManagerView = () => import('./components/crawler/StoreManagerView.vue')
const SyncTaskView = () => import('./components/crawler/SyncTaskView.vue')
const ThemeSettingsView = () => import('./components/crawler/ThemeSettingsView.vue')
const TimeManagementView = () => import('./components/crawler/TimeManagementView.vue')
const UserManagement = () => import('./components/crawler/UserManagement.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: '/ltHj/wjMerchant' },
      { path: 'secrets', redirect: '/ltHj/wjMerchant' },
      { path: 'sources', redirect: '/ltHj/wjMerchant' },
      { path: 'tasks', name: 'tasks', component: CrawlTaskManager, meta: { title: '采集任务', permission: 'crawler.manage' } },
      { path: 'products', name: 'products', component: ProductResultTable, meta: { title: '商品结果', permission: 'products.manage' } },
      { path: 'users', name: 'users', component: UserManagement, meta: { title: '用户管理', superadminOnly: true } },
      { path: 'ltJobs/wjJobs', name: 'manual-crawl', component: ManualCrawlView, meta: { title: '手动采集', permission: 'crawler.manage' } },
      { path: 'ltJobs/wjProductJob', name: 'scheduled-crawl', component: ScheduledCrawlView, meta: { title: '定时采集', permission: 'crawler.manage' } },
      { path: 'ltJobs/upGoodsJob', name: 'listing-jobs', component: ListingTaskView, meta: { title: '上架任务', permission: 'products.manage' } },
      { path: 'ltJobs/syncJob', name: 'sync-jobs', component: SyncTaskView, meta: { title: '同步任务', anyPermission: ['products.manage', 'stores.manage'] } },
      { path: 'ltJobs/orderSyncHistory', name: 'order-sync-history', component: SalesOrderSyncHistoryView, meta: { title: '订单获取记录', superadminOnly: true } },
      { path: 'ltShop/wjMerchantGoods', name: 'pending-products', component: ProductWorkflowView, props: { status: 'pending', title: '待审核商品', eyebrow: 'Rakuten Shop' }, meta: { title: '待审核商品', permission: 'products.manage' } },
      { path: 'ltShop/wjMerchantGoodsTrue', name: 'approved-products', component: ProductWorkflowView, props: { status: 'approved', title: '已审核商品', eyebrow: 'Rakuten Shop' }, meta: { title: '已审核商品', permission: 'products.manage' } },
      { path: 'ltShop/wjListedGoods', name: 'listed-master-products', component: ProductWorkflowView, props: { status: 'listed_master', title: '已上架商品', eyebrow: 'Rakuten Shop' }, meta: { title: '已上架商品', permission: 'products.manage' } },
      { path: 'ltShop/wjMerchantGoodsError', name: 'error-products', component: ProductWorkflowView, props: { status: 'error', title: '异常商品', eyebrow: 'Rakuten Shop' }, meta: { title: '异常商品', permission: 'products.manage' } },
      { path: 'ltShop/GoodsUp', name: 'listed-products', component: ProductWorkflowView, props: { status: 'listed', title: '店铺商品', eyebrow: 'Rakuten Shop' }, meta: { title: '店铺商品', permission: 'stores.manage' } },
      { path: 'ltHj/wjMerchant', name: 'store-manager', component: StoreManagerView, meta: { title: '店铺信息', permission: 'stores.manage' } },
      { path: 'ltHj/collectionShops', name: 'collection-shops', component: CollectionShopView, meta: { title: '采集店铺', permission: 'crawler.manage' } },
      { path: 'system/user', name: 'system-users', component: UserManagement, meta: { title: '用户管理', superadminOnly: true } },
      { path: 'ai/title-optimization', name: 'ai-title-optimization', component: AiTitleSettingsView, meta: { title: '标题优化', permission: 'ai.manage' } },
      { path: 'system/theme', name: 'system-theme', component: ThemeSettingsView, meta: { title: '主题管理' } },
      { path: 'system/time', name: 'system-time', component: TimeManagementView, meta: { title: '资源管理', superadminOnly: true } },
      { path: 'system/deleted-product-images', name: 'system-deleted-product-images', component: DeletedProductImageCleanupView, meta: { title: '待清理图片', superadminOnly: true } },
      { path: 'system/order-sync', name: 'system-order-sync', redirect: '/system/time', meta: { title: '订单同步设置', superadminOnly: true } },
      { path: 'system/sensitive-words', name: 'system-sensitive-words', component: SensitiveWordManagementView, meta: { title: '敏感词管理', superadminOnly: true } },
      { path: 'help/operator-manual', name: 'operator-manual', component: OperatorManualView, meta: { title: '使用手册' } },
      { path: 'user/profile', redirect: '/ltHj/wjMerchant' },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/ltHj/wjMerchant',
  },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
