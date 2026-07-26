import {
  computed,
  ref,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

import { usePaginationPreference } from './usePaginationPreference'

export const DEFAULT_PAGE_SIZE = 30
export const DEFAULT_PAGE_SIZES = [30, 60, 90, 180, 300]
export const DEFAULT_PAGINATION_LAYOUT = 'total, sizes, prev, pager, next, jumper'

export function useClientPagination<T>(
  items: Ref<readonly T[]> | ComputedRef<readonly T[]>,
  listKey: MaybeRefOrGetter<string>,
  pageSizes: readonly number[] = DEFAULT_PAGE_SIZES,
  defaultPageSize = DEFAULT_PAGE_SIZE,
) {
  const currentPage = ref(1)
  const pageSize = usePaginationPreference(listKey, pageSizes, defaultPageSize)

  const total = computed(() => items.value.length)

  const pagedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return items.value.slice(start, start + pageSize.value)
  })

  function clampCurrentPage() {
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
    }
  }

  function resetPage() {
    currentPage.value = 1
  }

  watch(total, clampCurrentPage)
  watch(pageSize, resetPage)

  return {
    currentPage,
    pageSize,
    pageSizes,
    paginationLayout: DEFAULT_PAGINATION_LAYOUT,
    total,
    pagedItems,
    resetPage,
  }
}
