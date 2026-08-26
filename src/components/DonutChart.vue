<script setup>
import { computed } from 'vue'

const props = defineProps({
  rate: { type: Number, default: 0 },
  label: { type: String, default: '本月完成率' }
})

const dash = computed(() => {
  const r = Math.max(0, Math.min(100, props.rate))
  const circ = 2 * Math.PI * 42
  return {
    circ,
    offset: circ - (r / 100) * circ
  }
})
</script>

<template>
  <div class="relative mx-auto h-28 w-28">
    <svg viewBox="0 0 100 100" class="h-full w-full -rotate-90">
      <circle cx="50" cy="50" r="42" fill="none" stroke="#e8eef2" stroke-width="10" />
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="#3b82a0"
        stroke-width="10"
        stroke-linecap="round"
        :stroke-dasharray="dash.circ"
        :stroke-dashoffset="dash.offset"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <p class="text-[10px] text-mute">{{ label }}</p>
      <p class="text-lg font-bold text-ink">{{ rate.toFixed(1) }}%</p>
    </div>
  </div>
</template>
