import { ref } from 'vue'

export const DEFAULT_PAGE_SIZE = 30
export const DEFAULT_PAGE_SIZES = [30, 60, 90, 180]
export const DEFAULT_PAGINATION_LAYOUT = 'total, sizes, prev, pager, next, jumper'

export function useServerPagination() {
  const currentPage = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
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
    pageSizes: DEFAULT_PAGE_SIZES,
    paginationLayout: DEFAULT_PAGINATION_LAYOUT,
    total,
    resetPage,
    setPageResult,
    reduceTotal,
  }
}
