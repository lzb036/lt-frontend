import type { SalesAnalysisSettingsPayload } from '../types/crawler'

type PreferenceHelpKey = keyof SalesAnalysisSettingsPayload

export const SALES_ANALYSIS_PREFERENCE_HELP: Record<PreferenceHelpKey, string> = {
  defaultPeriodDays: '当问题只说“最近”或“近期”且没有明确日期时使用。例如选择 30 天后，“最近卖得最好的商品”会按最近 30 天分析。',
  defaultRankingLimit: '当问题要求商品排行但没有说明数量时，默认返回这里设置的条数。例如设置为 10，会默认返回前 10 个商品。',
  defaultMetric: '当问题没有明确排序指标时使用。可以默认按有效销量、下单件数、预估有效销售额或订单数量分析。',
  defaultGrain: '当问题要求查看趋势但没有说明分组方式时使用。按天适合短期变化，按周和按月适合较长周期趋势。',
  answerDetailLevel: '控制回答的内容密度。简洁只给重点，标准包含主要数据和必要说明，详细会展示更多趋势、调整情况和口径。',
  prioritizeAdjustmentRisk: '开启后会优先说明取消、退款和退货对结果的影响。关闭不会改变销量计算，也不会隐藏必要的数据风险警告。',
  showDataUpdatedAt: '开启后会在回答中标注销量数据的最近更新时间，方便判断分析结果是否已经包含最新订单。',
  showMetricDefinition: '开启后会在回答中说明有效销量、预估有效销售额等指标的计算口径，但不会改变实际统计公式。',
  customBusinessInstructions: '填写当前账号长期关注的分析重点和表达偏好，例如优先关注滞销商品。不能覆盖店铺权限、统计口径或其他系统安全约束。',
}
