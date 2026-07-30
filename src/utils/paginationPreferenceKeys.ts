import type { ReviewStatus } from '../types/crawler'

export const PAGINATION_PREFERENCE_KEYS = {
  collectionShops: 'collection-shops',
  crawlSources: 'crawl-sources',
  crawlTasks: 'crawl-tasks',
  deletedProductImages: 'deleted-product-images',
  listingTasks: 'listing-tasks',
  manualCrawlResults: 'manual-crawl-results',
  manualCrawlTasks: 'manual-crawl-tasks',
  roles: 'roles',
  salesOrderSyncHistory: 'sales-order-sync-history',
  scheduledCrawls: 'scheduled-crawls',
  sensitiveWords: 'sensitive-words',
  stores: 'stores',
  syncTasks: 'sync-tasks',
  titleOptimizationTasks: 'title-optimization-tasks',
  imageCleanupTasks: 'image-cleanup-tasks',
  listingImageUploadTasks: 'listing-image-upload-tasks',
  userManagedStores: 'user-managed-stores',
  users: 'users',
} as const

export function productWorkflowPaginationKey(status: ReviewStatus) {
  return `products:${status}`
}

export function resolvePaginationPageSize(
  preferences: Record<string, number> | null | undefined,
  listKey: string,
  pageSizes: readonly number[],
  defaultPageSize: number,
) {
  const storedPageSize = Number(preferences?.[listKey])
  return pageSizes.includes(storedPageSize)
    ? storedPageSize
    : defaultPageSize
}
