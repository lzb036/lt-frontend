import { operatorManualSections, searchOperatorManualSections } from './operatorManual.ts'

if (operatorManualSections.length < 8) {
  throw new Error('expected the operator manual to cover all core workflows')
}

const replacementResults = searchOperatorManualSections('替换')
if (!replacementResults.some((section) => section.id === 'store-products')) {
  throw new Error('expected replacement search to find the store product workflow')
}

const genreResults = searchOperatorManualSections('品类')
if (!genreResults.some((section) => section.id === 'pending-review')) {
  throw new Error('expected genre search to find the pending review workflow')
}

const adminResults = searchOperatorManualSections('敏感词管理')
if (adminResults.length > 0) {
  throw new Error('expected the operator manual to exclude superadmin-only settings')
}

for (const [keyword, sectionId] of [
  ['近一年订单数', 'store-order-data'],
  ['销量从高到低', 'store-product-sales'],
  ['订单获取记录', 'order-sync-history'],
  ['成功记录保留', 'order-sync-settings'],
] as const) {
  const results = searchOperatorManualSections(keyword)
  if (!results.some((section) => section.id === sectionId)) {
    throw new Error(`expected ${keyword} search to find ${sectionId}`)
  }
}

for (const sectionId of ['order-sync-history', 'order-sync-settings']) {
  const section = operatorManualSections.find((item) => item.id === sectionId)
  if (section?.permission !== '超级管理员') {
    throw new Error(`expected ${sectionId} to be superadmin-only`)
  }
}
