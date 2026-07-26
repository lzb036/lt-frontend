import {
  computed,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import { ElMessage } from 'element-plus'

import { useAuth } from './useAuth'
import { resolvePaginationPageSize } from '../utils/paginationPreferenceKeys'

export function usePaginationPreference(
  listKey: MaybeRefOrGetter<string>,
  pageSizes: readonly number[],
  defaultPageSize: number,
): Ref<number> {
  const { session, updatePaginationPreference } = useAuth()
  const resolvedListKey = computed(() => toValue(listKey))
  const initialPageSize = resolvePaginationPageSize(
    session.value?.paginationPreferences,
    resolvedListKey.value,
    pageSizes,
    defaultPageSize,
  )
  const pageSize = shallowRef(initialPageSize)
  let applyingStoredPreference = false

  watch(
    resolvedListKey,
    (nextListKey) => {
      applyingStoredPreference = true
      pageSize.value = resolvePaginationPageSize(
        session.value?.paginationPreferences,
        nextListKey,
        pageSizes,
        defaultPageSize,
      )
      applyingStoredPreference = false
    },
    { flush: 'sync' },
  )

  watch(pageSize, (nextPageSize, previousPageSize) => {
    if (
      applyingStoredPreference
      || nextPageSize === previousPageSize
      || !pageSizes.includes(nextPageSize)
    ) {
      return
    }
    void updatePaginationPreference(resolvedListKey.value, nextPageSize).catch(() => {
      ElMessage.error('分页数量保存失败，请稍后重试')
    })
  }, { flush: 'sync' })

  return pageSize
}
