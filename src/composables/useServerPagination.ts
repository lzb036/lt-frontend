import { ref, type MaybeRefOrGetter } from 'vue'

import { usePaginationPreference } from './usePaginationPreference'

export const DEFAULT_PAGE_SIZE = 30
export const DEFAULT_PAGE_SIZES = [30, 60, 90, 180, 300]
export const DEFAULT_PAGINATION_LAYOUT = 'total, sizes, prev, pager, next, jumper'

export function useServerPagination(
  listKey: MaybeRefOrGetter<string>,
  pageSizes: readonly number[] = DEFAULT_PAGE_SIZES,
  defaultPageSize = DEFAULT_PAGE_SIZE,
) {
  const currentPage = ref(1)
  const pageSize = usePaginationPreference(listKey, pageSizes, defaultPageSize)
  const total = ref(0)

  function resetPage() {
    currentPage.value = 1
  }

  function setPageResult(result: { total: number; page?: number; pageSize?: number }) {
    total.value = result.total
    if (result.page && result.page !== currentPage.value) {
      currentPage.value = result.page
    }
    if (result.pageSize && result.pageSize !== pageSize.value) {
      pageSize.value = result.pageSize
    }
  }

  function reduceTotal(count: number) {
    total.value = Math.max(0, total.value - count)
  }

  return {
    currentPage,
    pageSize,
    pageSizes,
    paginationLayout: DEFAULT_PAGINATION_LAYOUT,
    total,
    resetPage,
    setPageResult,
    reduceTotal,
  }
}
