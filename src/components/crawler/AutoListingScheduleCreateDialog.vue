<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AutoListingSchedule,
  AutoListingSchedulePayload,
  AutoListingScheduleType,
  StoreAccount,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  stores: StoreAccount[]
  schedules: AutoListingSchedule[]
}>()

const emit = defineEmits<{
  created: [schedule: AutoListingSchedule]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const submitting = shallowRef(false)
const formRef = shallowRef<FormInstance>()
const form = reactive<AutoListingSchedulePayload>({
  storeId: 0,
  scheduleType: 'daily',
  scheduleTime: '09:00',
  weekday: 1,
  monthDay: 1,
  quantity: 50,
})
const rules: FormRules<AutoListingSchedulePayload> = {
  storeId: [{ required: true, message: '请选择上架店铺', trigger: 'change' }],
  scheduleType: [{ required: true, message: '请选择执行周期', trigger: 'change' }],
  scheduleTime: [{ required: true, message: '请选择执行时间', trigger: 'change' }],
  quantity: [{ required: true, message: '请填写上架数量', trigger: 'change' }],
}
const scheduleTypeOptions: Array<{ label: string; value: AutoListingScheduleType }> = [
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
]
const weekdayOptions = [
  { label: '星期一', value: 1 },
  { label: '星期二', value: 2 },
  { label: '星期三', value: 3 },
  { label: '星期四', value: 4 },
  { label: '星期五', value: 5 },
  { label: '星期六', value: 6 },
  { label: '星期日', value: 7 },
]
const occupiedStoreIds = computed(
  () => new Set(props.schedules.map((schedule) => schedule.storeId)),
)
const availableStores = computed(
  () => props.stores.filter((store) => (
    store.enabled
    && Boolean(store.masked.rakutenServiceSecret)
    && Boolean(store.masked.rakutenLicenseKey)
    && !occupiedStoreIds.value.has(store.id)
  )),
)

watch(visible, (isVisible) => {
  if (!isVisible) {
    return
  }
  resetForm()
})

function resetForm() {
  form.storeId = availableStores.value[0]?.id || 0
  form.scheduleType = 'daily'
  form.scheduleTime = '09:00'
  form.weekday = 1
  form.monthDay = 1
  form.quantity = 50
  formRef.value?.clearValidate()
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }
  submitting.value = true
  try {
    const schedule = await api.createAutoListingSchedule({
      storeId: form.storeId,
      scheduleType: form.scheduleType,
      scheduleTime: form.scheduleTime,
      weekday: form.scheduleType === 'weekly' ? form.weekday : null,
      monthDay: form.scheduleType === 'monthly' ? form.monthDay : null,
      quantity: form.quantity,
    })
    emit('created', schedule)
    visible.value = false
    ElMessage.success('自动上架任务已创建')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建自动上架任务失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="创建自动上架任务"
    width="560px"
    destroy-on-close
    append-to-body
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="上架店铺" prop="storeId">
        <el-select
          v-model="form.storeId"
          class="full-control"
          filterable
          placeholder="选择未创建任务的店铺"
          :disabled="availableStores.length < 1"
        >
          <el-option
            v-for="store in availableStores"
            :key="store.id"
            :label="store.aliasName || store.storeName"
            :value="store.id"
          />
        </el-select>
        <span v-if="availableStores.length < 1" class="field-hint">
          暂无可创建任务的店铺
        </span>
      </el-form-item>
      <el-form-item label="执行周期" prop="scheduleType">
        <el-segmented v-model="form.scheduleType" :options="scheduleTypeOptions" />
      </el-form-item>
      <el-form-item v-if="form.scheduleType === 'weekly'" label="执行星期">
        <el-select v-model="form.weekday" class="full-control">
          <el-option
            v-for="option in weekdayOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.scheduleType === 'monthly'" label="每月日期">
        <el-input-number v-model="form.monthDay" :min="1" :max="31" controls-position="right" />
        <span class="field-hint">短月份按当月最后一天执行</span>
      </el-form-item>
      <el-form-item label="执行时间" prop="scheduleTime">
        <el-time-picker
          v-model="form.scheduleTime"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择时间"
        />
      </el-form-item>
      <el-form-item label="上架数量" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="1"
          :max="10000"
          controls-position="right"
        />
        <span class="field-hint">商品不足时按实际可用数量上架</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="availableStores.length < 1"
        @click="submit"
      >
        创建任务
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.full-control {
  width: 100%;
}

.field-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
