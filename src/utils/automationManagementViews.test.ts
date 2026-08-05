import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const globalStylesSource = readFileSync(
  resolve(sourceRoot, 'assets/main.css'),
  'utf8',
)
const listingSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AutoListingScheduleView.vue'),
  'utf8',
)
const listingDialogSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AutoListingScheduleCreateDialog.vue'),
  'utf8',
)
const manualListingDialogSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/ManualListingTaskCreateDialog.vue'),
  'utf8',
)
const deletionSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AutoDeletionManagementView.vue'),
  'utf8',
)
const fieldHelpTooltipSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/FieldHelpTooltip.vue'),
  'utf8',
)

function assertExternalActionToolbar(source: string, viewName: string) {
  const actionIndex = source.indexOf('<div class="head-actions">')
  const panelIndex = source.indexOf('<section class="work-panel">')
  const scheduledButtonIndex = source.indexOf('创建定时任务', actionIndex)
  const manualButtonIndex = source.indexOf('创建任务', scheduledButtonIndex)
  const refreshButtonIndex = source.indexOf('刷新', manualButtonIndex)

  if (
    actionIndex < 0
    || panelIndex <= actionIndex
    || scheduledButtonIndex < actionIndex
    || scheduledButtonIndex >= panelIndex
    || manualButtonIndex <= scheduledButtonIndex
    || manualButtonIndex >= panelIndex
    || refreshButtonIndex <= manualButtonIndex
    || refreshButtonIndex >= panelIndex
  ) {
    throw new Error(`${viewName} must place scheduled, manual, and refresh actions outside the work panel`)
  }
}

assertExternalActionToolbar(listingSource, 'auto listing management')
assertExternalActionToolbar(deletionSource, 'auto deletion management')

for (const contract of [
  "import AutoListingScheduleCreateDialog from './AutoListingScheduleCreateDialog.vue'",
  '@click="automaticCreateVisible = true"',
  '<AutoListingScheduleCreateDialog',
  'v-model="automaticCreateVisible"',
  '@created="handleCreated"',
]) {
  if (!listingSource.includes(contract)) {
    throw new Error(`missing auto listing scheduled-task contract: ${contract}`)
  }
}

for (const contract of [
  'api.createAutoListingSchedule({',
  'scheduleType: form.scheduleType',
  "weekday: form.scheduleType === 'weekly' ? form.weekday : null",
  "monthDay: form.scheduleType === 'monthly' ? form.monthDay : null",
  ':max="10000"',
]) {
  if (!listingDialogSource.includes(contract)) {
    throw new Error(`missing auto listing schedule dialog contract: ${contract}`)
  }
}

if (deletionSource.includes('class="task-toolbar"')) {
  throw new Error('auto deletion creation actions must not remain inside the work panel')
}

if (globalStylesSource.includes('.page-head .head-actions > .el-button:first-child')) {
  throw new Error('global styles must not hide the first page action button')
}

for (const contract of [
  'effect="dark"',
  '<QuestionFilled />',
  ':popper-style="{ maxWidth:',
]) {
  if (!fieldHelpTooltipSource.includes(contract)) {
    throw new Error(`missing field help tooltip contract: ${contract}`)
  }
}

for (const contract of [
  '<FieldHelpTooltip',
  '可用商品不足时按实际数量上架',
]) {
  if (!listingDialogSource.includes(contract) || !manualListingDialogSource.includes(contract)) {
    throw new Error(`missing auto listing field help contract: ${contract}`)
  }
}

for (const contract of [
  '<FieldHelpTooltip',
  '近一年有效销量为 0',
  '按上架时间从早到晚处理',
  '创建同步商品删除任务',
]) {
  if (!deletionSource.includes(contract)) {
    throw new Error(`missing auto deletion field help contract: ${contract}`)
  }
}
