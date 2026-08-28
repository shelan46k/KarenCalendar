<script setup>
import { computed, inject } from 'vue'
import {
  formatDisplayDate,
  formatTimeRange,
  isPlanTask,
  parseDateKey,
  resolveTaskColor,
  scheduleStyleFromColor,
  taskColumnDate,
  taskStartMoment,
  weekdayLabel
} from '../lib/utils'
import CollapsibleSection from './CollapsibleSection.vue'

const app = inject('calendarApp')

const selectedKey = computed(() => app.selectedKey.value)

const daySchedules = computed(() => {
  const key = selectedKey.value
  return app.store.tasks
    .filter((t) => !isPlanTask(t) && taskColumnDate(t) === key)
    .sort((a, b) => {
      const sa = taskStartMoment(a)?.getTime() ?? 0
      const sb = taskStartMoment(b)?.getTime() ?? 0
      return sa - sb
    })
})

const summaryText = computed(() => {
  const d = parseDateKey(selectedKey.value)
  const n = daySchedules.value.length
  return `${formatDisplayDate(d)} ${weekdayLabel(d)} · ${n} 項日程`
})

function onSelect(task) {
  app.jumpToTask(task)
}

function itemStyle(task) {
  return (
    scheduleStyleFromColor(resolveTaskColor(task, app.store.timerCategories)) || {
      borderColor: '#efc4d0',
      backgroundColor: '#fcecef'
    }
  )
}
</script>

<template>
  <CollapsibleSection id="day-schedules" title="當日日程" icon="clock" :default-open="true">
    <template #summary>{{ summaryText }}</template>

    <ul v-if="daySchedules.length" class="space-y-2">
      <li v-for="task in daySchedules" :key="task.id">
        <button
          type="button"
          class="flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:brightness-[0.98]"
          :style="itemStyle(task)"
          :title="task.title"
          @click="onSelect(task)"
        >
          <span
            class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold text-brand-deep"
          >日</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink">
              {{ task.title || '（未命名）' }}
            </span>
            <span class="mt-0.5 block text-[11px] font-medium text-ink/60">
              {{ formatTimeRange(task) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="text-sm text-mute">這天尚無日程紀錄</p>
  </CollapsibleSection>
</template>
