<script setup>
import { computed, inject } from 'vue'
import {
  monthMatrix,
  STATUS,
  toDateKey,
  weekdayLabel
} from '../lib/utils'
import SectionIcon from './SectionIcon.vue'

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

/** 有未完成事項（進行中／未開始）的日期 */
const incompleteDates = computed(() => {
  const set = new Set()
  for (const task of app.store.tasks) {
    if (task.status !== STATUS.done) set.add(task.date)
  }
  return set
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
      ? 'bg-status-todo text-white'
      : 'bg-brand text-white'
  }
  if (outside) {
    return incomplete ? 'bg-red-50 text-red-300' : 'text-slate-300'
  }
  if (incomplete) {
    return [
      'bg-red-50 font-semibold text-status-todo hover:bg-red-100',
      isToday ? 'ring-1 ring-status-todo/50' : ''
    ]
  }
  return [
    'hover:bg-panel',
    isToday ? 'ring-1 ring-brand/40' : ''
  ]
}

const selectClass =
  'rounded-lg border border-line bg-white px-1.5 py-1 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-brand'
</script>

<template>
  <section class="card-section">
    <div class="mb-3 flex items-center justify-between gap-2">
      <button
        type="button"
        class="rounded-lg border border-line px-2 py-1 text-sm hover:bg-soft"
        @click="prevMonth"
      >
        ‹
      </button>

      <div class="flex min-w-0 flex-1 items-center justify-center gap-1.5">
        <SectionIcon name="calendar" class-name="h-4 w-4 shrink-0 text-brand" />
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
        :title="hasIncomplete(day) ? `${weekdayLabel(day)}（有未完成）` : weekdayLabel(day)"
        @click="selectDay(day)"
      >
        {{ day.getDate() }}
      </button>
    </div>
  </section>
</template>
