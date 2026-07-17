import type {
  SalesAnalysisMessage,
  SalesAnalysisSettings,
} from '../types/crawler'
import {
  applySalesAnalysisStreamError,
  createSalesAnalysisQuickQuestions,
  resolveSalesAnalysisCompletedMessage,
  restoreSalesAnalysisRetryQuestion,
  salesAnalysisMessageErrorText,
  salesAnalysisMessageIsError,
  salesAnalysisRetryQuestion,
} from './salesAnalysisHelpers.ts'

const failedPresentation = applySalesAnalysisStreamError(
  {
    question: '销量排行',
    status: '正在整理结论。',
    answer: '不应继续显示的成功答案',
    error: '',
    tools: [
      {
        toolName: 'get_product_sales_ranking',
        label: '商品销量排行',
        arguments: {},
        status: 'completed' as const,
        result: { rows: [{ effectiveUnits: 10 }] },
      },
    ],
  },
  'AI 回答未通过事实校验。',
)

if (
  failedPresentation.answer !== ''
  || failedPresentation.tools.length !== 0
  || failedPresentation.error !== 'AI 回答未通过事实校验。'
) {
  throw new Error('expected stream errors to clear successful answer and result presentation')
}

const completedMessage = {
  id: 8,
  conversationId: 3,
  question: 'test',
  answer: 'completed',
  toolName: '',
  toolArguments: [],
  resultSummary: [],
  modelName: '',
  storeScope: [1],
  statisticsWindow: {},
  status: 'completed',
  errorCode: '',
  errorMessage: '',
} satisfies SalesAnalysisMessage

if (resolveSalesAnalysisCompletedMessage(completedMessage, true) !== null) {
  throw new Error('expected a stream error to suppress fallback completion')
}
if (resolveSalesAnalysisCompletedMessage(completedMessage, false) !== completedMessage) {
  throw new Error('expected a successful stream to preserve its completed message')
}

const failedMessage: SalesAnalysisMessage = {
  ...completedMessage,
  status: 'error',
  answer: '',
  errorCode: 'answer_validation_failed',
  errorMessage: '回答未通过事实校验。',
}

if (!salesAnalysisMessageIsError(failedMessage)) {
  throw new Error('expected persisted error status to identify failed history')
}
if (salesAnalysisMessageErrorText(failedMessage) !== '回答未通过事实校验。') {
  throw new Error('expected persisted history to display the controlled error message')
}
if (
  salesAnalysisRetryQuestion('最近 30 天销量排行\n\n店铺ID: 12')
  !== '最近 30 天销量排行'
) {
  throw new Error('expected retry to restore the original visible question without store routing metadata')
}
const retryComposer = { value: '' }
let retrySendCalls = 0
restoreSalesAnalysisRetryQuestion(
  retryComposer,
  '最近 30 天销量排行\n\n店铺ID: 12',
)
if (retryComposer.value !== '最近 30 天销量排行' || retrySendCalls !== 0) {
  throw new Error('expected retry action to restore the composer without auto-send')
}
void retrySendCalls

const settings: SalesAnalysisSettings = {
  defaultPeriodDays: 60,
  defaultRankingLimit: 25,
  defaultMetric: 'effectiveSalesAmount',
  defaultGrain: 'week',
  answerDetailLevel: 'standard',
  prioritizeAdjustmentRisk: true,
  showDataUpdatedAt: true,
  showMetricDefinition: true,
  customBusinessInstructions: '',
}
const quickQuestions = createSalesAnalysisQuickQuestions(settings)

for (const expectedText of [
  '最近 60 天预估有效销售额最高的 25 个商品',
  '最近 60 天预估有效销售额和上一个同期相比怎么样',
  '最近 60 天没有有效销量的上架商品',
  '最近 60 天哪些商品退款退货影响最大',
  '查看某个商品最近 60 天按周的预估有效销售额趋势',
]) {
  if (!quickQuestions.includes(expectedText)) {
    throw new Error(`expected settings-derived quick question: ${expectedText}`)
  }
}
