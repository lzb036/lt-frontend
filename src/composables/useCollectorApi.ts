import type {
  AuthSession,
  CrawlSource,
  CrawlSourcePayload,
  CrawlTask,
  CreateTaskPayload,
  ListingTask,
  ListingTaskPayload,
  ProductItem,
  ReviewStatus,
  RoleDefinition,
  RolePayload,
  ScheduledCrawl,
  ScheduledCrawlPayload,
  SecretProfile,
  SecretProfilePayload,
  StoreAccount,
  StorePayload,
  UserAccount,
} from '../types/crawler'
import { apiClient } from '../utils/api'

export function useCollectorApi() {
  async function listUsers() {
    const response = await apiClient.get<{ users: UserAccount[] }>('/users')
    return response.data.users
  }

  async function createUser(payload: { username: string; password: string; displayName: string }) {
    const response = await apiClient.post<{ user: UserAccount; users: UserAccount[] }>('/users', payload)
    return response.data
  }

  async function updateUser(username: string, payload: { displayName?: string; enabled?: boolean }) {
    const response = await apiClient.put<{ user: UserAccount; users: UserAccount[] }>(`/users/${encodeURIComponent(username)}`, payload)
    return response.data
  }

  async function resetPassword(username: string, password: string) {
    const response = await apiClient.put<{ user: UserAccount; users: UserAccount[] }>(
      `/users/${encodeURIComponent(username)}/password`,
      { password },
    )
    return response.data
  }

  async function getSecretProfile() {
    const response = await apiClient.get<{ profile: SecretProfile }>('/profile/secrets')
    return response.data.profile
  }

  async function updateSecretProfile(payload: SecretProfilePayload) {
    const response = await apiClient.put<{ profile: SecretProfile }>('/profile/secrets', payload)
    return response.data.profile
  }

  async function verifySecretProfile() {
    const response = await apiClient.post<{ profile: SecretProfile }>('/profile/secrets/verify')
    return response.data.profile
  }

  async function listSources() {
    const response = await apiClient.get<{ sources: CrawlSource[] }>('/crawler/sources')
    return response.data.sources
  }

  async function saveSource(payload: CrawlSourcePayload, id?: number) {
    const request = id
      ? apiClient.put<{ source: CrawlSource; sources: CrawlSource[] }>(`/crawler/sources/${id}`, payload)
      : apiClient.post<{ source: CrawlSource; sources: CrawlSource[] }>('/crawler/sources', payload)
    const response = await request
    return response.data
  }

  async function deleteSource(id: number) {
    const response = await apiClient.delete<{ sources: CrawlSource[] }>(`/crawler/sources/${id}`)
    return response.data.sources
  }

  async function listTasks() {
    const response = await apiClient.get<{ tasks: CrawlTask[] }>('/crawler/tasks')
    return response.data.tasks
  }

  async function createTask(payload: CreateTaskPayload) {
    const response = await apiClient.post<{ task: CrawlTask; tasks: CrawlTask[] }>('/crawler/tasks', payload)
    return response.data
  }

  async function restartTask(taskId: string) {
    const response = await apiClient.post<{ task: CrawlTask; tasks: CrawlTask[] }>(`/crawler/tasks/${taskId}/restart`)
    return response.data
  }

  async function listProducts(params: { status?: ReviewStatus | ''; keyword?: string }) {
    const response = await apiClient.get<{ products: ProductItem[] }>('/crawler/products', { params })
    return response.data.products
  }

  async function updateProductStatus(payload: { productIds: number[]; status: ReviewStatus; message?: string }) {
    const response = await apiClient.put<{ products: ProductItem[] }>('/crawler/products/status', payload)
    return response.data.products
  }

  async function deleteProducts(productIds: number[]) {
    const response = await apiClient.delete<{ products: ProductItem[] }>('/crawler/products', { data: { productIds } })
    return response.data.products
  }

  async function listStores() {
    const response = await apiClient.get<{ stores: StoreAccount[] }>('/crawler/stores')
    return response.data.stores
  }

  async function saveStore(payload: StorePayload, id?: number) {
    const request = id
      ? apiClient.put<{ store: StoreAccount; stores: StoreAccount[] }>(`/crawler/stores/${id}`, payload)
      : apiClient.post<{ store: StoreAccount; stores: StoreAccount[] }>('/crawler/stores', payload)
    const response = await request
    return response.data
  }

  async function deleteStore(id: number) {
    const response = await apiClient.delete<{ stores: StoreAccount[] }>(`/crawler/stores/${id}`)
    return response.data.stores
  }

  async function syncStore(id: number) {
    const response = await apiClient.post<{ store: StoreAccount; stores: StoreAccount[] }>(`/crawler/stores/${id}/sync`)
    return response.data
  }

  async function listSchedules() {
    const response = await apiClient.get<{ schedules: ScheduledCrawl[] }>('/crawler/schedules')
    return response.data.schedules
  }

  async function saveSchedule(payload: ScheduledCrawlPayload, id?: number) {
    const request = id
      ? apiClient.put<{ schedule: ScheduledCrawl; schedules: ScheduledCrawl[] }>(`/crawler/schedules/${id}`, payload)
      : apiClient.post<{ schedule: ScheduledCrawl; schedules: ScheduledCrawl[] }>('/crawler/schedules', payload)
    const response = await request
    return response.data
  }

  async function deleteSchedule(id: number) {
    const response = await apiClient.delete<{ schedules: ScheduledCrawl[] }>(`/crawler/schedules/${id}`)
    return response.data.schedules
  }

  async function runSchedule(id: number) {
    const response = await apiClient.post<{ schedule: ScheduledCrawl; schedules: ScheduledCrawl[] }>(`/crawler/schedules/${id}/run`)
    return response.data
  }

  async function listListingTasks() {
    const response = await apiClient.get<{ listingTasks: ListingTask[] }>('/crawler/listing-tasks')
    return response.data.listingTasks
  }

  async function createListingTask(payload: ListingTaskPayload) {
    const response = await apiClient.post<{ listingTask: ListingTask; listingTasks: ListingTask[] }>('/crawler/listing-tasks', payload)
    return response.data
  }

  async function retryListingTask(taskId: string) {
    const response = await apiClient.post<{ listingTask: ListingTask; listingTasks: ListingTask[] }>(`/crawler/listing-tasks/${taskId}/retry`)
    return response.data
  }

  async function listRoles() {
    const response = await apiClient.get<{ roles: RoleDefinition[] }>('/crawler/roles')
    return response.data.roles
  }

  async function saveRole(payload: RolePayload, id?: number) {
    const request = id
      ? apiClient.put<{ role: RoleDefinition; roles: RoleDefinition[] }>(`/crawler/roles/${id}`, payload)
      : apiClient.post<{ role: RoleDefinition; roles: RoleDefinition[] }>('/crawler/roles', payload)
    const response = await request
    return response.data
  }

  async function deleteRole(id: number) {
    const response = await apiClient.delete<{ roles: RoleDefinition[] }>(`/crawler/roles/${id}`)
    return response.data.roles
  }

  function isSuperadmin(session: AuthSession | null | undefined) {
    return session?.role === 'superadmin'
  }

  return {
    listUsers,
    createUser,
    updateUser,
    resetPassword,
    getSecretProfile,
    updateSecretProfile,
    verifySecretProfile,
    listSources,
    saveSource,
    deleteSource,
    listTasks,
    createTask,
    restartTask,
    listProducts,
    updateProductStatus,
    deleteProducts,
    listStores,
    saveStore,
    deleteStore,
    syncStore,
    listSchedules,
    saveSchedule,
    deleteSchedule,
    runSchedule,
    listListingTasks,
    createListingTask,
    retryListingTask,
    listRoles,
    saveRole,
    deleteRole,
    isSuperadmin,
  }
}
