<script setup lang="ts">
import type {
  CollectionGenreExplicitPolicy,
  CollectionGenrePolicy,
} from '../../types/crawler'

const props = defineProps<{
  modelValue: CollectionGenreExplicitPolicy
  effectivePolicy: CollectionGenrePolicy
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [policy: CollectionGenreExplicitPolicy]
}>()

const options: Array<{ label: string; value: CollectionGenreExplicitPolicy }> = [
  { label: '继承上级', value: 'inherit' },
  { label: '允许采集', value: 'allow' },
  { label: '禁止采集', value: 'deny' },
]

function handleChange(value: CollectionGenreExplicitPolicy) {
  if (value !== props.modelValue) {
    emit('change', value)
  }
}
</script>

<template>
  <div class="policy-control">
    <el-select
      :model-value="modelValue"
      class="policy-select"
      :loading="loading"
      :disabled="loading"
      @change="handleChange"
    >
      <el-option
        v-for="option in options"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      />
    </el-select>
    <el-tag :type="effectivePolicy === 'allow' ? 'success' : 'danger'" effect="light">
      实际：{{ effectivePolicy === 'allow' ? '允许' : '禁止' }}
    </el-tag>
  </div>
</template>

<style scoped>
.policy-control {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.policy-select {
  width: 138px;
}
</style>
