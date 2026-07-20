export type UserRole = 'superadmin' | 'operator'
export type SourceType = 'keyword' | 'shop' | 'ranking' | 'product_url' | 'product_replace'
export type TaskStatus = 'preview_ready' | 'queued' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled'
export type ReviewStatus = 'pending' | 'approved' | 'error' | 'listing' | 'listed' | 'listed_master' | 'rejected'
export type ScheduleStatus = 'idle' | 'running' | 'disabled' | 'failed'
export type AvailabilityStatus = 'available' | 'error' | 'unchecked'
export type StoreProductStatus = '' | 'active' | 'removed'
export type RakutenListingStatus = '' | 'listed' | 'unlisted'
export type RankingPeriod = 'daily' | 'weekly' | 'monthly'
export type CrawlLimit = 'all' | number
export type CrawlPriceOperator = 'all' | 'gt' | 'gte' | 'lt' | 'lte' | 'range'

export interface CrawlPriceRule {
  operator: CrawlPriceOperator
  value?: number
  minPrice?: number
  maxPrice?: number
}

export interface CrawlPriceSettings {
  crawlMinPrice: 0 | 2500 | 3800
  crawlPriceRule: CrawlPriceRule
}

export interface PageParams {
  page: number
  pageSize: number
}

export interface PageResult<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface UserPermissions {
  manageUsers: boolean
  manageOwnSecrets: boolean
  manageCrawler: boolean
  manageProducts: boolean
  manageStores: boolean
  manageSettings: boolean
  manageAi: boolean
}

export interface AuthSession {
  username: string
  displayName: string
  role: UserRole
  enabled: boolean
  crawlMinPrice: 0 | 2500 | 3800
  crawlPriceRule?: CrawlPriceRule
  permissionCodes: string[]
  permissions: UserPermissions
  createdAt?: string | null
  updatedAt?: string | null
}

export interface MaskedSecretMap {
  rakutenServiceSecret: string
  rakutenLicenseKey: string
  alibabaAppKey: string
  alibabaAppSecret: string
  alibabaAccessToken: string
  logisticsUsername: string
  logisticsPassword: string
  proxyUrl: string
  ossAccessKeyId: string
  ossAccessKeySecret: string
}

export interface SecretProfile {
  ownerUsername: string
  rakutenShopUrl: string
  rakutenShopName: string
  rakutenServiceSecret: string
  rakutenLicenseKey: string
  alibabaAppKey: string
  alibabaAppSecret: string
  alibabaAccessToken: string
  logisticsBaseUrl: string
  logisticsUsername: string
  logisticsPassword: string
  proxyUrl: string
  ossAccessKeyId: string
  ossAccessKeySecret: string
  masked: MaskedSecretMap
  ossBucket: string
  ossEndpoint: string
  autoCrawlEnabled: boolean
  autoCrawlIntervalMinutes: number
  lastVerifiedAt?: string | null
  lastError?: string | null
  updatedAt?: string | null
}

export interface UserAccount extends AuthSession {}

export interface CrawlSource {
  id: number
  ownerUsername: string
  name: string
  sourceType: SourceType
  target: string
  enabled: boolean
  scheduleEnabled: boolean
  intervalMinutes: number
  lastRunAt?: string | null
  notes: string
  createdAt?: string | null
  updatedAt?: string | null
}

export interface CrawlTask {
  id: string
  ownerUsername: string
  sourceId?: number | null
  sourceType: SourceType
  target: string
  mode: string
  status: TaskStatus
  totalCount: number
  successCount: number
  failedCount: number
  warningCount?: number
  savedCount?: number
  skippedCount?: number
  cancelRequested?: boolean
  message: string
  errorDetail?: string | null
  warningDetail?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string | null
}

export interface ProductItem {
  id: number
  ownerUsername: string
  taskId?: string | null
  parentProductId?: number | null
  listingTaskId?: string | null
  storeId?: number | null
  rakutenManageNumber?: string | null
  storeProductStatus: StoreProductStatus
  rakutenListingStatus: RakutenListingStatus
  listedStores?: ProductListedStore[]
  storeLastSeenAt?: string | null
  title: string
  tagline?: string | null
  sourceUrl: string
  rakutenItemUrl?: string | null
  itemNumber: string
  shopName: string
  imageUrl: string
  images?: string[]
  price?: number | null
  priceMin?: number | null
  priceMax?: number | null
  currency: string
  salesCount?: number | null
  periodSalesCount?: number | null
  titleOptimizationCount?: number | null
  titleOptimizationTaskId?: string | null
  genreId: string
  genrePath: string
  genrePathZh: string
  reviewStatus: ReviewStatus
  replacementTaskId?: string | null
  replacementTargetProductId?: number | null
  replacementTargetManageNumber?: string | null
  replacementTargetStoreId?: number | null
  replacementTargetStoreName?: string | null
  lastError?: string | null
  listedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ProductListedStore {
  storeId: number
  storeCode: string
  storeName: string
  aliasName: string
  manageNumber: string
  itemNumber: string
  itemUrl?: string | null
  productId?: number | null
  listedAt?: string | null
}

export interface RakutenGenreOption {
  genreId: string
  genrePath: string
  genrePathZh: string
}

export interface RakutenGenreNode extends RakutenGenreOption {
  label: string
  labelZh: string
  leaf: boolean
}

export interface ProductVariant {
  variantId: string
  merchantDefinedSkuId: string
  articleNumber: string
  standardPrice: string
  hidden?: boolean | null
  singleProduct?: boolean
  selectorValues: Record<string, string>
  specs: Record<string, unknown>[]
  attributes: Record<string, unknown>[]
  material?: string | null
}

export interface ProductVariantEditPayload {
  variantId: string
  standardPrice: number
  hidden: boolean
  singleProduct?: boolean
}

export interface ProductDetailEditPayload {
  title: string
  tagline: string
  genreId?: string
  variants: ProductVariantEditPayload[]
  imageChanges?: {
    images: string[]
    replacements: Array<{ from: string; to: string }>
    removeUrls: string[]
  }
}

export interface ProductVariantSelector {
  key: string
  name: string
  values: unknown[]
}

export interface ProductDescription {
  label: string
  value: string
}

export interface ProductDetail extends ProductItem {
  detail: {
    manageNumber?: string | null
    itemNumber?: string | null
    title?: string | null
    tagline?: string | null
    genreId?: string | null
    shopName?: string | null
    sourceUrl?: string | null
    rakutenItemUrl?: string | null
    listingStatus?: string | null
    salesCount?: number | null
    created?: string | null
    updated?: string | null
    descriptions: ProductDescription[]
    images: string[]
    variantSelectors: ProductVariantSelector[]
    variants: ProductVariant[]
    raw: Record<string, unknown>
  }
}

export interface AiTitleSettings {
  provider: string
  apiBaseUrl: string
  apiKeyConfigured: boolean
  apiKeyMasked: string
  modelName: string
  titlePrompt: string
  subtitlePrompt: string
  verified: boolean
  verifiedAt?: string | null
  lastError?: string | null
}

export interface AiTitleSettingsPayload {
  provider: string
  apiBaseUrl: string
  apiKey: string
  modelName: string
  titlePrompt: string
  subtitlePrompt: string
}

export interface AiProviderOption {
  value: string
  label: string
  apiBaseUrl: string
  models: string[]
}

export interface ProductTitleVersion {
  id: number
  productId: number
  title: string
  subtitle: string
  source: 'ai' | 'manual' | 'original' | 'final'
  modelName: string
  isSelected: boolean
  createdBy: string
  createdAt?: string | null
}

export interface ProductTitleVersionList {
  versions: ProductTitleVersion[]
}

export type SalesOrderSyncStatus = 'idle' | 'queued' | 'running' | 'completed' | 'error'

export interface SalesOrderSyncStore {
  id: number
  name: string
  code: string
  enabled: boolean
}

export interface SalesOrderSyncState {
  id: string
  storeId: number
  status: SalesOrderSyncStatus
  alreadyRunning: boolean
  initialSyncCompleted: boolean
  progressCurrent: number
  progressTotal: number
  lastSuccessfulSyncAt?: string | null
  lastRemoteUpdatedAt?: string | null
  lastError: string
}

export interface SalesOrderSyncGlobalSettingsPayload {
  enabled: boolean
  intervalMinutes: number
  successRetentionDays: number
}

export interface SalesOrderSyncGlobalSettings extends SalesOrderSyncGlobalSettingsPayload {
  updatedAt?: string | null
}

export type SalesOrderSyncTriggerType = 'automatic' | 'manual' | 'retry'
export type SalesOrderSyncRunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'cancelled'

export interface SalesOrderSyncRun {
  id: string
  ownerUsername: string
  storeId?: number | null
  storeName: string
  storeAliasName?: string
  triggerType: SalesOrderSyncTriggerType
  parentRunId?: string | null
  status: SalesOrderSyncRunStatus
  initialSync: boolean
  progressCurrent: number
  progressTotal: number
  totalOrderCount: number
  newOrderCount: number
  updatedOrderCount: number
  unchangedOrderCount: number
  failedOrderCount: number
  message: string
  errorDetail?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface SalesOrderSyncRunListParams extends PageParams {
  storeId?: number
  triggerType?: SalesOrderSyncTriggerType
  status?: SalesOrderSyncRunStatus
  createdAtFrom?: string
  createdAtTo?: string
}

export interface SalesOrderSyncRunDeleteResult {
  deletedCount: number
}

export interface StoreAccount {
  id: number
  ownerUsername: string
  storeCode: string
  storeName: string
  aliasName: string
  platform: string
  storeUrl: string
  enabled: boolean
  description: string
  rakutenServiceSecret: string
  rakutenLicenseKey: string
  masked: {
    rakutenServiceSecret: string
    rakutenLicenseKey: string
  }
  cabinetUsedFolderCount?: number | null
  cabinetRemainingFolderCount?: number | null
  recentYearOrderCount?: number | null
  cabinetUsageCheckedAt?: string | null
  rakutenProductTotalCount?: number | null
  rakutenProductListedCount?: number | null
  rakutenProductUnlistedCount?: number | null
  rakutenProductTotalExceedsLimit?: boolean
  lastCheckedAt?: string | null
  lastProductSyncedAt?: string | null
  lastSyncedAt?: string | null
  lastError?: string | null
  availabilityStatus: AvailabilityStatus
  createdAt?: string | null
  updatedAt?: string | null
}

export interface CabinetEmptyFolder {
  folderId: number
  folderName: string
  folderPath: string
  fileCount: number
}

export interface StoreEmptyCabinetFoldersResult {
  store: {
    id: number
    storeCode: string
    storeName: string
    aliasName: string
  }
  folders: CabinetEmptyFolder[]
  total: number
  folderPrefix: string
  manualCleanupRequired: boolean
}

export interface StoreVerifySummary {
  total: number
  available: number
  error: number
  unchecked: number
}

export interface ScheduledCrawl {
  id: number
  ownerUsername: string
  sourceId?: number | null
  name: string
  crawlContent: string
  crawlCondition: string
  sourceType: SourceType
  target: string
  enabled: boolean
  intervalMinutes: number
  scheduleTime: string
  lastRunAt?: string | null
  nextRunAt?: string | null
  status: ScheduleStatus
  notes: string
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ListingTask {
  id: string
  ownerUsername: string
  storeId?: number | null
  storeIds?: number[]
  stores?: ListingTaskStore[]
  storeCode?: string | null
  storeName?: string | null
  aliasName?: string | null
  taskName: string
  status: TaskStatus
  totalCount: number
  successCount: number
  failedCount: number
  productIds: number[]
  successIds?: number[]
  failedIds?: number[]
  cancelRequested?: boolean
  message: string
  errorDetail?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ListingTaskStore {
  storeId: number
  storeCode?: string | null
  storeName?: string | null
  aliasName?: string | null
}

export interface SyncTask {
  id: string
  ownerUsername: string
  storeId?: number | null
  storeName: string
  taskName: string
  taskType?: string
  status: TaskStatus
  totalCount: number
  successCount: number
  failedCount: number
  payload?: Record<string, unknown>
  successIds?: number[]
  failedIds?: number[]
  cancelRequested?: boolean
  message: string
  errorDetail?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ProductReplacementDraft {
  title: string
  tagline: string
  genreId: string
  genrePath: string
  genrePathZh: string
  price?: number | null
  images: string[]
  descriptions: ProductDescription[]
  variants: Record<string, Record<string, unknown>>
  raw?: Record<string, unknown>
}

export interface ProductReplacementDifferenceItem {
  changed: boolean
  before?: unknown
  after?: unknown
  beforeCount?: number
  afterCount?: number
}

export interface ProductReplacement {
  task: SyncTask
  targetProductId: number
  sourceUrl: string
  before: ProductDetail
  after: ProductReplacementDraft
  difference: Record<string, ProductReplacementDifferenceItem>
  pendingProduct?: ProductItem | null
  result?: {
    product?: ProductDetail
    recoveryRequired?: boolean
  }
}

export interface RoleDefinition {
  id: number
  name: string
  code: string
  scope: string
  enabled: boolean
  permissions: string[]
  notes: string
  createdAt?: string | null
  updatedAt?: string | null
}

export interface SecretProfilePayload {
  rakutenShopUrl?: string
  rakutenShopName?: string
  rakutenServiceSecret?: string
  rakutenLicenseKey?: string
  alibabaAppKey?: string
  alibabaAppSecret?: string
  alibabaAccessToken?: string
  logisticsBaseUrl?: string
  logisticsUsername?: string
  logisticsPassword?: string
  proxyUrl?: string
  ossAccessKeyId?: string
  ossAccessKeySecret?: string
  ossBucket?: string
  ossEndpoint?: string
  autoCrawlEnabled?: boolean
  autoCrawlIntervalMinutes?: number
}

export interface CrawlSourcePayload {
  name: string
  sourceType: SourceType
  target: string
  enabled: boolean
  scheduleEnabled: boolean
  intervalMinutes: number
  notes: string
}

export interface CreateTaskPayload {
  sourceId?: number | null
  sourceType?: SourceType | null
  target?: string | null
  rankingPeriod?: RankingPeriod | null
  crawlLimit?: CrawlLimit | null
  mode?: string
}

export interface StorePayload {
  ownerUsername?: string
  aliasName: string
  platform: string
  enabled: boolean
  description: string
  rakutenServiceSecret?: string
  rakutenLicenseKey?: string
}

export interface ScheduledCrawlPayload {
  sourceId?: number | null
  name: string
  crawlContent: string
  crawlCondition: string
  sourceType: SourceType
  target: string
  rankingPeriod: RankingPeriod
  crawlLimit?: CrawlLimit | null
  enabled: boolean
  intervalMinutes: number
  scheduleTime: string
  notes: string
}

export interface ScheduleImportFailedRow {
  rowNumber: number
  message: string
}

export interface ScheduleImportRow {
  rowNumber: number
  shopName: string
  shopUrl: string
  action: 'created' | 'updated'
}

export interface ScheduleImportResult {
  totalRows: number
  createdCount: number
  updatedCount: number
  failedCount: number
  failedRows: ScheduleImportFailedRow[]
  importedRows: ScheduleImportRow[]
}

export interface ManualCrawlImportResult {
  productUrlCount: number
  productTaskCreated: boolean
  shopTaskCount: number
  createdTaskCount: number
  failedCount: number
  failedRows: Array<{
    sheet: string
    rowNumber: number
    message: string
  }>
}

export type SensitiveWordRuleType = 'literal' | 'bracket'

export interface SensitiveWord {
  id: number
  word: string
  ruleType: SensitiveWordRuleType
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface SensitiveWordPayload {
  word: string
  enabled: boolean
}

export interface SensitiveWordImportResult {
  createdCount: number
  duplicateCount: number
  invalidCount: number
}

export interface TimeSettings {
  cleanupWeekday: number
  cleanupTime: string
  cleanupEnabled: boolean
  retentionDays: number
  nextCleanupAt?: string | null
  lastCleanupAt?: string | null
  lastCleanupDeletedCount: number
  productSyncEnabled: boolean
  productSyncWeekday: number
  productSyncTime: string
  productSyncNextAt?: string | null
  productSyncLastAt?: string | null
  productSyncLastTaskCount: number
  unlistedCleanupEnabled: boolean
  unlistedCleanupMonthDay: number
  unlistedCleanupTime: string
  unlistedNextCleanupAt?: string | null
  unlistedLastCleanupAt?: string | null
  unlistedLastDeletedCount: number
  unlistedLastTaskCount: number
  queueHealth?: TaskQueueHealth | null
  serverNow?: string | null
  updatedAt?: string | null
}

export interface TimeSettingsPayload {
  cleanupWeekday: number
  cleanupTime: string
  cleanupEnabled: boolean
  productSyncEnabled: boolean
  productSyncWeekday: number
  productSyncTime: string
  unlistedCleanupEnabled: boolean
}

export interface ProxyResourceUsage {
  uploadBytes: number
  downloadBytes: number
  usedBytes: number
  totalBytes: number
  remainingBytes: number
  usagePercent: number
  resetDay: number
  resetAt?: string | null
  resetRemainingSeconds: number
  checkedAt?: string | null
  source: 'subscription' | 'mihomo_config'
  stale: boolean
}

export interface TaskQueueRedisInfo {
  usedMemory: number
  usedMemoryHuman: string
  maxMemory: number
  maxMemoryHuman: string
}

export interface TaskQueueHealthQueue {
  name: string
  kind: string
  workerCount: number
  queued: number
  started: number
  failed: number
  deferred: number
  scheduled: number
  pending: number
  ok: boolean
}

export interface TaskQueueHealth {
  mode: string
  status: 'ok' | 'degraded' | 'error' | 'disabled'
  ok: boolean
  summary: string
  checkedAt?: string | null
  workerCount: number
  redis?: TaskQueueRedisInfo | null
  queues: TaskQueueHealthQueue[]
  error?: string
}

export interface ListingTaskPayload {
  productIds: number[]
  storeId?: number | null
  storeIds?: number[]
  taskName?: string
}

export type ListingPreflightSeverity = 'blocker' | 'warning'
export type ListingPreflightProductStatus = 'passed' | 'warning' | 'blocked'

export interface ListingPreflightIssue {
  severity: ListingPreflightSeverity
  code: string
  message: string
  field?: string
  attributeName?: string
  variantId?: string
}

export interface ListingPreflightProduct {
  productId: number
  productCode: string
  productTitle: string
  status: ListingPreflightProductStatus
  issueCount: number
  blockerCount: number
  warningCount: number
  issues: ListingPreflightIssue[]
  preview: {
    title?: string
    genreId?: string
    variantCount?: number
    imageCount?: number
    attributeGroup?: string
  }
}

export interface ListingPreflightResult {
  canProceed: boolean
  message: string
  summary: {
    productCount: number
    passedCount: number
    blockedCount: number
    warningProductCount: number
    issueCount: number
    blockerCount: number
    warningCount: number
  }
  globalIssues: ListingPreflightIssue[]
  products: ListingPreflightProduct[]
}

export interface RolePayload {
  name: string
  code: string
  scope: string
  enabled: boolean
  permissions: string[]
  notes: string
}
