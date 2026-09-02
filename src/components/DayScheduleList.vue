<script setup>
import { computed, inject, ref, watch } from 'vue'
import {
  formatDisplayDate,
  formatTimeRange,
  isPlanTask,
  parseDateKey,
  resolveTaskColor,
  scheduleStyleFromColor,
  selectBgStyle,
  taskOverlapsDate,
  taskOverlapsDateRange,
  taskStartMoment,
  toDateKey,
  weekDates,
  weekdayLabel
} from '../lib/utils'
import CollapsibleSection from './CollapsibleSection.vue'

const app = inject('calendarApp')

/** today | week | all | custom */
const scope = ref('today')
const customFrom = ref('')
const customTo = ref('')

const selectedKey = computed(() => app.selectedKey.value)

const weekDateKeys = computed(() =>
  weekDates(app.selectedDate.value).map((d) => toDateKey(d))
)

watch(selectedKey, (key) => {
  if (scope.value === 'custom') return
  customFrom.value = key
  customTo.value = key
})

watch(
  () => scope.value,
  (v) => {
    if (v === 'custom' && !customFrom.value) {
      customFrom.value = selectedKey.value
      customTo.value = selectedKey.value
    }
  },
  { immediate: true }
)

const filteredSchedules = computed(() => {
  let list = app.store.tasks.filter((t) => !isPlanTask(t))

  if (scope.value === 'today') {
    list = list.filter((t) => taskOverlapsDate(t, selectedKey.value))
  } else if (scope.value === 'week') {
    const keys = weekDateKeys.value
    list = list.filter((t) => keys.some((k) => taskOverlapsDate(t, k)))
  } else if (scope.value === 'custom') {
    if (customFrom.value && customTo.value) {
      list = list.filter((t) => taskOverlapsDateRange(t, customFrom.value, customTo.value))
    } else {
      list = []
    }
  }

  return list.sort((a, b) => {
    const sa = taskStartMoment(a)?.getTime() ?? 0
    const sb = taskStartMoment(b)?.getTime() ?? 0
    return sa - sb
  })
})

const scopeLabel = computed(() => {
  if (scope.value === 'today') return '當日'
  if (scope.value === 'week') return '當周'
  if (scope.value === 'custom') return '區間'
  return '全部'
})

const summaryText = computed(() => {
  return `${scopeLabel.value} ${filteredSchedules.value.length} 項日程`
})

function displayDate(task) {
  const start = taskStartMoment(task)
  const key = start ? toDateKey(start) : task.date
  const d = parseDateKey(key)
  return `${formatDisplayDate(d)} ${weekdayLabel(d)}`
}

function onSelect(task) {
  app.jumpToTask(task)
}

function chipClass(active) {
  return active ? 'font-semibold text-ink' : 'bg-soft text-mute hover:bg-panel'
}

function chipStyle(active) {
  return active ? selectBgStyle : undefined
}

function rowAccentStyle(task) {
  const color = resolveTaskColor(task, app.store.timerCategories)
  const styled = scheduleStyleFromColor(color)
  if (!styled) return { borderLeftColor: '#efc4d0' }
  return { borderLeftColor: styled.borderColor }
}
</script>

<template>
  <CollapsibleSection id="day-schedules" title="全部日程" icon="clock" :default-open="true">
    <template #summary>{{ summaryText }}</template>

    <div class="mb-3 flex flex-wrap items-center gap-1.5">
      <span class="text-[11px] text-mute">範圍</span>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(scope === 'today')"
        :style="chipStyle(scope === 'today')"
        @click="scope = 'today'"
      >
        當日
      </button>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(scope === 'week')"
        :style="chipStyle(scope === 'week')"
        @click="scope = 'week'"
      >
        當周
      </button>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(scope === 'all')"
        :style="chipStyle(scope === 'all')"
        @click="scope = 'all'"
      >
        全部
      </button>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(scope === 'custom')"
        :style="chipStyle(scope === 'custom')"
        @click="scope = 'custom'"
      >
        自定義
      </button>
    </div>

    <div v-if="scope === 'custom'" class="mb-3 grid grid-cols-2 gap-2">
      <label class="block">
        <span class="mb-1 block text-[11px] text-mute">起日</span>
        <input
          v-model="customFrom"
          type="date"
          class="w-full rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
      <label class="block">
        <span class="mb-1 block text-[11px] text-mute">迄日</span>
        <input
          v-model="customTo"
          type="date"
          class="w-full rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand"
        />
      </label>
    </div>

    <div v-if="filteredSchedules.length" class="max-h-64 space-y-1 overflow-y-auto pr-1">
      <button
        v-for="task in filteredSchedules"
        :key="task.id"
        type="button"
        class="flex w-full items-start gap-2 rounded-xl border-l-[3px] bg-soft/40 px-2 py-2 text-left transition hover:bg-soft"
        :style="rowAccentStyle(task)"
        :title="`${task.title || '（未命名）'} · ${displayDate(task)} · ${formatTimeRange(task)}`"
        @click="onSelect(task)"
      >
        <span
          class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/90 text-[10px] font-bold text-brand-deep shadow-sm"
        >日</span>
        <span class="min-w-0 flex-1">
          <p class="truncate text-sm text-ink">
            {{ task.title || '（未命名）' }}
          </p>
          <p class="mt-0.5 text-[11px] text-mute">
            {{ displayDate(task) }} · {{ formatTimeRange(task) }}
          </p>
        </span>
      </button>
    </div>
    <p v-else class="text-sm text-mute">沒有符合的日程</p>
  </CollapsibleSection>
</template>
