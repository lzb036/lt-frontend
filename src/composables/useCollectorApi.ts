import type {
  AuthSession,
  CrawlSource,
  CrawlSourcePayload,
  CrawlTask,
  CreateTaskPayload,
  DashboardSummary,
  ListingPreflightResult,
  ListingTask,
  ListingTaskPayload,
  PageParams,
  PageResult,
  ProductDetailEditPayload,
  ProductDetail,
  ProductItem,
  ReviewStatus,
  RoleDefinition,
  RolePayload,
  ScheduleImportResult,
  ScheduledCrawl,
  ScheduledCrawlPayload,
  SecretProfile,
  SecretProfilePayload,
  SourceType,
  StoreAccount,
  StorePayload,
  StoreVerifySummary,
  SyncTask,
  TimeSettings,
  TimeSettingsPayload,
  UserAccount,
} from '../types/crawler'
import { apiClient } from '../utils/api'

type ApiPageResponse<K extends string, T> = Record<K, T[]> & {
  total: number
  page: number
  pageSize: number
}

function toPageResult<K extends string, T>(data: ApiPageResponse<K, T>, key: K): PageResult<T> {
  return {
    items: data[key],
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  }
}

export function useCollectorApi() {
  async function getDashboardSummary() {
    const response = await apiClient.get<{ summary: DashboardSummary }>('/crawler/dashboard/summary')
    return response.data.summary
  }

  async function listUsers() {
    const response = await apiClient.get<{ users: UserAccount[] }>('/users')
    return response.data.users
  }

  async function listUsersPage(params: PageParams) {
    const response = await apiClient.get<ApiPageResponse<'users', UserAccount>>('/users', { params })
    return toPageResult(response.data, 'users')
  }

  async function createUser(payload: { username: string; password: string; displayName: string; permissions?: string[] }) {
    const response = await apiClient.post<{ user: UserAccount }>('/users', payload)
    return response.data
  }

  async function updateUser(username: string, payload: { displayName?: string; enabled?: boolean; permissions?: string[] }) {
    const response = await apiClient.put<{ user: UserAccount }>(`/users/${encodeURIComponent(username)}`, payload)
    return response.data
  }

  async function resetPassword(username: string, password: string) {
    const response = await apiClient.put<{ user: UserAccount }>(
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

  async function getTimeSettings() {
    const response = await apiClient.get<{ settings: TimeSettings }>('/crawler/settings/time')
    return response.data.settings
  }

  async function updateTimeSettings(payload: TimeSettingsPayload) {
    const response = await apiClient.put<{ settings: TimeSettings }>('/crawler/settings/time', payload)
    return response.data.settings
  }

  async function runScheduledTaskCleanup() {
    const response = await apiClient.post<{ settings: TimeSettings }>('/crawler/settings/time/scheduled-task-cleanup/run')
    return response.data.settings
  }

  async function runUnlistedProductCleanup() {
    const response = await apiClient.post<{
      settings: TimeSettings
      summary: {
        taskCount: number
        productCount: number
      }
    }>('/crawler/settings/time/unlisted-products/run')
    return response.data
  }

  async function listSources() {
    const response = await apiClient.get<{ sources: CrawlSource[] }>('/crawler/sources')
    return response.data.sources
  }

  async function listSourcesPage(params: PageParams) {
    const response = await apiClient.get<ApiPageResponse<'sources', CrawlSource>>('/crawler/sources', { params })
    return toPageResult(response.data, 'sources')
  }

  async function saveSource(payload: CrawlSourcePayload, id?: number) {
    const request = id
      ? apiClient.put<{ source: CrawlSource }>(`/crawler/sources/${id}`, payload)
      : apiClient.post<{ source: CrawlSource }>('/crawler/sources', payload)
    const response = await request
    return response.data
  }

  async function deleteSource(id: number) {
    await apiClient.delete<{ deleted: boolean }>(`/crawler/sources/${id}`)
  }

  async function listTasks() {
    const response = await apiClient.get<{ tasks: CrawlTask[] }>('/crawler/tasks')
    return response.data.tasks
  }

  async function listTasksPage(params: PageParams & {
    target?: string
    status?: string
    sourceType?: SourceType | ''
    mode?: string
    createdAtFrom?: string
    createdAtTo?: string
  }) {
    const response = await apiClient.get<ApiPageResponse<'tasks', CrawlTask>>('/crawler/tasks', { params })
    return toPageResult(response.data, 'tasks')
  }

  async function createTask(payload: CreateTaskPayload) {
    const response = await apiClient.post<{ task: CrawlTask }>('/crawler/tasks', payload)
    return response.data
  }

  async function restartTask(taskId: string) {
    const response = await apiClient.post<{ task: CrawlTask }>(`/crawler/tasks/${taskId}/restart`)
    return response.data
  }

  async function cancelTask(taskId: string) {
    const response = await apiClient.post<{ task: CrawlTask }>(`/crawler/tasks/${taskId}/cancel`)
    return response.data
  }

  async function deleteTasks(taskIds: string[]) {
    const response = await apiClient.delete<{
      deletedIds: string[]
      failedIds: string[]
      deletedCount: number
    }>('/crawler/tasks', { data: { taskIds } })
    return response.data
  }

  async function listProducts(params: {
    status?: ReviewStatus | ''
    keyword?: string
    storeId?: number | null
    listedStoreId?: number | string | null
    listingStatus?: 'listed' | 'unlisted' | ''
    listedAtFrom?: string
    listedAtTo?: string
    priceMin?: number | null
    priceMax?: number | null
    collectedAtFrom?: string
    collectedAtTo?: string
    page?: number
    pageSize?: number
  }) {
    const response = await apiClient.get<{
      products: ProductItem[]
      total?: number
      page?: number
      pageSize?: number
    }>('/crawler/products', { params })
    return response.data.products
  }

  async function listProductsPage(params: {
    status?: ReviewStatus | ''
    keyword?: string
    storeId?: number | null
    listedStoreId?: number | string | null
    listingStatus?: 'listed' | 'unlisted' | ''
    listedAtFrom?: string
    listedAtTo?: string
    priceMin?: number | null
    priceMax?: number | null
    collectedAtFrom?: string
    collectedAtTo?: string
    page: number
    pageSize: number
  }) {
    const response = await apiClient.get<ApiPageResponse<'products', ProductItem>>('/crawler/products', { params })
    return toPageResult(response.data, 'products')
  }

  async function updateProductStatus(payload: { productIds: number[]; status: ReviewStatus; message?: string }) {
    const response = await apiClient.put<{ products: ProductItem[] }>('/crawler/products/status', payload)
    return response.data.products
  }

  async function deleteProducts(productIds: number[]) {
    const response = await apiClient.delete<{
      deletedIds?: number[]
      failedIds?: number[]
      products?: ProductItem[]
      store?: StoreAccount | null
      syncTask?: SyncTask
      summary: {
        total: number
        successCount: number
        failedCount: number
        cabinetDeletedCount: number
        message: string
        errors: string[]
        warnings: string[]
      }
    }>('/crawler/products', { data: { productIds } })
    return response.data
  }

  async function getProductDetail(productId: number) {
    const response = await apiClient.get<{ product: ProductDetail }>(`/crawler/products/${productId}`)
    return response.data.product
  }

  async function updateProductPrice(productId: number, price: number) {
    const response = await apiClient.put<{ product: ProductItem }>(`/crawler/products/${productId}/price`, { price })
    return response.data.product
  }

  async function updateProductDetail(productId: number, payload: ProductDetailEditPayload) {
    const response = await apiClient.put<{ product: ProductDetail }>(`/crawler/products/${productId}/detail`, payload)
    return response.data.product
  }

  async function updateProductLocalDetail(productId: number, payload: ProductDetailEditPayload) {
    const response = await apiClient.put<{ product: ProductDetail }>(`/crawler/products/${productId}/local-detail`, payload)
    return response.data.product
  }

  async function uploadProductImageDraft(productId: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<{ url: string }>(
      `/crawler/products/${productId}/images/draft`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return response.data
  }

  async function uploadProductImageDraftBase64(productId: number, payload: { imageBase64: string; ext: string }) {
    const response = await apiClient.post<{ url: string }>(
      `/crawler/products/${productId}/images/draft-base64`,
      payload,
    )
    return response.data
  }

  function productImageDownloadUrl(productId: number, imageIndex: number) {
    return `${apiClient.defaults.baseURL || '/api'}/crawler/products/${productId}/images/${imageIndex}/download`
  }

  async function updateProductsListingStatus(payload: {
    productIds: number[]
    listingStatus: 'listed' | 'unlisted'
  }) {
    const response = await apiClient.put<{
      store: StoreAccount | null
      syncTask: SyncTask
      summary: {
        total: number
        successCount: number
        failedCount: number
        message: string
        errors: string[]
      }
    }>('/crawler/products/listing-status', payload)
    return response.data
  }

  async function updateStoreListingStatus(payload: {
    storeId: number
    listingStatus: 'listed' | 'unlisted'
  }) {
    const response = await apiClient.put<{
      store: StoreAccount
      syncTask: SyncTask
      summary: {
        total: number
        successCount: number
        failedCount: number
        message: string
        errors: string[]
      }
    }>('/crawler/stores/listing-status', payload)
    return response.data
  }

  async function listStores(params?: { ownerUsername?: string }) {
    const response = await apiClient.get<{ stores: StoreAccount[] }>('/crawler/stores', { params })
    return response.data.stores
  }

  async function listStoresPage(params: PageParams & { ownerUsername?: string }) {
    const response = await apiClient.get<ApiPageResponse<'stores', StoreAccount>>('/crawler/stores', { params })
    return toPageResult(response.data, 'stores')
  }

  async function saveStore(payload: StorePayload, id?: number) {
    const request = id
      ? apiClient.put<{ store: StoreAccount }>(`/crawler/stores/${id}`, payload)
      : apiClient.post<{ store: StoreAccount }>('/crawler/stores', payload)
    const response = await request
    return response.data
  }

  async function deleteStore(id: number, ownerUsername?: string) {
    await apiClient.delete<{ deleted: boolean }>(`/crawler/stores/${id}`, { params: { ownerUsername } })
  }

  async function syncStore(id: number, ownerUsername?: string) {
    const response = await apiClient.post<{
      store: StoreAccount
      syncTask: SyncTask
      syncedCount: number
    }>(`/crawler/stores/${id}/sync`, null, { params: { ownerUsername } })
    return response.data
  }

  async function verifyStores(ownerUsername?: string) {
    const response = await apiClient.post<{ stores: StoreAccount[]; summary: StoreVerifySummary }>(
      '/crawler/stores/verify',
      null,
      { params: { ownerUsername } },
    )
    return response.data
  }

  async function verifyStore(id: number, ownerUsername?: string) {
    const response = await apiClient.post<{ store: StoreAccount }>(
      `/crawler/stores/${id}/verify`,
      null,
      { params: { ownerUsername } },
    )
    return response.data.store
  }

  async function refreshStoreCounts(ownerUsername?: string) {
    const response = await apiClient.post<{ stores: StoreAccount[]; summary: StoreVerifySummary }>(
      '/crawler/stores/product-counts',
      null,
      { params: { ownerUsername } },
    )
    return response.data
  }

  async function refreshStoreCount(id: number, ownerUsername?: string) {
    const response = await apiClient.post<{ store: StoreAccount }>(
      `/crawler/stores/${id}/product-counts`,
      null,
      { params: { ownerUsername } },
    )
    return response.data.store
  }

  async function listSchedules() {
    const response = await apiClient.get<{ schedules: ScheduledCrawl[] }>('/crawler/schedules')
    return response.data.schedules
  }

  async function listSchedulesPage(params: PageParams & {
    keyword?: string
    enabledStatus?: 'enabled' | 'disabled' | ''
    status?: 'idle' | 'running' | 'disabled' | 'failed' | ''
    scheduleTime?: string
    createdAtFrom?: string
    createdAtTo?: string
  }) {
    const response = await apiClient.get<ApiPageResponse<'schedules', ScheduledCrawl>>('/crawler/schedules', { params })
    return toPageResult(response.data, 'schedules')
  }

  async function downloadScheduleImportTemplate() {
    const response = await apiClient.get<Blob>('/crawler/schedules/import-template', { responseType: 'blob' })
    return response.data
  }

  async function exportSchedules(params: {
    keyword?: string
    enabledStatus?: 'enabled' | 'disabled' | ''
    status?: 'idle' | 'running' | 'disabled' | 'failed' | ''
    scheduleTime?: string
    createdAtFrom?: string
    createdAtTo?: string
  }) {
    const response = await apiClient.get<Blob>('/crawler/schedules/export', { params, responseType: 'blob' })
    return response.data
  }

  async function importSchedules(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<ScheduleImportResult>('/crawler/schedules/import', formData)
    return response.data
  }

  async function saveSchedule(payload: ScheduledCrawlPayload, id?: number) {
    const request = id
      ? apiClient.put<{ schedule: ScheduledCrawl }>(`/crawler/schedules/${id}`, payload)
      : apiClient.post<{ schedule: ScheduledCrawl }>('/crawler/schedules', payload)
    const response = await request
    return response.data
  }

  async function deleteSchedule(id: number) {
    await apiClient.delete<{ deleted: boolean }>(`/crawler/schedules/${id}`)
  }

  async function deleteSchedules(scheduleIds: number[]) {
    const response = await apiClient.delete<{
      deletedIds: number[]
      failedIds: number[]
      deletedCount: number
    }>('/crawler/schedules', { data: { scheduleIds } })
    return response.data
  }

  async function runSchedule(id: number) {
    const response = await apiClient.post<{ schedule: ScheduledCrawl }>(`/crawler/schedules/${id}/run`)
    return response.data
  }

  async function listListingTasks() {
    const response = await apiClient.get<{ listingTasks: ListingTask[] }>('/crawler/listing-tasks')
    return response.data.listingTasks
  }

  async function listListingTasksPage(params: PageParams) {
    const response = await apiClient.get<ApiPageResponse<'listingTasks', ListingTask>>('/crawler/listing-tasks', { params })
    return toPageResult(response.data, 'listingTasks')
  }

  async function createListingTask(payload: ListingTaskPayload) {
    const response = await apiClient.post<{ listingTask: ListingTask }>('/crawler/listing-tasks', payload)
    return response.data
  }

  async function preflightListingTask(payload: ListingTaskPayload) {
    const response = await apiClient.post<ListingPreflightResult>('/crawler/listing-tasks/preflight', payload)
    return response.data
  }

  async function retryListingTask(taskId: string) {
    const response = await apiClient.post<{ listingTask: ListingTask }>(`/crawler/listing-tasks/${taskId}/retry`)
    return response.data
  }

  async function cancelListingTask(taskId: string) {
    const response = await apiClient.post<{ listingTask: ListingTask }>(`/crawler/listing-tasks/${taskId}/cancel`)
    return response.data
  }

  async function deleteListingTasks(taskIds: string[]) {
    const response = await apiClient.delete<{
      deletedIds: string[]
      failedIds: string[]
      deletedCount: number
    }>('/crawler/listing-tasks', { data: { taskIds } })
    return response.data
  }

  async function listSyncTasks() {
    const response = await apiClient.get<{ syncTasks: SyncTask[] }>('/crawler/sync-tasks')
    return response.data.syncTasks
  }

  async function listSyncTasksPage(params: PageParams) {
    const response = await apiClient.get<ApiPageResponse<'syncTasks', SyncTask>>('/crawler/sync-tasks', { params })
    return toPageResult(response.data, 'syncTasks')
  }

  async function retrySyncTask(taskId: string) {
    const response = await apiClient.post<{ syncTask: SyncTask }>(`/crawler/sync-tasks/${taskId}/retry`)
    return response.data
  }

  async function cancelSyncTask(taskId: string) {
    const response = await apiClient.post<{ syncTask: SyncTask }>(`/crawler/sync-tasks/${taskId}/cancel`)
    return response.data
  }

  async function deleteSyncTasks(taskIds: string[]) {
    const response = await apiClient.delete<{
      deletedIds: string[]
      failedIds: string[]
      deletedCount: number
    }>('/crawler/sync-tasks', { data: { taskIds } })
    return response.data
  }

  async function listRoles() {
    const response = await apiClient.get<{ roles: RoleDefinition[] }>('/crawler/roles')
    return response.data.roles
  }

  async function listRolesPage(params: PageParams) {
    const response = await apiClient.get<ApiPageResponse<'roles', RoleDefinition>>('/crawler/roles', { params })
    return toPageResult(response.data, 'roles')
  }

  async function saveRole(payload: RolePayload, id?: number) {
    const request = id
      ? apiClient.put<{ role: RoleDefinition }>(`/crawler/roles/${id}`, payload)
      : apiClient.post<{ role: RoleDefinition }>('/crawler/roles', payload)
    const response = await request
    return response.data
  }

  async function deleteRole(id: number) {
    await apiClient.delete<{ deleted: boolean }>(`/crawler/roles/${id}`)
  }

  function isSuperadmin(session: AuthSession | null | undefined) {
    return session?.role === 'superadmin'
  }

  return {
    getDashboardSummary,
    listUsers,
    listUsersPage,
    createUser,
    updateUser,
    resetPassword,
    getSecretProfile,
    updateSecretProfile,
    verifySecretProfile,
    getTimeSettings,
    updateTimeSettings,
    runScheduledTaskCleanup,
    runUnlistedProductCleanup,
    listSources,
    listSourcesPage,
    saveSource,
    deleteSource,
    listTasks,
    listTasksPage,
    createTask,
    restartTask,
    cancelTask,
    deleteTasks,
    listProducts,
    listProductsPage,
    updateProductStatus,
    deleteProducts,
    getProductDetail,
    updateProductPrice,
    updateProductDetail,
    updateProductLocalDetail,
    uploadProductImageDraft,
    uploadProductImageDraftBase64,
    productImageDownloadUrl,
    updateProductsListingStatus,
    updateStoreListingStatus,
    listStores,
    listStoresPage,
    saveStore,
    deleteStore,
    syncStore,
    verifyStores,
    verifyStore,
    refreshStoreCounts,
    refreshStoreCount,
    listSchedules,
    listSchedulesPage,
    downloadScheduleImportTemplate,
    exportSchedules,
    importSchedules,
    saveSchedule,
    deleteSchedule,
    deleteSchedules,
    runSchedule,
    listListingTasks,
    listListingTasksPage,
    preflightListingTask,
    createListingTask,
    retryListingTask,
    cancelListingTask,
    deleteListingTasks,
    listSyncTasks,
    listSyncTasksPage,
    retrySyncTask,
    cancelSyncTask,
    deleteSyncTasks,
    listRoles,
    listRolesPage,
    saveRole,
    deleteRole,
    isSuperadmin,
  }
}
