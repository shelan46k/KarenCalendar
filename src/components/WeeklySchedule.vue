<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import {
  addDays,
  completionRate,
  formatDisplayDate,
  formatRate,
  STATUS,
  TIME_SLOTS,
  toDateKey,
  weekDates,
  weekdayLabel
} from '../lib/utils'
import SectionIcon from './SectionIcon.vue'
import StatusIcon from './StatusIcon.vue'

const app = inject('calendarApp')

const days = computed(() => weekDates(app.weekAnchor.value))
const editing = ref(null) // { date, timeSlot, title, status, id? }
const titleInput = ref(null)

function prevWeek() {
  app.weekAnchor.value = addDays(app.weekAnchor.value, -7)
}

function nextWeek() {
  app.weekAnchor.value = addDays(app.weekAnchor.value, 7)
}

function goThisWeek() {
  const now = new Date()
  app.weekAnchor.value = now
  app.selectedDate.value = now
  app.viewMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
}

function dayRate(date) {
  const key = toDateKey(date)
  return completionRate(app.tasksOn(key))
}

function openCell(date, timeSlot) {
  const key = toDateKey(date)
  const existing = app.taskAt(key, timeSlot)
  editing.value = {
    date: key,
    timeSlot,
    title: existing?.title || '',
    status: existing?.status || STATUS.todo,
    id: existing?.id || null
  }
  nextTick(() => titleInput.value?.focus())
}

function saveEdit() {
  if (!editing.value) return
  const { date, timeSlot, title, status, id } = editing.value
  if (!title.trim()) {
    if (id) {
      app.removeTask(id)
      app.persistNow('Delete empty task')
    }
  } else {
    app.upsertTask({ date, timeSlot, title: title.trim(), status })
    app.persistNow(`Upsert task: ${title.trim()}`)
  }
  editing.value = null
}

function deleteEdit() {
  if (!editing.value?.id) {
    editing.value = null
    return
  }
  app.removeTask(editing.value.id)
  app.persistNow('Delete task')
  editing.value = null
}

function onDragStart(event, task) {
  event.dataTransfer.setData('text/task-id', task.id)
  event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event, date, timeSlot) {
  event.preventDefault()
  const id = event.dataTransfer.getData('text/task-id')
  if (!id) return
  app.moveTask(id, toDateKey(date), timeSlot)
}

function allowDrop(event) {
  event.preventDefault()
}

watch(
  () => app.focusTaskId.value,
  (id) => {
    if (!id) return
    const task = app.store.tasks.find((t) => t.id === id)
    if (!task) {
      app.clearFocusTask()
      return
    }
    editing.value = {
      date: task.date,
      timeSlot: task.timeSlot,
      title: task.title || '',
      status: task.status || STATUS.todo,
      id: task.id
    }
    nextTick(() => {
      titleInput.value?.focus()
      app.clearFocusTask()
    })
  }
)
</script>

<template>
  <section class="card-section relative flex min-h-[70vh] flex-col overflow-hidden p-0 lg:min-h-[calc(100vh-7rem)]">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-4 py-3">
      <h2 class="flex items-center gap-1.5 text-base font-bold">
        <SectionIcon name="clock" class-name="h-4 w-4 text-brand" />
        每日計劃
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:bg-soft"
          @click="prevWeek"
        >
          上一週
        </button>
        <button
          type="button"
          class="rounded-lg border border-brand bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-deep"
          @click="goThisWeek"
        >
          本週
        </button>
        <button
          type="button"
          class="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:bg-soft"
          @click="nextWeek"
        >
          下一週
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <div class="min-w-[720px]">
        <!-- 表頭：日期與完成率 -->
        <div
          class="sticky top-0 z-20 grid border-b border-line bg-panel"
          style="grid-template-columns: 64px repeat(7, minmax(0, 1fr))"
        >
          <div class="border-r border-line px-2 py-2 text-center text-xs text-mute">時段</div>
          <div
            v-for="day in days"
            :key="toDateKey(day)"
            class="border-r border-line px-2 py-2 text-center last:border-r-0"
          >
            <p class="text-xs font-semibold text-ink">
              {{ formatDisplayDate(day) }}
            </p>
            <p class="text-[11px] text-mute">{{ weekdayLabel(day) }}</p>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                class="h-full rounded-full bg-brand transition-all"
                :style="{ width: `${dayRate(day)}%` }"
              />
            </div>
            <p class="mt-0.5 text-[10px] font-medium text-brand">{{ formatRate(dayRate(day)) }}</p>
          </div>
        </div>

        <!-- 時段格子 -->
        <div
          v-for="slot in TIME_SLOTS"
          :key="slot"
          class="grid"
          style="grid-template-columns: 64px repeat(7, minmax(0, 1fr))"
        >
          <div
            class="flex items-start justify-center border-b border-r border-line bg-soft/60 px-1 py-2 text-xs text-mute"
          >
            {{ Number(slot.slice(0, 2)) }}:00
          </div>
          <div
            v-for="day in days"
            :key="`${toDateKey(day)}-${slot}`"
            class="grid-cell"
            @click="openCell(day, slot)"
            @dragover="allowDrop"
            @drop="onDrop($event, day, slot)"
          >
            <div
              v-if="app.taskAt(toDateKey(day), slot)"
              class="task-chip"
              draggable="true"
              @dragstart="onDragStart($event, app.taskAt(toDateKey(day), slot))"
              @click.stop="openCell(day, slot)"
            >
              <span class="line-clamp-2 break-words">{{ app.taskAt(toDateKey(day), slot).title }}</span>
              <StatusIcon
                :status="app.taskAt(toDateKey(day), slot).status"
                size="sm"
                @click="app.cycleTaskStatus(app.taskAt(toDateKey(day), slot).id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="pointer-events-none absolute bottom-6 right-6 hidden select-none opacity-20 md:block">
      <div class="rotate-[-12deg] rounded-full border-4 border-brand px-4 py-2 text-sm font-bold text-brand">
        高效管理
      </div>
    </div>

    <!-- 編輯彈窗 -->
    <div
      v-if="editing"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="editing = null"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
        <h3 class="text-base font-bold">編輯任務</h3>
        <p class="mt-1 text-xs text-mute">{{ editing.date }} · {{ editing.timeSlot }}</p>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">任務名稱</span>
          <input
            ref="titleInput"
            v-model="editing.title"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            placeholder="例如：處理郵件"
            @keydown.enter.prevent="saveEdit"
          />
        </label>

        <div class="mt-4">
          <p class="mb-2 text-sm font-medium">狀態</p>
          <div class="flex gap-2">
            <button
              v-for="s in ['todo', 'in_progress', 'done']"
              :key="s"
              type="button"
              class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              :class="editing.status === s ? 'border-brand bg-brand-soft' : 'border-line'"
              @click="editing.status = s"
            >
              <StatusIcon :status="s" />
              {{ s === 'done' ? '已完成' : s === 'in_progress' ? '進行中' : '未開始' }}
            </button>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            class="rounded-xl border border-red-200 px-3 py-2 text-sm text-status-todo hover:bg-red-50"
            @click="deleteEdit"
          >
            刪除
          </button>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
              @click="editing = null"
            >
              取消
            </button>
            <button
              type="button"
              class="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
              @click="saveEdit"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
