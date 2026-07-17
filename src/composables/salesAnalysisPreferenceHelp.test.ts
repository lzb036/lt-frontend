import { SALES_ANALYSIS_PREFERENCE_HELP } from './salesAnalysisPreferenceHelp'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const expectedKeys = [
  'defaultPeriodDays',
  'defaultRankingLimit',
  'defaultMetric',
  'defaultGrain',
  'answerDetailLevel',
  'prioritizeAdjustmentRisk',
  'showDataUpdatedAt',
  'showMetricDefinition',
  'customBusinessInstructions',
] as const

assert(
  JSON.stringify(Object.keys(SALES_ANALYSIS_PREFERENCE_HELP).sort())
    === JSON.stringify([...expectedKeys].sort()),
  'preference help keys should match every editable field',
)

for (const key of expectedKeys) {
  const content = SALES_ANALYSIS_PREFERENCE_HELP[key]
  assert(content.length >= 24, `${key} should have a useful explanation`)
}

assert(/最近|近期/.test(SALES_ANALYSIS_PREFERENCE_HELP.defaultPeriodDays), 'period help should explain vague dates')
assert(/前 10|返回/.test(SALES_ANALYSIS_PREFERENCE_HELP.defaultRankingLimit), 'ranking help should explain result count')
assert(/排序|指标/.test(SALES_ANALYSIS_PREFERENCE_HELP.defaultMetric), 'metric help should explain sorting')
assert(/按天|按周|按月/.test(SALES_ANALYSIS_PREFERENCE_HELP.defaultGrain), 'grain help should explain grouping')
assert(/简洁|标准|详细/.test(SALES_ANALYSIS_PREFERENCE_HELP.answerDetailLevel), 'detail help should explain response levels')
assert(/取消|退款|退货/.test(SALES_ANALYSIS_PREFERENCE_HELP.prioritizeAdjustmentRisk), 'risk help should explain adjustments')
assert(/更新时间/.test(SALES_ANALYSIS_PREFERENCE_HELP.showDataUpdatedAt), 'update help should explain timestamps')
assert(/有效销量/.test(SALES_ANALYSIS_PREFERENCE_HELP.showMetricDefinition), 'definition help should explain metrics')
assert(/安全约束/.test(SALES_ANALYSIS_PREFERENCE_HELP.customBusinessInstructions), 'custom help should explain safety boundaries')
