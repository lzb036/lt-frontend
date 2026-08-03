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
})
const rules: FormRules<ManualListingTaskPayload> = {
  storeId: [{ required: true, message: '请选择上架店铺', trigger: 'change' }],
  quantity: [{ required: true, message: '请填写上架数量', trigger: 'change' }],
}
const availableStores = computed(
  () => props.stores.filter((store) => (
    store.enabled
    && Boolean(store.masked.rakutenServiceSecret)
    && Boolean(store.masked.rakutenLicenseKey)
  )),
)

watch(visible, (isVisible) => {
  if (!isVisible) {
    return
  }
  form.storeId = availableStores.value[0]?.id || 0
  form.quantity = 50
  formRef.value?.clearValidate()
})

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }
  submitting.value = true
  try {
    const task = await api.createManualListingTask({ ...form })
    emit('created', task)
    visible.value = false
    ElMessage.success(task.lastMessage || '上架任务已创建')
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
    title="创建任务"
    width="520px"
    destroy-on-close
    append-to-body
  >
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
        <span class="field-hint">创建后立即执行，商品不足时按实际数量上架</span>
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
        创建并执行
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
