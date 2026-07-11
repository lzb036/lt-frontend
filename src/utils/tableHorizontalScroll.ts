interface TableScrollBinding {
  bar: HTMLDivElement
  spacer: HTMLDivElement
  scroller: HTMLElement
  resizeObserver: ResizeObserver
  handleBarScroll: () => void
  handleTableScroll: () => void
}

const bindings = new Map<HTMLElement, TableScrollBinding>()
let documentObserver: MutationObserver | null = null
let refreshFrame = 0

function findTableScroller(table: HTMLElement) {
  return table.querySelector<HTMLElement>(
    '.el-table__body-wrapper .el-scrollbar__wrap',
  )
}

function updateBinding(binding: TableScrollBinding) {
  const overflowWidth = binding.scroller.scrollWidth
  const viewportWidth = binding.scroller.clientWidth
  binding.spacer.style.width = `${overflowWidth}px`
  binding.bar.hidden = overflowWidth <= viewportWidth + 1
  if (!binding.bar.hidden && binding.bar.scrollLeft !== binding.scroller.scrollLeft) {
    binding.bar.scrollLeft = binding.scroller.scrollLeft
  }
}

function unbindTable(table: HTMLElement, binding: TableScrollBinding) {
  binding.resizeObserver.disconnect()
  binding.bar.removeEventListener('scroll', binding.handleBarScroll)
  binding.scroller.removeEventListener('scroll', binding.handleTableScroll)
  binding.bar.remove()
  bindings.delete(table)
}

function bindTable(table: HTMLElement) {
  const scroller = findTableScroller(table)
  if (!scroller || !table.parentElement) {
    return
  }
  const existing = bindings.get(table)
  if (existing?.scroller === scroller) {
    updateBinding(existing)
    return
  }
  if (existing) {
    unbindTable(table, existing)
  }

  const bar = document.createElement('div')
  bar.className = 'global-table-horizontal-scroll'
  bar.setAttribute('aria-label', '表格横向滚动条')
  const spacer = document.createElement('div')
  spacer.className = 'global-table-horizontal-scroll__spacer'
  bar.appendChild(spacer)
  table.parentElement.insertBefore(bar, table)

  let syncing = false
  const handleBarScroll = () => {
    if (syncing) {
      return
    }
    syncing = true
    scroller.scrollLeft = bar.scrollLeft
    syncing = false
  }
  const handleTableScroll = () => {
    if (syncing) {
      return
    }
    syncing = true
    bar.scrollLeft = scroller.scrollLeft
    syncing = false
  }

  bar.addEventListener('scroll', handleBarScroll, { passive: true })
  scroller.addEventListener('scroll', handleTableScroll, { passive: true })
  const resizeObserver = new ResizeObserver(() => {
    const binding = bindings.get(table)
    if (binding) {
      updateBinding(binding)
    }
  })
  resizeObserver.observe(table)
  resizeObserver.observe(scroller)

  const binding = {
    bar,
    spacer,
    scroller,
    resizeObserver,
    handleBarScroll,
    handleTableScroll,
  }
  bindings.set(table, binding)
  updateBinding(binding)
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

export function initializeTableHorizontalScroll() {
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
