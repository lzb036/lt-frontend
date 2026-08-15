interface ActionColumnBinding {
  table: HTMLElement
  fittedWidth: number
  mutationObserver: MutationObserver
}

const bindings = new Map<HTMLElement, ActionColumnBinding>()
let documentObserver: MutationObserver | null = null
let refreshFrame = 0

const MIN_WIDTH = 76
const MAX_WIDTH = 240
const CONTENT_PADDING = 24

interface TableColumnConfig {
  id?: string
  label?: string
  className?: string
  width?: number | string
  realWidth?: number | string
  minWidth?: number | string
}

interface TableStoreLike {
  states?: { columns?: TableColumnConfig[] }
  updateColumns?: () => void
}

interface TableInstanceLike {
  exposed?: {
    store?: TableStoreLike
    doLayout?: () => void
  }
  proxy?: {
    store?: TableStoreLike
  }
}

function tableInstance(table: HTMLElement): TableInstanceLike | null {
  const instance = (table as unknown as { __vueParentComponent?: TableInstanceLike }).__vueParentComponent
  return instance || null
}

function actionColumnConfig(table: HTMLElement): {
  store: TableStoreLike
  column: TableColumnConfig
} | null {
  const instance = tableInstance(table)
  const exposed = instance?.exposed || instance?.proxy
  const store = exposed?.store
  const columns = store?.states?.columns
  if (!columns) {
    return null
  }
  const column = columns.find((item) => (
    (item.className || '').includes('table-action-column')
    || (item.label || '').trim() === '操作'
  ))
  if (!column) {
    return null
  }
  return { store, column }
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

function fitBinding(binding: ActionColumnBinding) {
  const config = actionColumnConfig(binding.table)
  if (!config) {
    return
  }
  // 隐藏中的表格(未激活的标签页)测量结果为 0,跳过,等显示后再量
  if (binding.table.getClientRects().length === 0) {
    return
  }
  const contentWidth = measureColumnContentWidth(binding.table)
  const next = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, contentWidth + CONTENT_PADDING),
  )
  const current = Number(config.column.width || 0)
  if (Math.abs(current - next) <= 1 && Number(config.column.realWidth || 0) === next) {
    return
  }
  // 直接改列配置(width/realWidth 是 Element Plus 布局的真实来源),
  // 再让 store 重算并重排;LayoutObserver 会按新配置写回 <col>,不会被回滚。
  config.column.width = next
  config.column.realWidth = next
  if (typeof config.store.updateColumns === 'function') {
    config.store.updateColumns()
  }
  const doLayout = tableInstance(binding.table)?.exposed?.doLayout
  if (typeof doLayout === 'function') {
    doLayout()
  }
  binding.fittedWidth = next
}

function unbindTable(table: HTMLElement, binding: ActionColumnBinding) {
  binding.mutationObserver.disconnect()
  bindings.delete(table)
}

function bindTable(table: HTMLElement) {
  const existing = bindings.get(table)
  if (existing) {
    fitBinding(existing)
    return
  }
  if (!actionColumnConfig(table)) {
    return
  }
  const binding: ActionColumnBinding = {
    table,
    fittedWidth: 0,
    mutationObserver: new MutationObserver(() => {
      const current = bindings.get(table)
      if (current) {
        fitBinding(current)
      }
    }),
  }
  binding.mutationObserver.observe(table, {
    childList: true,
    subtree: true,
  })
  bindings.set(table, binding)
  fitBinding(binding)
}

function cleanupRemovedTables() {
  for (const [table, binding] of bindings) {
    if (table.isConnected) {
      continue
    }
    unbindTable(table, binding)
  }
}

function refreshTables() {
  refreshFrame = 0
  cleanupRemovedTables()
  document.querySelectorAll<HTMLElement>('.el-table').forEach(bindTable)
}

function scheduleRefresh() {
  if (refreshFrame) {
    return
  }
  refreshFrame = window.requestAnimationFrame(refreshTables)
}

export function initializeTableActionColumnAutoWidth() {
  if (documentObserver) {
    return
  }
  scheduleRefresh()
  documentObserver = new MutationObserver(scheduleRefresh)
  documentObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })
  window.addEventListener('resize', scheduleRefresh, { passive: true })
}
