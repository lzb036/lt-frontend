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
