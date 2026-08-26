<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import {
  addDays,
  completionRate,
  formatDisplayDate,
  formatRate,
  SELECT_COLOR,
  selectBorderBgStyle,
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
/** null | { mode: 'picker', date, timeSlot } | { mode: 'form', date, timeSlot, title, status, id? } */
const dialog = ref(null)
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

function cellTasks(day, slot) {
  return app.tasksAt(toDateKey(day), slot)
}

function openCell(date, timeSlot) {
  const key = toDateKey(date)
  const list = app.tasksAt(key, timeSlot)
  if (!list.length) {
    openAddForm(key, timeSlot)
    return
  }
  dialog.value = { mode: 'picker', date: key, timeSlot }
}

function openAddForm(date, timeSlot) {
  dialog.value = {
    mode: 'form',
    date,
    timeSlot,
    title: '',
    status: STATUS.todo,
    id: null
  }
  nextTick(() => titleInput.value?.focus())
}

function openEditForm(task) {
  dialog.value = {
    mode: 'form',
    date: task.date,
    timeSlot: task.timeSlot,
    title: task.title || '',
    status: task.status || STATUS.todo,
    id: task.id
  }
  nextTick(() => titleInput.value?.focus())
}

function pickerTasks() {
  if (!dialog.value || dialog.value.mode !== 'picker') return []
  return app.tasksAt(dialog.value.date, dialog.value.timeSlot)
}

function closeDialog() {
  dialog.value = null
}

function saveEdit() {
  if (!dialog.value || dialog.value.mode !== 'form') return
  const { date, timeSlot, title, status, id } = dialog.value
  if (!title.trim()) {
    if (id) {
      app.removeTask(id)
      app.persistNow('Delete empty task')
    }
  } else {
    app.upsertTask({
      id: id || undefined,
      date,
      timeSlot,
      title: title.trim(),
      status
    })
    app.persistNow(`Upsert task: ${title.trim()}`)
  }
  closeDialog()
}

function deleteEdit() {
  if (!dialog.value?.id) {
    closeDialog()
    return
  }
  app.removeTask(dialog.value.id)
  app.persistNow('Delete task')
  closeDialog()
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
    openEditForm(task)
    nextTick(() => {
      app.clearFocusTask()
    })
  }
)
</script>

<template>
  <section class="card-section relative flex min-h-[70vh] flex-col overflow-hidden p-0 lg:min-h-[calc(100vh-7rem)]">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-4 py-3">
      <h2 class="flex items-center gap-1.5 text-base font-bold text-ink">
        <SectionIcon name="clock" class-name="h-4 w-4 text-brand-deep" />
        每日計劃
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-soft"
          @click="prevWeek"
        >
          上一週
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-1.5 text-sm font-semibold text-ink hover:brightness-[0.97]"
          :style="selectBorderBgStyle"
          @click="goThisWeek"
        >
          本週
        </button>
        <button
          type="button"
          class="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-soft"
          @click="nextWeek"
        >
          下一週
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      <div class="min-w-[720px]">
        <div
          class="sticky top-0 z-20 grid border-b border-line bg-panel"
          style="grid-template-columns: 64px repeat(7, minmax(0, 1fr))"
        >
          <div
            class="sticky left-0 z-30 border-r border-line bg-panel px-2 py-2 text-center text-xs font-semibold text-ink shadow-[2px_0_6px_rgba(15,23,42,0.06)]"
          >
            時段
          </div>
          <div
            v-for="day in days"
            :key="toDateKey(day)"
            class="border-r border-line px-2 py-2 text-center last:border-r-0"
          >
            <p class="text-xs font-bold text-ink">
              {{ formatDisplayDate(day) }}
            </p>
            <p class="text-[11px] font-medium text-ink/80">{{ weekdayLabel(day) }}</p>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-soft">
              <div
                class="h-full rounded-full transition-all"
                :style="{ width: `${dayRate(day)}%`, backgroundColor: SELECT_COLOR }"
              />
            </div>
            <p class="mt-0.5 text-[10px] font-semibold text-brand-deep">
              {{ formatRate(dayRate(day)) }}
            </p>
          </div>
        </div>

        <div
          v-for="slot in TIME_SLOTS"
          :key="slot"
          class="grid"
          style="grid-template-columns: 64px repeat(7, minmax(0, 1fr))"
        >
          <div
            class="sticky left-0 z-10 flex min-h-9 items-center justify-center border-b border-r border-line bg-soft px-1 text-[11px] font-semibold leading-none text-ink shadow-[2px_0_6px_rgba(15,23,42,0.06)]"
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
              v-if="cellTasks(day, slot).length"
              class="flex w-full flex-col gap-0.5 p-0.5"
            >
              <div
                v-for="task in cellTasks(day, slot)"
                :key="task.id"
                class="task-chip relative text-ink"
                draggable="true"
                :title="task.title"
                @dragstart="onDragStart($event, task)"
                @click.stop="openCell(day, slot)"
              >
                <span class="truncate font-medium text-ink">{{ task.title }}</span>
                <StatusIcon
                  :status="task.status"
                  size="sm"
                  @click="app.cycleTaskStatus(task.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 有計劃時：選新增或編輯 -->
    <div
      v-if="dialog?.mode === 'picker'"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="closeDialog"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-soft">
        <div class="border-b border-line px-4 py-3">
          <h3 class="text-base font-bold">選擇操作</h3>
          <p class="mt-1 text-xs font-medium text-ink/70">{{ dialog.date }} · {{ dialog.timeSlot }}</p>
        </div>

        <button
          type="button"
          class="block w-full border-b border-line px-4 py-3 text-left text-sm font-semibold text-brand-deep hover:bg-brand-soft/40"
          @click="openAddForm(dialog.date, dialog.timeSlot)"
        >
          ＋ 新增計劃
        </button>

        <p class="px-4 pt-3 text-xs font-semibold text-ink/70">編輯既有計劃</p>
        <div class="max-h-64 overflow-y-auto py-1">
          <button
            v-for="task in pickerTasks()"
            :key="task.id"
            type="button"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-soft"
            :title="task.title"
            @click="openEditForm(task)"
          >
            <StatusIcon :status="task.status" size="sm" />
            <span
              class="min-w-0 flex-1 truncate text-sm"
              :class="task.status === 'done' ? 'text-slate-400 line-through' : 'text-ink'"
            >{{ task.title || '（未命名）' }}</span>
          </button>
        </div>

        <button
          type="button"
          class="block w-full border-t border-line px-4 py-3 text-left text-sm text-mute hover:bg-soft"
          @click="closeDialog"
        >
          取消
        </button>
      </div>
    </div>

    <!-- 新增 / 編輯表單 -->
    <div
      v-if="dialog?.mode === 'form'"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="closeDialog"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
        <h3 class="text-base font-bold text-ink">{{ dialog.id ? '編輯任務' : '新增任務' }}</h3>
        <p class="mt-1 text-xs font-medium text-ink/70">{{ dialog.date }} · {{ dialog.timeSlot }}</p>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">任務名稱</span>
          <input
            ref="titleInput"
            v-model="dialog.title"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            placeholder="例如：處理郵件"
            @keydown.enter.prevent="saveEdit"
          />
        </label>

        <div class="mt-4">
          <p class="mb-2 text-sm font-medium">狀態</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in ['todo', 'in_progress', 'done']"
              :key="s"
              type="button"
              class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              :class="dialog.status === s ? 'border-brand bg-brand-soft' : 'border-line'"
              @click="dialog.status = s"
            >
              <StatusIcon :status="s" />
              {{ s === 'done' ? '已完成' : s === 'in_progress' ? '進行中' : '未開始' }}
            </button>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap justify-between gap-2">
          <button
            v-if="dialog.id"
            type="button"
            class="rounded-xl border border-red-200 px-3 py-2 text-sm text-status-todo hover:bg-red-50"
            @click="deleteEdit"
          >
            刪除
          </button>
          <div v-else />
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
              @click="closeDialog"
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
