<script setup>
import { computed, inject } from 'vue'
import {
  formatDisplayDate,
  isPlanTask,
  monthMatrix,
  SELECT_COLOR,
  selectBgStyle,
  STATUS,
  toDateKey,
  weekdayLabel
} from '../lib/utils'
import CollapsibleSection from './CollapsibleSection.vue'

const app = inject('calendarApp')

const today = new Date()
const currentYear = today.getFullYear()

const yearOptions = computed(() => {
  const y = app.viewMonth.value.getFullYear()
  const start = Math.min(currentYear - 5, y - 2)
  const end = Math.max(currentYear + 5, y + 2)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

const monthOptions = [
  { value: 0, label: '01 月' },
  { value: 1, label: '02 月' },
  { value: 2, label: '03 月' },
  { value: 3, label: '04 月' },
  { value: 4, label: '05 月' },
  { value: 5, label: '06 月' },
  { value: 6, label: '07 月' },
  { value: 7, label: '08 月' },
  { value: 8, label: '09 月' },
  { value: 9, label: '10 月' },
  { value: 10, label: '11 月' },
  { value: 11, label: '12 月' }
]

const selectedYear = computed(() => app.viewMonth.value.getFullYear())
const selectedMonth = computed(() => app.viewMonth.value.getMonth())

const matrix = computed(() =>
  monthMatrix(selectedYear.value, selectedMonth.value)
)

const incompleteDates = computed(() => {
  const set = new Set()
  for (const task of app.store.tasks) {
    if (isPlanTask(task) && task.status !== STATUS.done) set.add(task.date)
  }
  return set
})

const incompleteInViewMonth = computed(() => {
  const prefix = `${selectedYear.value}-${String(selectedMonth.value + 1).padStart(2, '0')}`
  let n = 0
  for (const d of incompleteDates.value) {
    if (d.startsWith(prefix)) n += 1
  }
  return n
})

const summaryText = computed(() => {
  const y = selectedYear.value
  const m = String(selectedMonth.value + 1).padStart(2, '0')
  const selected = formatDisplayDate(app.selectedDate.value)
  const inc = incompleteInViewMonth.value
  return `${y}/${m} · 已選 ${selected}${inc ? ` · ${inc} 天有未完成` : ''}`
})

function setViewMonth(year, month) {
  app.viewMonth.value = new Date(year, month, 1)
}

function onYearChange(event) {
  setViewMonth(Number(event.target.value), selectedMonth.value)
}

function onMonthChange(event) {
  setViewMonth(selectedYear.value, Number(event.target.value))
}

function prevMonth() {
  const d = app.viewMonth.value
  setViewMonth(d.getFullYear(), d.getMonth() - 1)
}

function nextMonth() {
  const d = app.viewMonth.value
  setViewMonth(d.getFullYear(), d.getMonth() + 1)
}

function selectDay(date) {
  app.selectedDate.value = date
  app.weekAnchor.value = date
  if (
    date.getMonth() !== app.viewMonth.value.getMonth() ||
    date.getFullYear() !== app.viewMonth.value.getFullYear()
  ) {
    setViewMonth(date.getFullYear(), date.getMonth())
  }
}

function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b)
}

function hasIncomplete(day) {
  return incompleteDates.value.has(toDateKey(day))
}

function dayClass(day) {
  const outside = day.getMonth() !== app.viewMonth.value.getMonth()
  const selected = isSameDay(day, app.selectedDate.value)
  const incomplete = hasIncomplete(day)
  const isToday = isSameDay(day, today)

  if (selected) {
    return incomplete
      ? 'bg-status-todo font-semibold text-white'
      : 'font-semibold text-ink'
  }
  if (outside) {
    return incomplete ? 'bg-red-50 text-red-300' : 'text-slate-300'
  }
  if (incomplete) {
    return [
      'bg-red-50 font-semibold text-status-todo hover:bg-red-100',
      isToday ? 'ring-1 ring-status-todo/40' : ''
    ]
  }
  return ['hover:bg-panel', isToday ? 'font-semibold text-ink' : '']
}

function dayStyle(day) {
  const selected = isSameDay(day, app.selectedDate.value)
  const incomplete = hasIncomplete(day)
  const isToday = isSameDay(day, today)

  if (selected && !incomplete) return selectBgStyle
  if (!selected && isToday && !incomplete) {
    return { boxShadow: `inset 0 0 0 1.5px ${SELECT_COLOR}` }
  }
  return undefined
}

const selectClass =
  'rounded-lg border border-line bg-white px-1.5 py-1 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-accent'
</script>

<template>
  <CollapsibleSection id="calendar" title="日曆" icon="calendar" :default-open="true">
    <template #summary>{{ summaryText }}</template>

    <div class="mb-3 flex items-center justify-between gap-2">
      <button
        type="button"
        class="rounded-lg border border-line px-2 py-1 text-sm hover:bg-soft"
        @click="prevMonth"
      >
        ‹
      </button>

      <div class="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        <select
          :value="selectedYear"
          :class="selectClass"
          aria-label="選擇年份"
          @change="onYearChange"
        >
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
        <select
          :value="selectedMonth"
          :class="selectClass"
          aria-label="選擇月份"
          @change="onMonthChange"
        >
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">
            {{ m.label }}
          </option>
        </select>
      </div>

      <button
        type="button"
        class="rounded-lg border border-line px-2 py-1 text-sm hover:bg-soft"
        @click="nextMonth"
      >
        ›
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1 text-center text-[11px] text-mute">
      <div v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">{{ w }}</div>
    </div>
    <div class="mt-1 grid grid-cols-7 gap-1">
      <button
        v-for="(day, idx) in matrix.flat()"
        :key="idx"
        type="button"
        class="aspect-square rounded-lg text-sm transition"
        :class="dayClass(day)"
        :style="dayStyle(day)"
        :title="hasIncomplete(day) ? `${weekdayLabel(day)}（有未完成）` : weekdayLabel(day)"
        @click="selectDay(day)"
      >
        {{ day.getDate() }}
      </button>
    </div>
  </CollapsibleSection>
</template>
