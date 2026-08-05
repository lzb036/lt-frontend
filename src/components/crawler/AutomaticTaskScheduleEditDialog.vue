<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AutomaticTaskScheduleUpdatePayload,
  AutoListingSchedule,
  AutoListingScheduleType,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'

const props = defineProps<{
  task: AutoListingSchedule | null
  taskKind: 'listing' | 'deletion'
}>()

const emit = defineEmits<{
  updated: [task: AutoListingSchedule]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const formRef = shallowRef<FormInstance>()
const saving = shallowRef(false)
const form = reactive<AutomaticTaskScheduleUpdatePayload>({
  scheduleType: 'daily',
  scheduleTime: '09:00',
  weekday: 1,
  monthDay: 1,
  quantity: 50,
})
const rules: FormRules<AutomaticTaskScheduleUpdatePayload> = {
  scheduleType: [{ required: true, message: '请选择执行周期', trigger: 'change' }],
  scheduleTime: [{ required: true, message: '请选择执行时间', trigger: 'change' }],
  quantity: [{ required: true, message: '请填写任务数量', trigger: 'change' }],
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
const dialogTitle = computed(() => (
  props.taskKind === 'listing' ? '编辑自动上架任务' : '编辑自动删除任务'
))
const quantityLabel = computed(() => (
  props.taskKind === 'listing' ? '上架数量' : '删除数量'
))

watch(visible, (isVisible) => {
  if (!isVisible || !props.task) return
  form.scheduleType = (
    ['daily', 'weekly', 'monthly'].includes(props.task.scheduleType)
      ? props.task.scheduleType
      : 'daily'
  ) as AutoListingScheduleType
  form.scheduleTime = props.task.scheduleTime || '09:00'
  form.weekday = props.task.weekday || 1
  form.monthDay = props.task.monthDay || 1
  form.quantity = props.task.quantity
  formRef.value?.clearValidate()
})

async function submit() {
  if (!props.task) return
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const payload: AutomaticTaskScheduleUpdatePayload = {
      scheduleType: form.scheduleType,
      scheduleTime: form.scheduleTime,
      weekday: form.scheduleType === 'weekly' ? form.weekday : null,
      monthDay: form.scheduleType === 'monthly' ? form.monthDay : null,
      quantity: form.quantity,
    }
    const updated = props.taskKind === 'listing'
      ? await api.updateAutoListingSchedule(props.task.id, payload)
      : await api.updateAutoDeletionTask(props.task.id, payload)
    emit('updated', updated)
    visible.value = false
    ElMessage.success('自动任务已更新')
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '更新自动任务失败'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="540px"
    destroy-on-close
    append-to-body
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="任务店铺">
        <el-input
          :model-value="task?.storeAliasName || task?.storeName || ''"
          disabled
        />
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
        <el-input-number
          v-model="form.monthDay"
          :min="1"
          :max="31"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item label="执行时间" prop="scheduleTime">
        <el-time-picker
          v-model="form.scheduleTime"
          format="HH:mm"
          value-format="HH:mm"
          placeholder="选择执行时间"
        />
      </el-form-item>
      <el-form-item :label="quantityLabel" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="1"
          :max="10000"
          controls-position="right"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.full-control {
  width: 100%;
}
</style>
