<script setup>
import { computed, inject } from 'vue'
import {
  formatHeaderMonth,
  monthMatrix,
  toDateKey,
  weekdayLabel
} from '../lib/utils'

const app = inject('calendarApp')

const matrix = computed(() =>
  monthMatrix(app.viewMonth.value.getFullYear(), app.viewMonth.value.getMonth())
)

function prevMonth() {
  const d = app.viewMonth.value
  app.viewMonth.value = new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

function nextMonth() {
  const d = app.viewMonth.value
  app.viewMonth.value = new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function selectDay(date) {
  app.selectedDate.value = date
  app.weekAnchor.value = date
  if (
    date.getMonth() !== app.viewMonth.value.getMonth() ||
    date.getFullYear() !== app.viewMonth.value.getFullYear()
  ) {
    app.viewMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
  }
}

function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b)
}

const today = new Date()
</script>

<template>
  <section class="card-section">
    <div class="mb-3 flex items-center justify-between">
      <button
        type="button"
        class="rounded-lg border border-line px-2 py-1 text-sm hover:bg-soft"
        @click="prevMonth"
      >
        ‹
      </button>
      <h2 class="text-base font-bold">{{ formatHeaderMonth(app.viewMonth.value) }}</h2>
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
        :class="{
          'text-slate-300': day.getMonth() !== app.viewMonth.value.getMonth(),
          'bg-brand text-white': isSameDay(day, app.selectedDate.value),
          'ring-1 ring-brand/40': isSameDay(day, today) && !isSameDay(day, app.selectedDate.value),
          'hover:bg-panel': !isSameDay(day, app.selectedDate.value)
        }"
        :title="weekdayLabel(day)"
        @click="selectDay(day)"
      >
        {{ day.getDate() }}
      </button>
    </div>
  </section>
</template>
