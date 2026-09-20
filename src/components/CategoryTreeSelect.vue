<script setup>
import { computed } from 'vue'
import { flattenCategoryOptions, getCategoryPathLabel } from '../lib/utils'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '不選擇' },
  allowEmpty: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() => flattenCategoryOptions(props.categories))

const selectedLabel = computed(() => {
  if (!props.modelValue) return ''
  return getCategoryPathLabel(props.categories, props.modelValue)
})

function onChange(event) {
  emit('update:modelValue', event.target.value || '')
}
</script>

<template>
  <div>
    <select
      class="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
      :value="modelValue || ''"
      @change="onChange"
    >
      <option v-if="allowEmpty" value="">{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.id" :value="opt.id">
        {{ opt.label }}
      </option>
    </select>
    <p v-if="selectedLabel" class="mt-1 text-[11px] text-mute">路徑：{{ selectedLabel }}</p>
  </div>
</template>
