interface ActionColumnBinding {
  table: HTMLElement
  columnIndex: number
  fittedWidth: number
  mutationObserver: MutationObserver
}

const bindings = new Map<HTMLElement, ActionColumnBinding>()
let documentObserver: MutationObserver | null = null
let refreshFrame = 0
let relayoutFrame = 0

const MIN_WIDTH = 76
const MAX_WIDTH = 240
const CONTENT_PADDING = 24

function findActionColumnIndex(table: HTMLElement): number {
  const headerTable = table.querySelector<HTMLTableElement>(
    '.el-table__header-wrapper table',
  )
  if (!headerTable) {
    return -1
  }
  const headers = Array.from(
    headerTable.querySelectorAll<HTMLTableCellElement>('thead th'),
  )
  return headers.findIndex((th) => (
    th.classList.contains('table-action-column')
    || (th.textContent || '').trim() === '操作'
  ))
}

function measureColumnContentWidth(table: HTMLElement, columnIndex: number): number {
  let max = 0
  const headerTable = table.querySelector<HTMLTableElement>(
    '.el-table__header-wrapper table',
  )
  if (headerTable) {
    for (const row of Array.from(headerTable.querySelectorAll('thead tr'))) {
      const cell = row.children[columnIndex] as HTMLElement | undefined
      if (cell) {
        const label = cell.querySelector('.cell')
        if (label) {
          max = Math.max(max, Math.ceil(label.scrollWidth))
        }
      }
    }
  }
  const bodyTables = table.querySelectorAll<HTMLTableElement>(
    '.el-table__body-wrapper table, .el-table__fixed-body-wrapper table',
  )
  for (const bodyTable of Array.from(bodyTables)) {
    for (const row of Array.from(bodyTable.querySelectorAll('tbody tr'))) {
      const cell = row.children[columnIndex] as HTMLElement | undefined
      if (!cell) {
        continue
      }
      const content = cell.querySelector('.cell')
      const target = content || cell
      let cellWidth = 0
      for (const child of Array.from(target.children)) {
        cellWidth = Math.max(cellWidth, Math.ceil((child as HTMLElement).scrollWidth))
      }
      if (cellWidth === 0) {
        cellWidth = Math.ceil(target.scrollWidth)
      }
      max = Math.max(max, cellWidth)
    }
  }
  return max
}

function columnCols(table: HTMLElement, columnIndex: number): HTMLTableColElement[] {
  const cols: HTMLTableColElement[] = []
  for (const colgroup of Array.from(table.querySelectorAll('colgroup'))) {
    const col = colgroup.children[columnIndex] as HTMLTableColElement | undefined
    if (col) {
      cols.push(col)
    }
  }
  // 固定列的克隆表只含固定列,操作列位于其第 0 列
  for (const fixedTable of Array.from(
    table.querySelectorAll<HTMLTableElement>('.el-table__fixed-right table'),
  )) {
    const col = fixedTable.querySelector<HTMLTableColElement>('colgroup col')
    if (col) {
      cols.push(col)
    }
  }
  return cols
}

function applyWidth(binding: ActionColumnBinding, width: number) {
  const { table, columnIndex } = binding
  const colWidth = String(width)
  for (const col of columnCols(table, columnIndex)) {
    if (col.width !== colWidth) {
      col.width = colWidth
    }
  }
  // 固定列克隆中的单元格可能带内联宽度,一并强制
  for (const fixedTable of Array.from(
    table.querySelectorAll<HTMLTableElement>('.el-table__fixed-right table'),
  )) {
    for (const cell of Array.from(fixedTable.querySelectorAll<HTMLTableCellElement>('th, td'))) {
      cell.style.width = `${width}px`
    }
    fixedTable.style.width = `${width}px`
  }
  const fixedRight = table.querySelector<HTMLElement>('.el-table__fixed-right')
  if (fixedRight) {
    fixedRight.style.width = `${width}px`
  }
  binding.fittedWidth = width
  scheduleRelayout()
}

function scheduleRelayout() {
  if (relayoutFrame) {
    return
  }
  relayoutFrame = window.requestAnimationFrame(() => {
    relayoutFrame = 0
    window.dispatchEvent(new Event('resize'))
  })
}

function fitBinding(binding: ActionColumnBinding) {
  const contentWidth = measureColumnContentWidth(binding.table, binding.columnIndex)
  const next = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, contentWidth + CONTENT_PADDING),
  )
  if (Math.abs(next - binding.fittedWidth) > 1) {
    applyWidth(binding, next)
  }
}

function unbindTable(table: HTMLElement, binding: ActionColumnBinding) {
  binding.mutationObserver.disconnect()
  bindings.delete(table)
}

function bindTable(table: HTMLElement) {
  const columnIndex = findActionColumnIndex(table)
  if (columnIndex < 0) {
    return
  }
  const existing = bindings.get(table)
  if (existing && existing.columnIndex === columnIndex) {
    fitBinding(existing)
    return
  }
  if (existing) {
    unbindTable(table, existing)
  }
  const binding: ActionColumnBinding = {
    table,
    columnIndex,
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
    attributes: true,
    attributeFilter: ['class', 'width'],
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
  })
  window.addEventListener('resize', scheduleRefresh, { passive: true })
}
