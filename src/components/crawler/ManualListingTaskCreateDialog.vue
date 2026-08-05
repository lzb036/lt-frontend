<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

import { useCollectorApi } from '../../composables/useCollectorApi'
import type {
  AutoListingSchedule,
  ManualListingTaskPayload,
  StoreAccount,
} from '../../types/crawler'
import { toApiErrorMessage } from '../../utils/api'
import FieldHelpTooltip from './FieldHelpTooltip.vue'

const props = defineProps<{
  stores: StoreAccount[]
}>()

const emit = defineEmits<{
  created: [task: AutoListingSchedule]
}>()

const visible = defineModel<boolean>({ required: true })
const api = useCollectorApi()
const submitting = shallowRef(false)
const formRef = shallowRef<FormInstance>()
const form = reactive<ManualListingTaskPayload>({
  storeId: 0,
  quantity: 50,
  executionMode: 'immediate',
  executeAt: null,
})
const rules: FormRules<ManualListingTaskPayload> = {
  storeId: [{ required: true, message: '请选择上架店铺', trigger: 'change' }],
  quantity: [{ required: true, message: '请填写上架数量', trigger: 'change' }],
  executionMode: [{ required: true, message: '请选择执行方式', trigger: 'change' }],
  executeAt: [{ required: true, message: '请选择到期执行时间', trigger: 'change' }],
}
const executionModeOptions = [
  { label: '立即执行', value: 'immediate' },
  { label: '到期执行', value: 'scheduled' },
] as const
const availableStores = computed(
  () => props.stores.filter((store) => (
    store.enabled
    && Boolean(store.masked.rakutenServiceSecret)
    && Boolean(store.masked.rakutenLicenseKey)
  )),
)
const taskHelpText = computed(() => (
  form.executionMode === 'scheduled'
    ? '任务仍归类为手动任务，将在选择的日期和时间到达后执行一次。执行时按创建时间从早到晚选择已审核、尚未在目标店铺上架且通过上架检查的商品；可用商品不足时按实际数量上架。'
    : '任务仍归类为手动任务，创建后立即执行。执行时按创建时间从早到晚选择已审核、尚未在目标店铺上架且通过上架检查的商品；可用商品不足时按实际数量上架。'
))
const submitButtonText = computed(() => (
  form.executionMode === 'scheduled' ? '创建任务' : '创建并执行'
))

watch(visible, (isVisible) => {
  if (!isVisible) {
    return
  }
  form.storeId = availableStores.value[0]?.id || 0
  form.quantity = 50
  form.executionMode = 'immediate'
  form.executeAt = defaultExecuteAt()
  formRef.value?.clearValidate()
})

function defaultExecuteAt() {
  const value = new Date(Date.now() + 60 * 60 * 1000)
  value.setSeconds(0, 0)
  const pad = (part: number) => String(part).padStart(2, '0')
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `${pad(value.getHours())}:${pad(value.getMinutes())}:00`,
  ].join(' ')
}

function disablePastDate(value: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return value.getTime() < today.getTime()
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }
  if (
    form.executionMode === 'scheduled'
    && (
      !form.executeAt
      || new Date(form.executeAt.replace(' ', 'T')).getTime() <= Date.now()
    )
  ) {
    ElMessage.warning('到期执行时间必须晚于当前时间')
    return
  }
  submitting.value = true
  try {
    const task = await api.createManualListingTask({
      storeId: form.storeId,
      quantity: form.quantity,
      executionMode: form.executionMode,
      executeAt: form.executionMode === 'scheduled' ? form.executeAt : null,
    })
    emit('created', task)
    visible.value = false
    ElMessage.success(
      task.lastMessage
      || (form.executionMode === 'scheduled' ? '到期上架任务已创建' : '上架任务已创建'),
    )
  } catch (error) {
    ElMessage.error(toApiErrorMessage(error, '创建上架任务失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    width="520px"
    destroy-on-close
    append-to-body
  >
    <template #header>
      <div class="dialog-title-with-help">
        <span>创建任务</span>
        <FieldHelpTooltip
          label="创建任务"
          :content="taskHelpText"
        />
      </div>
    </template>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="上架店铺" prop="storeId">
        <el-select
          v-model="form.storeId"
          class="full-control"
          filterable
          placeholder="选择上架店铺"
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
          暂无可用店铺
        </span>
      </el-form-item>
      <el-form-item label="上架数量" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="1"
          :max="10000"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item label="执行方式" prop="executionMode">
        <el-segmented v-model="form.executionMode" :options="executionModeOptions" />
      </el-form-item>
      <el-form-item
        v-if="form.executionMode === 'scheduled'"
        label="执行时间"
        prop="executeAt"
      >
        <el-date-picker
          v-model="form.executeAt"
          class="full-control"
          type="datetime"
          format="YYYY/MM/DD HH:mm"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择到期执行日期和时间"
          :disabled-date="disablePastDate"
        />
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
        {{ submitButtonText }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.full-control {
  width: 100%;
}

.dialog-title-with-help {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-primary);
  font-size: var(--el-dialog-title-font-size);
  line-height: var(--el-dialog-font-line-height);
}

.field-hint {
  margin-left: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
