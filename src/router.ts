import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppShell from './components/crawler/AppShell.vue'
import CrawlSourceManager from './components/crawler/CrawlSourceManager.vue'
import CrawlTaskManager from './components/crawler/CrawlTaskManager.vue'
import DashboardView from './components/crawler/DashboardView.vue'
import ListingTaskView from './components/crawler/ListingTaskView.vue'
import ManualCrawlView from './components/crawler/ManualCrawlView.vue'
import MySecretProfile from './components/crawler/MySecretProfile.vue'
import ProductWorkflowView from './components/crawler/ProductWorkflowView.vue'
import ProductResultTable from './components/crawler/ProductResultTable.vue'
import RoleManagementView from './components/crawler/RoleManagementView.vue'
import ScheduledCrawlView from './components/crawler/ScheduledCrawlView.vue'
import StoreManagerView from './components/crawler/StoreManagerView.vue'
import UserManagement from './components/crawler/UserManagement.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: DashboardView, meta: { title: '采集概览' } },
      { path: 'secrets', name: 'secrets', component: MySecretProfile, meta: { title: '我的密钥配置' } },
      { path: 'sources', name: 'sources', component: CrawlSourceManager, meta: { title: '采集源' } },
      { path: 'tasks', name: 'tasks', component: CrawlTaskManager, meta: { title: '采集任务' } },
      { path: 'products', name: 'products', component: ProductResultTable, meta: { title: '商品结果' } },
      { path: 'users', name: 'users', component: UserManagement, meta: { title: '用户管理' } },
      { path: 'ltJobs/wjJobs', name: 'manual-crawl', component: ManualCrawlView, meta: { title: '手动采集' } },
      { path: 'ltJobs/upGoodsJob', name: 'listing-jobs', component: ListingTaskView, meta: { title: '上架任务' } },
      { path: 'ltJobs/wjProductJob', name: 'scheduled-crawl', component: ScheduledCrawlView, meta: { title: '定时采集' } },
      { path: 'ltShop/wjMerchantGoods', name: 'pending-products', component: ProductWorkflowView, props: { status: 'pending', title: '待审核商品', eyebrow: 'Rakuten Shop' }, meta: { title: '待审核商品' } },
      { path: 'ltShop/wjMerchantGoodsTrue', name: 'approved-products', component: ProductWorkflowView, props: { status: 'approved', title: '已审核商品', eyebrow: 'Rakuten Shop' }, meta: { title: '已审核商品' } },
      { path: 'ltShop/wjMerchantGoodsError', name: 'error-products', component: ProductWorkflowView, props: { status: 'error', title: '异常商品', eyebrow: 'Rakuten Shop' }, meta: { title: '异常商品' } },
      { path: 'ltShop/GoodsUp', name: 'listed-products', component: ProductWorkflowView, props: { status: 'listed', title: '上架商品', eyebrow: 'Rakuten Shop' }, meta: { title: '上架商品' } },
      { path: 'ltHj/wjMerchant', name: 'store-manager', component: StoreManagerView, meta: { title: '店铺信息' } },
      { path: 'system/user', name: 'system-users', component: UserManagement, meta: { title: '用户管理' } },
      { path: 'system/role', name: 'system-roles', component: RoleManagementView, meta: { title: '角色管理' } },
      { path: 'user/profile', name: 'profile', component: MySecretProfile, meta: { title: '个人中心' } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
