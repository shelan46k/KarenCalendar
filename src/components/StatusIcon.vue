<script setup>
import { STATUS_META } from '../lib/utils'

defineProps({
  status: { type: String, required: true },
  size: { type: String, default: 'md' }
})

defineEmits(['click'])
</script>

<template>
  <button
    type="button"
    class="status-btn"
    :class="[STATUS_META[status]?.class, size === 'sm' ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]']"
    :title="STATUS_META[status]?.label"
    @click.stop="$emit('click')"
  >
    {{ STATUS_META[status]?.icon }}
  </button>
</template>
