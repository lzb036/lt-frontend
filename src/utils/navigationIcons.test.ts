import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shellSource = readFileSync(
  resolve(sourceRoot, 'components/crawler/AppShell.vue'),
  'utf8',
)

const iconContracts = [
  ["label: '采集管理'", 'icon: Collection'],
  ["label: '手动采集'", 'icon: Pointer'],
  ["label: '定时采集'", 'icon: AlarmClock'],
  ["label: '采集店铺'", 'icon: MapLocation'],
  ["label: '采集品类'", 'icon: CollectionTag'],
  ["label: '敏感词管理'", 'icon: NoSmoking'],
  ["label: '任务日志'", 'icon: Memo'],
  ["label: '上架任务'", 'icon: Upload'],
  ["label: '同步任务'", 'icon: Connection'],
  ["label: '标题优化任务'", 'icon: MagicStick'],
  ["label: '图片清理任务'", 'icon: DeleteFilled'],
  ["label: '订单获取记录'", 'icon: Files'],
  ["label: '商品管理'", 'icon: Goods'],
  ["label: '手动采集待审核'", 'icon: EditPen'],
  ["label: '定时采集待审核'", 'icon: Clock'],
  ["label: '已审核商品'", 'icon: DocumentChecked'],
  ["label: '已上架商品'", 'icon: GoodsFilled'],
  ["label: '店铺商品'", 'icon: Shop'],
  ["label: '异常商品'", 'icon: CircleCloseFilled'],
  ["label: '自动化管理'", 'icon: Management'],
  ["label: '自动上架管理'", 'icon: Promotion'],
  ["label: '自动删除管理'", 'icon: SoldOut'],
  ["label: '其他定时管理'", 'icon: Calendar'],
  ["label: '待清理图片'", 'icon: Picture'],
  ["label: '标题优化配置'", 'icon: SetUp'],
  ["label: '店铺管理'", 'icon: OfficeBuilding'],
  ["label: '用户管理'", 'icon: UserFilled'],
  ["label: '主题设置'", 'icon: Brush'],
] as const

for (const [labelContract, iconContract] of iconContracts) {
  const labelIndex = shellSource.indexOf(labelContract)
  const iconIndex = shellSource.indexOf(iconContract, labelIndex)
  if (labelIndex < 0 || iconIndex < 0 || iconIndex - labelIndex > 100) {
    throw new Error(`navigation icon mismatch: ${labelContract} -> ${iconContract}`)
  }
}
