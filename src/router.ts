import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppShell from './components/crawler/AppShell.vue'
import CrawlSourceManager from './components/crawler/CrawlSourceManager.vue'
import CrawlTaskManager from './components/crawler/CrawlTaskManager.vue'
import DashboardView from './components/crawler/DashboardView.vue'
import MySecretProfile from './components/crawler/MySecretProfile.vue'
import ProductResultTable from './components/crawler/ProductResultTable.vue'
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
