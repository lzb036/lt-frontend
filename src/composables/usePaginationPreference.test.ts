import {
  PAGINATION_PREFERENCE_KEYS,
  productWorkflowPaginationKey,
  resolvePaginationPageSize,
} from '../utils/paginationPreferenceKeys.ts'

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`)
  }
}

const preferences = {
  [PAGINATION_PREFERENCE_KEYS.stores]: 300,
  [PAGINATION_PREFERENCE_KEYS.syncTasks]: 90,
}

assertEqual(
  resolvePaginationPageSize(
    preferences,
    PAGINATION_PREFERENCE_KEYS.stores,
    [30, 60, 90, 180, 300],
    30,
  ),
  300,
  'expected the store-list preference to be restored',
)
assertEqual(
  resolvePaginationPageSize(
    preferences,
    PAGINATION_PREFERENCE_KEYS.users,
    [30, 60, 90, 180, 300],
    30,
  ),
  30,
  'expected an unrelated list to keep its default',
)

if (productWorkflowPaginationKey('pending') === productWorkflowPaginationKey('listed')) {
  throw new Error('expected product workflow lists to use independent keys')
}

assertEqual(
  resolvePaginationPageSize(
    { [PAGINATION_PREFERENCE_KEYS.manualCrawlResults]: 300 },
    PAGINATION_PREFERENCE_KEYS.manualCrawlResults,
    [30, 60, 90],
    30,
  ),
  30,
  'expected unsupported saved sizes to fall back',
)
