export type UserRole = 'superadmin' | 'operator'
export type SourceType = 'keyword' | 'shop' | 'ranking' | 'product_url'
export type TaskStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed' | 'cancelled'
export type ReviewStatus = 'pending' | 'approved' | 'error' | 'listing' | 'listed' | 'listed_master' | 'rejected'
export type ScheduleStatus = 'idle' | 'running' | 'disabled' | 'failed'
export type AvailabilityStatus = 'available' | 'error' | 'unchecked'
export type StoreProductStatus = '' | 'active' | 'removed'
export type RakutenListingStatus = '' | 'listed' | 'unlisted'
export type RankingPeriod = 'daily' | 'weekly' | 'monthly'
export type CrawlLimit = 'all' | number

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

export interface DashboardSummary {
  dateRange: {
    from: string
    to: string
  }
  stores: {
    total: number
    enabled: number
    error: number
  }
  products: {
    pending: number
    approved: number
    error: number
  }
  crawlTasks: {
    queued: number
    running: number
    success: number
    failed: number
  }
  listingTasks: {
    queued: number
    running: number
    success: number
    failed: number
  }
  syncTasks: {
    queued: number
    running: number
    success: number
    failed: number
  }
}

export interface UserPermissions {
  manageUsers: boolean
  manageOwnSecrets: boolean
  manageCrawler: boolean
  manageProducts: boolean
  manageStores: boolean
  manageSettings: boolean
}

export interface AuthSession {
  username: string
  displayName: string
  role: UserRole
  enabled: boolean
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
  genreId: string
  reviewStatus: ReviewStatus
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
  cabinetUsageCheckedAt?: string | null
  rakutenProductTotalCount?: number | null
  rakutenProductListedCount?: number | null
  rakutenProductUnlistedCount?: number | null
  lastCheckedAt?: string | null
  lastProductSyncedAt?: string | null
  lastSyncedAt?: string | null
  lastError?: string | null
  availabilityStatus: AvailabilityStatus
  createdAt?: string | null
  updatedAt?: string | null
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

export interface ListingTaskPayload {
  productIds: number[]
  storeId?: number | null
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
