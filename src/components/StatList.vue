<script setup>
defineProps({
  done: { type: Number, default: 0 },
  inProgress: { type: Number, default: 0 },
  todo: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  showRatio: { type: Boolean, default: false }
})
</script>

<template>
  <div class="flex items-start justify-between gap-3">
    <div class="flex-1 space-y-0.5">
      <div class="stat-row">
        <span>已完成</span>
        <span class="font-semibold text-status-done">{{ done }}</span>
      </div>
      <div class="stat-row">
        <span>進行中</span>
        <span class="font-semibold text-status-progress">{{ inProgress }}</span>
      </div>
      <div class="stat-row">
        <span>未開始</span>
        <span class="font-semibold text-status-todo">{{ todo }}</span>
      </div>
      <div class="stat-row border-t border-line pt-1 font-medium text-ink">
        <span>合計</span>
        <span>{{ total }}</span>
      </div>
    </div>
    <div
      v-if="showRatio"
      class="rounded-xl bg-panel px-3 py-2 text-center text-sm font-semibold text-ink"
    >
      {{ done }}/{{ total }}
    </div>
  </div>
</template>
