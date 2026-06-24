export type UserRole = 'superadmin' | 'operator'
export type SourceType = 'keyword' | 'shop' | 'ranking' | 'product_url'
export type TaskStatus = 'queued' | 'running' | 'success' | 'partial' | 'failed'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface UserPermissions {
  manageUsers: boolean
  manageOwnSecrets: boolean
  manageCrawler: boolean
}

export interface AuthSession {
  username: string
  displayName: string
  role: UserRole
  enabled: boolean
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
  defaultPriceMultiplier: string
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
  message: string
  errorDetail?: string | null
  startedAt?: string | null
  finishedAt?: string | null
  createdAt?: string | null
}

export interface ProductItem {
  id: number
  ownerUsername: string
  taskId?: string | null
  title: string
  sourceUrl: string
  itemNumber: string
  shopName: string
  imageUrl: string
  price?: number | null
  currency: string
  genreId: string
  reviewStatus: ReviewStatus
  lastError?: string | null
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
  defaultPriceMultiplier?: string
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
  mode?: string
}
