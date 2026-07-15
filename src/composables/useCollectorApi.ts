import type {
  AiTitleSettings,
  AiTitleSettingsPayload,
  AiProviderOption,
  AuthSession,
  CrawlSource,
  CrawlSourcePayload,
  CrawlTask,
  CreateTaskPayload,
  ListingPreflightResult,
  ListingTask,
  ListingTaskPayload,
  ManualCrawlImportResult,
  PageParams,
  PageResult,
  ProductDetailEditPayload,
  ProductDetail,
  ProductItem,
  ProductReplacement,
  RakutenGenreOption,
  RakutenGenreNode,
  ProductTitleVersion,
  ProductTitleVersionList,
  ProxyResourceUsage,
  ReviewStatus,
  RoleDefinition,
  RolePayload,
  ScheduleImportResult,
  ScheduledCrawl,
  ScheduledCrawlPayload,
  SecretProfile,
  SecretProfilePayload,
  SensitiveWord,
  SensitiveWordImportResult,
  SensitiveWordPayload,
  SourceType,
  StoreAccount,
  StoreEmptyCabinetFoldersResult,
  StorePayload,
  StoreVerifySummary,
  SyncTask,
  TimeSettings,
  TimeSettingsPayload,
  UserAccount,
} from '../types/crawler'
import { apiClient, resolveApiBaseUrl } from '../utils/api'

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

  async function updateUser(username: string, payload: {
    displayName?: string
    enabled?: boolean
    permissions?: string[]
    crawlMinPrice?: 0 | 2500 | 3800
  }) {
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

  async function getProxyResourceUsage(refresh = false) {
    const response = await apiClient.get<{ proxyUsage: ProxyResourceUsage }>(
      '/crawler/settings/resources/proxy-usage',
      { params: { refresh } },
    )
    return response.data.proxyUsage
  }

  async function listSensitiveWordsPage(params: PageParams & { keyword?: string }) {
    const response = await apiClient.get<PageResult<SensitiveWord>>('/crawler/settings/sensitive-words', { params })
    return response.data
  }

  async function createSensitiveWord(payload: SensitiveWordPayload) {
    const response = await apiClient.post<{ sensitiveWord: SensitiveWord }>('/crawler/settings/sensitive-words', payload)
    return response.data
  }

  async function updateSensitiveWord(wordId: number, payload: SensitiveWordPayload) {
    const response = await apiClient.put<{ sensitiveWord: SensitiveWord }>(
      `/crawler/settings/sensitive-words/${wordId}`,
      payload,
    )
    return response.data
  }

  async function deleteSensitiveWord(wordId: number) {
    await apiClient.delete<{ deleted: boolean }>(`/crawler/settings/sensitive-words/${wordId}`)
  }

  async function downloadSensitiveWordTemplate() {
    const response = await apiClient.get<Blob>('/crawler/settings/sensitive-words/template', { responseType: 'blob' })
    return response.data
  }

  async function importSensitiveWords(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<SensitiveWordImportResult>('/crawler/settings/sensitive-words/import', formData)
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

  async function downloadManualCrawlImportTemplate() {
    const response = await apiClient.get<Blob>('/crawler/tasks/import-template', { responseType: 'blob' })
    return response.data
  }

  async function importManualCrawlTasks(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<ManualCrawlImportResult>('/crawler/tasks/import', formData)
    return response.data
  }

  async function listProducts(params: {
    status?: ReviewStatus | ''
    keyword?: string
    taskId?: string
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
    taskId?: string
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

  async function searchRakutenGenres(keyword: string, limit = 30) {
    const response = await apiClient.get<{ genres: RakutenGenreOption[] }>('/crawler/products/genres', {
      params: { keyword, limit },
    })
    return response.data.genres
  }

  async function listRakutenGenreChildren(parentPath = '') {
    const response = await apiClient.get<{ genres: RakutenGenreNode[] }>('/crawler/products/genres/children', {
      params: { parentPath },
    })
    return response.data.genres
  }

  async function updatePendingProductGenre(productId: number, genreId: string) {
    const response = await apiClient.put<{ product: ProductItem }>(
      `/crawler/products/${productId}/genre`,
      { genreId },
    )
    return response.data.product
  }

  async function deleteProducts(productIds: number[]) {
    const response = await apiClient.delete<{
      deletedIds?: number[]
      failedIds?: number[]
      products?: ProductItem[]
      store?: StoreAccount | null
      syncTask?: SyncTask
      syncTasks?: SyncTask[]
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

  async function createProductReplacement(productId: number, sourceUrl: string) {
    const response = await apiClient.post<ProductReplacement>(
      `/crawler/store-products/${productId}/replacement`,
      { sourceUrl },
    )
    return response.data
  }

  async function getProductReplacement(taskId: string) {
    const response = await apiClient.get<ProductReplacement>(`/crawler/product-replacements/${taskId}`)
    return response.data
  }

  async function updateProductReplacementDraft(
    taskId: string,
    payload: Partial<Pick<ProductReplacement['after'], 'title' | 'tagline' | 'genreId' | 'price' | 'images' | 'descriptions' | 'variants'>>,
  ) {
    const response = await apiClient.put<ProductReplacement>(
      `/crawler/product-replacements/${taskId}/draft`,
      payload,
    )
    return response.data
  }

  async function confirmProductReplacement(taskId: string, manageNumber: string) {
    const response = await apiClient.post<ProductReplacement>(
      `/crawler/product-replacements/${taskId}/confirm`,
      { manageNumber },
    )
    return response.data
  }

  async function cancelProductReplacement(taskId: string) {
    const response = await apiClient.post<ProductReplacement>(
      `/crawler/product-replacements/${taskId}/cancel`,
    )
    return response.data
  }

  async function getAiTitleSettings() {
    const response = await apiClient.get<{ settings: AiTitleSettings }>('/crawler/settings/ai-title')
    return response.data.settings
  }

  async function getAiTitleProviders() {
    const response = await apiClient.get<{ providers: AiProviderOption[] }>('/crawler/settings/ai-title/providers')
    return response.data.providers
  }

  async function updateAiTitleSettings(payload: AiTitleSettingsPayload) {
    const response = await apiClient.put<{ settings: AiTitleSettings }>('/crawler/settings/ai-title', payload)
    return response.data.settings
  }

  async function testAiTitleSettings() {
    const response = await apiClient.post<{ success: boolean; message: string }>('/crawler/settings/ai-title/test')
    return response.data
  }

  async function listProductTitleVersions(productId: number) {
    const response = await apiClient.get<ProductTitleVersionList>(`/crawler/products/${productId}/title-versions`)
    return response.data
  }

  async function saveProductTitleVersion(productId: number, versionId: number) {
    const response = await apiClient.post<{ version: ProductTitleVersion }>(
      `/crawler/products/${productId}/title-versions/save`,
      { versionId },
    )
    return response.data.version
  }

  async function deleteProductTitleVersion(productId: number, versionId: number) {
    await apiClient.delete(`/crawler/products/${productId}/title-versions/${versionId}`)
  }

  async function streamProductTitleVersion(
    productId: number,
    handlers: {
      onDelta: (content: string) => void
      onCompleted: (version: ProductTitleVersion) => void
    },
  ) {
    const response = await fetch(`${resolveApiBaseUrl()}/crawler/products/${productId}/title-versions/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
    })
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.detail || `生成请求失败（HTTP ${response.status}）`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let completed = false
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''
      for (const block of events) {
        const dataLine = block.split('\n').find((line) => line.startsWith('data:'))
        if (!dataLine) continue
        const event = JSON.parse(dataLine.slice(5).trim())
        if (event.type === 'delta') handlers.onDelta(String(event.content || ''))
        if (event.type === 'completed') {
          completed = true
          handlers.onCompleted(event.version as ProductTitleVersion)
        }
        if (event.type === 'error') throw new Error(String(event.message || '生成标题失败'))
      }
      if (done) break
    }
    if (!completed) {
      throw new Error('生成连接已结束，但服务器没有保存新的历史版本')
    }
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
      syncTasks?: SyncTask[]
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

  async function scanStoreEmptyCabinetFolders(id: number, ownerUsername?: string) {
    const response = await apiClient.get<StoreEmptyCabinetFoldersResult>(
      `/crawler/stores/${id}/cabinet/empty-folders`,
      { params: { ownerUsername } },
    )
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

  async function updateScheduleStatuses(scheduleIds: number[], enabled: boolean) {
    const response = await apiClient.put<{
      updatedIds: number[]
      failedIds: number[]
      updatedCount: number
      enabled: boolean
    }>('/crawler/schedules/status', { scheduleIds, enabled })
    return response.data
  }

  async function runSchedule(id: number) {
    const response = await apiClient.post<{ schedule: ScheduledCrawl }>(`/crawler/schedules/${id}/run`)
    return response.data
  }

  async function runAllSchedules(params: {
    keyword?: string
    enabledStatus?: 'enabled' | 'disabled' | ''
    status?: 'idle' | 'running' | 'disabled' | 'failed' | ''
    scheduleTime?: string
    createdAtFrom?: string
    createdAtTo?: string
  }) {
    const response = await apiClient.post<{
      total: number
      dispatchedCount: number
      matchedCount?: number
      pendingDispatchCount?: number
      batchSize?: number
      failedIds: number[]
      failedCount: number
    }>('/crawler/schedules/run-all', params)
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
    const response = await apiClient.post<{
      listingTask: ListingTask
      listingTasks?: ListingTask[]
      summary?: {
        total: number
        taskCount: number
        message: string
      }
    }>('/crawler/listing-tasks', payload)
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
    getProxyResourceUsage,
    listSensitiveWordsPage,
    createSensitiveWord,
    updateSensitiveWord,
    deleteSensitiveWord,
    downloadSensitiveWordTemplate,
    importSensitiveWords,
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
    downloadManualCrawlImportTemplate,
    importManualCrawlTasks,
    listProducts,
    listProductsPage,
    updateProductStatus,
    searchRakutenGenres,
    listRakutenGenreChildren,
    updatePendingProductGenre,
    deleteProducts,
    getProductDetail,
    updateProductPrice,
    updateProductDetail,
    updateProductLocalDetail,
    createProductReplacement,
    getProductReplacement,
    updateProductReplacementDraft,
    confirmProductReplacement,
    cancelProductReplacement,
    getAiTitleSettings,
    getAiTitleProviders,
    updateAiTitleSettings,
    testAiTitleSettings,
    listProductTitleVersions,
    saveProductTitleVersion,
    deleteProductTitleVersion,
    streamProductTitleVersion,
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
    scanStoreEmptyCabinetFolders,
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
    updateScheduleStatuses,
    runSchedule,
    runAllSchedules,
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
