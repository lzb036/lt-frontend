import type { App } from 'vue'

const bindings = new Map<
  HTMLElement,
  { refit: () => void; observer: MutationObserver }
>()
let documentObserver: MutationObserver | null = null
let refreshFrame = 0

const MIN_WIDTH = 76
const MAX_WIDTH = 240
const CONTENT_PADDING = 24

interface TableColumnConfig {
  label?: string
  className?: string
  width?: number | string
  realWidth?: number | string
}

interface TableStoreLike {
  states?: { columns?: TableColumnConfig[] }
  updateColumns?: () => void
}

interface TableInternalInstance {
  type?: { name?: string }
  exposed?: {
    store?: TableStoreLike
    doLayout?: () => void
  }
}

function findActionColumn(store: TableStoreLike): TableColumnConfig | null {
  const columns = store.states?.columns
  if (!columns) {
    return null
  }
  return (
    columns.find((item) => (
      (item.className || '').includes('table-action-column')
      || (item.label || '').trim() === '操作'
    )) || null
  )
}

function measureDeepestLeafWidths(element: HTMLElement): number {
  let max = 0
  for (const child of Array.from(element.children)) {
    const childElement = child as HTMLElement
    if (childElement.children.length > 0) {
      max = Math.max(max, measureDeepestLeafWidths(childElement))
      continue
    }
    max = Math.max(
      max,
      Math.ceil(childElement.scrollWidth),
      Math.ceil(childElement.getBoundingClientRect().width),
    )
  }
  return max
}

function measureColumnContentWidth(table: HTMLElement): number {
  const bodyTable = table.querySelector<HTMLTableElement>(
    '.el-table__body-wrapper table',
  )
  if (!bodyTable) {
    return 0
  }
  const headerTable = table.querySelector<HTMLTableElement>(
    '.el-table__header-wrapper table',
  )
  const headers = headerTable
    ? Array.from(headerTable.querySelectorAll('thead tr th'))
    : []
  const columnIndex = headers.findIndex((th) => (
    th.classList.contains('table-action-column')
    || (th.textContent || '').trim() === '操作'
  ))
  if (columnIndex < 0) {
    return 0
  }
  let max = 0
  for (const row of Array.from(bodyTable.querySelectorAll('tbody tr'))) {
    const cell = row.children[columnIndex] as HTMLElement | undefined
    if (!cell) {
      continue
    }
    const content = (cell.querySelector('.cell') || cell) as HTMLElement
    max = Math.max(max, measureDeepestLeafWidths(content))
  }
  return max
}

function fitTable(el: HTMLElement, store: TableStoreLike, doLayout?: () => void) {
  const column = findActionColumn(store)
  if (!column) {
    return
  }
  // 隐藏中的表格(未激活标签页)测量失真,等显示后再量
  if (el.getClientRects().length === 0) {
    return
  }
  const contentWidth = measureColumnContentWidth(el)
  const next = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, contentWidth + CONTENT_PADDING),
  )
  const current = Number(column.width || 0)
  if (Math.abs(current - next) <= 1 && Number(column.realWidth || 0) === next) {
    return
  }
  // 直接改列配置(width/realWidth 是 Element Plus 布局的真实来源),
  // 再让 store 重算并重排,LayoutObserver 按新配置写回 <col>,不会被回滚。
  column.width = next
  column.realWidth = next
  if (typeof store.updateColumns === 'function') {
    store.updateColumns()
  }
  if (typeof doLayout === 'function') {
    doLayout()
  }
}

export function installTableActionColumnAutoWidth(app: App) {
  app.mixin({
    mounted(this: unknown) {
      const internal = (this as { $?: TableInternalInstance }).$
      if (internal?.type?.name !== 'ElTable') {
        return
      }
      const exposed = internal.exposed
      const store = exposed?.store
      if (!store || !(this as { $el?: HTMLElement }).$el) {
        return
      }
      const el = (this as { $el: HTMLElement }).$el
      const doLayout = exposed?.doLayout
      const refit = () => {
        const binding = bindings.get(el)
        if (!binding) {
          return
        }
        fitTable(el, store, doLayout)
      }
      const observer = new MutationObserver(refit)
      observer.observe(el, {
        childList: true,
        subtree: true,
      })
      bindings.set(el, { refit, observer })
      window.requestAnimationFrame(refit)
    },
    unmounted(this: unknown) {
      const el = (this as { $el?: HTMLElement }).$el
      if (!el) {
        return
      }
      const binding = bindings.get(el)
      if (binding) {
        binding.observer.disconnect()
        bindings.delete(el)
      }
    },
  })

  if (documentObserver) {
    return
  }
  const refreshAll = () => {
    refreshFrame = 0
    for (const [el, binding] of bindings) {
      if (el.isConnected) {
        binding.refit()
      } else {
        binding.observer.disconnect()
        bindings.delete(el)
      }
    }
  }
  const scheduleRefreshAll = () => {
    if (refreshFrame) {
      return
    }
    refreshFrame = window.requestAnimationFrame(refreshAll)
  }
  // 标签页切换(display/class 变化)等场景下重新测量
  documentObserver = new MutationObserver(scheduleRefreshAll)
  documentObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })
  window.addEventListener('resize', scheduleRefreshAll, { passive: true })
}
