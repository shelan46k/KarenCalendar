<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  addDays,
  clampDuration,
  completionRate,
  formatDisplayDate,
  formatRate,
  formatTimeRange,
  isPlanTask,
  layoutDayOverlaps,
  maxDurationFrom,
  SELECT_COLOR,
  selectBgStyle,
  selectBorderBgStyle,
  slotIndex,
  STATUS,
  TASK_KIND,
  TASK_KIND_META,
  taskDuration,
  TIME_SLOTS,
  toDateKey,
  weekDates,
  weekdayLabel
} from '../lib/utils'
import SectionIcon from './SectionIcon.vue'
import StatusIcon from './StatusIcon.vue'

const app = inject('calendarApp')

const days = computed(() => weekDates(app.weekAnchor.value))
/**
 * null
 * | { mode: 'picker', date, timeSlot }
 * | { mode: 'kind-pick', purpose: 'add'|'drop-task'|'drop-todo', date, timeSlot, taskId?, todoId?, title? }
 * | { mode: 'form', date, timeSlot, title, status, kind, id? }
 */
const dialog = ref(null)
const titleInput = ref(null)
/** 'all' | 'plan' | 'schedule' */
const viewFilter = ref('all')
/** 目前拖曳經過的時段：`${dateKey}|${timeSlot}` */
const dropTarget = ref(null)
/** 拖曳中隱藏既有項目，讓落點格可接收事件 */
const isDragging = ref(false)
let dragHideTimer = null

function cellKey(day, slot) {
  return `${toDateKey(day)}|${slot}`
}

function isDropTarget(day, slot) {
  return dropTarget.value === cellKey(day, slot)
}

function clearDropTarget() {
  dropTarget.value = null
}

/** 等瀏覽器完成 dragstart 後再隱藏，避免拖曳被立刻取消 */
function beginDrag() {
  if (dragHideTimer != null) clearTimeout(dragHideTimer)
  dragHideTimer = setTimeout(() => {
    isDragging.value = true
    dragHideTimer = null
  }, 20)
}

function endDrag() {
  if (dragHideTimer != null) {
    clearTimeout(dragHideTimer)
    dragHideTimer = null
  }
  isDragging.value = false
  clearDropTarget()
}

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

const weekDateKeys = computed(() => days.value.map((d) => toDateKey(d)))

/** 本週要畫在格子上的項目（跨時段 + 重疊並排） */
const weekBlocks = computed(() => {
  const keySet = new Set(weekDateKeys.value)
  let list = app.store.tasks.filter((t) => keySet.has(t.date))
  if (viewFilter.value === 'plan') list = list.filter(isPlanTask)
  else if (viewFilter.value === 'schedule') list = list.filter((t) => !isPlanTask(t))

  const byDay = new Map()
  for (const task of list) {
    if (!byDay.has(task.date)) byDay.set(task.date, [])
    byDay.get(task.date).push(task)
  }

  const layouts = new Map()
  for (const [date, dayTasks] of byDay) {
    layouts.set(date, layoutDayOverlaps(dayTasks))
  }

  return list
    .map((task) => {
      const dayIdx = weekDateKeys.value.indexOf(task.date)
      const startIdx = slotIndex(task.timeSlot)
      if (dayIdx < 0 || startIdx < 0) return null
      const duration = clampDuration(task.timeSlot, taskDuration(task))
      const layout = layouts.get(task.date)?.get(task.id) || { lane: 0, lanes: 1 }
      const { lane, lanes } = layout
      const gap = 3
      return {
        task,
        style: {
          gridColumn: String(dayIdx + 2),
          gridRow: `${startIdx + 1} / span ${duration}`,
          width: `calc(${100 / lanes}% - ${gap}px)`,
          marginLeft: `calc(${(100 / lanes) * lane}% + ${gap / 2}px)`,
          justifySelf: 'start',
          alignSelf: 'stretch'
        }
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.task.date !== b.task.date) return a.task.date.localeCompare(b.task.date)
      return slotIndex(a.task.timeSlot) - slotIndex(b.task.timeSlot)
    })
})

function durationOptions(startSlot) {
  const max = maxDurationFrom(startSlot)
  return Array.from({ length: max }, (_, i) => {
    const h = i + 1
    return {
      value: h,
      label:
        h <= 1
          ? '1 小時'
          : `${h} 小時（${formatTimeRange({ timeSlot: startSlot, duration: h })}）`
    }
  })
}

function openCell(date, timeSlot) {
  const key = toDateKey(date)
  const list = app.tasksAt(key, timeSlot)
  if (!list.length) {
    openKindPick({ purpose: 'add', date: key, timeSlot })
    return
  }
  dialog.value = { mode: 'picker', date: key, timeSlot }
}

function openKindPick(payload) {
  dialog.value = {
    mode: 'kind-pick',
    kind: TASK_KIND.plan,
    duration: 1,
    ...payload
  }
}

function chooseKind(kind) {
  if (!dialog.value || dialog.value.mode !== 'kind-pick') return
  const { purpose, date, timeSlot, taskId } = dialog.value

  if (purpose === 'add') {
    openAddForm(date, timeSlot, kind)
    return
  }

  if (purpose === 'drop-task' && taskId) {
    app.moveTask(taskId, date, timeSlot, kind)
    closeDialog()
  }
}

function confirmDropTodo() {
  if (!dialog.value || dialog.value.mode !== 'kind-pick') return
  if (dialog.value.purpose !== 'drop-todo' || !dialog.value.todoId) return
  const { date, timeSlot, todoId, kind, duration } = dialog.value
  app.placeTodo(todoId, date, timeSlot, kind || TASK_KIND.plan, duration || 1)
  closeDialog()
}

function openAddForm(date, timeSlot, kind = TASK_KIND.plan) {
  dialog.value = {
    mode: 'form',
    date,
    timeSlot,
    title: '',
    status: STATUS.todo,
    kind,
    duration: 1,
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
    kind: isPlanTask(task) ? TASK_KIND.plan : TASK_KIND.schedule,
    duration: clampDuration(task.timeSlot, taskDuration(task)),
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
  const { date, timeSlot, title, status, kind, duration, id } = dialog.value
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
      status,
      kind,
      duration
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
  beginDrag()
}

function onDragOver(event, day, slot) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dropTarget.value = cellKey(day, slot)
}

function onDragEnter(event, day, slot) {
  event.preventDefault()
  dropTarget.value = cellKey(day, slot)
}

function onDragLeave(event, day, slot) {
  const related = event.relatedTarget
  if (related && event.currentTarget.contains(related)) return
  if (dropTarget.value === cellKey(day, slot)) {
    dropTarget.value = null
  }
}

function onDrop(event, date, timeSlot) {
  event.preventDefault()
  endDrag()
  const taskId = event.dataTransfer.getData('text/task-id')
  const todoId = event.dataTransfer.getData('text/todo-id')
  const key = toDateKey(date)

  if (todoId) {
    const todo = app.store.todos.find((t) => t.id === todoId)
    openKindPick({
      purpose: 'drop-todo',
      date: key,
      timeSlot,
      todoId,
      title: todo?.title || ''
    })
    return
  }

  if (taskId) {
    const task = app.store.tasks.find((t) => t.id === taskId)
    openKindPick({
      purpose: 'drop-task',
      date: key,
      timeSlot,
      taskId,
      title: task?.title || ''
    })
  }
}

function onDragEnd() {
  endDrag()
}

function chipClass(active) {
  return active ? 'font-semibold text-ink' : 'bg-white text-ink/80 hover:bg-soft'
}

function chipStyle(active) {
  return active ? selectBgStyle : undefined
}

function kindLabel(task) {
  return isPlanTask(task) ? TASK_KIND_META.plan.label : TASK_KIND_META.schedule.label
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

onMounted(() => {
  window.addEventListener('dragstart', beginDrag)
  window.addEventListener('dragend', onDragEnd)
})

onUnmounted(() => {
  window.removeEventListener('dragstart', beginDrag)
  window.removeEventListener('dragend', onDragEnd)
})
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

    <div class="flex flex-wrap items-center gap-1.5 border-b border-line bg-white px-4 py-2">
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(viewFilter === 'all')"
        :style="chipStyle(viewFilter === 'all')"
        @click="viewFilter = 'all'"
      >
        全部
      </button>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(viewFilter === 'plan')"
        :style="chipStyle(viewFilter === 'plan')"
        @click="viewFilter = 'plan'"
      >
        計劃
      </button>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
        :class="chipClass(viewFilter === 'schedule')"
        :style="chipStyle(viewFilter === 'schedule')"
        @click="viewFilter = 'schedule'"
      >
        日程
      </button>
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
          class="relative grid"
          :class="{ 'schedule-is-dragging': isDragging }"
          style="grid-template-columns: 64px repeat(7, minmax(0, 1fr)); grid-template-rows: repeat(24, minmax(2.25rem, auto))"
        >
          <template v-for="(slot, si) in TIME_SLOTS" :key="`label-${slot}`">
            <div
              class="sticky left-0 z-10 flex items-center justify-center border-b border-r border-line bg-soft px-1 text-[11px] font-semibold leading-none text-ink shadow-[2px_0_6px_rgba(15,23,42,0.06)]"
              :style="{ gridColumn: 1, gridRow: si + 1 }"
            >
              {{ Number(slot.slice(0, 2)) }}:00
            </div>
          </template>

          <template v-for="(slot, si) in TIME_SLOTS" :key="`row-${slot}`">
            <div
              v-for="(day, di) in days"
              :key="`${toDateKey(day)}-${slot}`"
              class="grid-cell"
              :class="isDropTarget(day, slot) ? 'grid-cell-drop-target' : ''"
              :style="{ gridColumn: di + 2, gridRow: si + 1 }"
              @click="openCell(day, slot)"
              @dragenter="onDragEnter($event, day, slot)"
              @dragover="onDragOver($event, day, slot)"
              @dragleave="onDragLeave($event, day, slot)"
              @drop="onDrop($event, day, slot)"
            />
          </template>

          <div
            v-for="block in weekBlocks"
            :key="block.task.id"
            class="task-span z-[5] m-0.5 flex min-h-0 flex-col gap-0.5"
            :style="block.style"
          >
            <div
              class="task-chip relative h-full min-h-8 flex-1 text-ink"
              :class="isPlanTask(block.task) ? 'task-chip-plan' : 'task-chip-schedule'"
              draggable="true"
              :title="`${kindLabel(block.task)} · ${block.task.title} · ${formatTimeRange(block.task)}`"
              @dragstart="onDragStart($event, block.task)"
              @dragend="onDragEnd"
              @click.stop="openEditForm(block.task)"
            >
              <span class="flex min-w-0 flex-1 flex-col justify-center truncate px-1 text-left">
                <span class="truncate font-medium text-ink">{{ block.task.title }}</span>
                <span
                  v-if="taskDuration(block.task) > 1"
                  class="truncate text-[10px] font-medium text-ink/60"
                >{{ formatTimeRange(block.task) }}</span>
              </span>
              <StatusIcon
                v-if="isPlanTask(block.task)"
                :status="block.task.status"
                size="sm"
                @click="app.cycleTaskStatus(block.task.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 有內容時：選新增或編輯 -->
    <div
      v-if="dialog?.mode === 'picker'"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="closeDialog"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-soft">
        <div class="border-b border-line px-4 py-3">
          <h3 class="text-base font-bold text-ink">選擇操作</h3>
          <p class="mt-1 text-xs font-medium text-ink/70">{{ dialog.date }} · {{ dialog.timeSlot }}</p>
        </div>

        <button
          type="button"
          class="block w-full border-b border-line px-4 py-3 text-left text-sm font-semibold text-brand-deep hover:bg-brand-soft/40"
          @click="openAddForm(dialog.date, dialog.timeSlot, TASK_KIND.plan)"
        >
          ＋ 新增計劃
        </button>
        <button
          type="button"
          class="block w-full border-b border-line px-4 py-3 text-left text-sm font-semibold text-brand-deep hover:bg-brand-soft/40"
          @click="openAddForm(dialog.date, dialog.timeSlot, TASK_KIND.schedule)"
        >
          ＋ 新增日程
        </button>

        <p class="px-4 pt-3 text-xs font-semibold text-ink/70">編輯既有項目</p>
        <div class="max-h-64 overflow-y-auto py-1">
          <button
            v-for="task in pickerTasks()"
            :key="task.id"
            type="button"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-soft"
            :title="task.title"
            @click="openEditForm(task)"
          >
            <StatusIcon v-if="isPlanTask(task)" :status="task.status" size="sm" />
            <span
              v-else
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-deep"
            >日</span>
            <span
              class="min-w-0 flex-1 truncate text-sm"
              :class="isPlanTask(task) && task.status === 'done' ? 'text-slate-400 line-through' : 'text-ink'"
            >
              <span class="text-[11px] text-mute">{{ kindLabel(task) }} · {{ formatTimeRange(task) }} · </span>
              {{ task.title || '（未命名）' }}
            </span>
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

    <!-- 選擇計劃或日程 -->
    <div
      v-if="dialog?.mode === 'kind-pick'"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="closeDialog"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-soft">
        <div class="border-b border-line px-4 py-3">
          <h3 class="text-base font-bold text-ink">
            {{
              dialog.purpose === 'add'
                ? '要新增哪一種？'
                : dialog.purpose === 'drop-todo'
                  ? '放入每日計劃'
                  : '要記成哪一種？'
            }}
          </h3>
          <p class="mt-1 text-xs font-medium text-ink/70">
            {{ dialog.date }} · {{ dialog.timeSlot }}
            <span v-if="dialog.title"> · {{ dialog.title }}</span>
          </p>
        </div>

        <!-- 待辦拖入：選類型 + 時長 -->
        <template v-if="dialog.purpose === 'drop-todo'">
          <div class="space-y-4 px-4 py-4">
            <div>
              <p class="mb-2 text-sm font-medium text-ink">類型</p>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-xl border px-3 py-2 text-sm"
                  :class="dialog.kind === TASK_KIND.plan ? 'border-brand bg-brand-soft font-semibold' : 'border-line'"
                  @click="dialog.kind = TASK_KIND.plan"
                >
                  計劃
                </button>
                <button
                  type="button"
                  class="rounded-xl border px-3 py-2 text-sm"
                  :class="dialog.kind === TASK_KIND.schedule ? 'border-brand bg-brand-soft font-semibold' : 'border-line'"
                  @click="dialog.kind = TASK_KIND.schedule"
                >
                  日程
                </button>
              </div>
              <p class="mt-1.5 text-xs text-mute">
                {{
                  dialog.kind === TASK_KIND.schedule
                    ? '日程：紀錄該時段做了哪些事情'
                    : '計劃：可追蹤未開始／進行中／已完成'
                }}
              </p>
            </div>
            <label class="block">
              <span class="mb-1 block text-sm font-medium text-ink">時長</span>
              <select
                v-model.number="dialog.duration"
                class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              >
                <option
                  v-for="opt in durationOptions(dialog.timeSlot)"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </label>
          </div>
          <div class="flex gap-2 border-t border-line px-4 py-3">
            <button
              type="button"
              class="flex-1 rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
              @click="closeDialog"
            >
              取消
            </button>
            <button
              type="button"
              class="flex-1 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
              @click="confirmDropTodo"
            >
              確認放入
            </button>
          </div>
        </template>

        <!-- 新增／移動：直接選類型 -->
        <template v-else>
          <button
            type="button"
            class="block w-full border-b border-line px-4 py-3 text-left hover:bg-brand-soft/40"
            @click="chooseKind(TASK_KIND.plan)"
          >
            <span class="block text-sm font-semibold text-ink">計劃</span>
            <span class="mt-0.5 block text-xs text-mute">可追蹤未開始／進行中／已完成</span>
          </button>
          <button
            type="button"
            class="block w-full border-b border-line px-4 py-3 text-left hover:bg-brand-soft/40"
            @click="chooseKind(TASK_KIND.schedule)"
          >
            <span class="block text-sm font-semibold text-ink">日程</span>
            <span class="mt-0.5 block text-xs text-mute">紀錄該時段做了哪些事情</span>
          </button>
          <button
            type="button"
            class="block w-full px-4 py-3 text-left text-sm text-mute hover:bg-soft"
            @click="closeDialog"
          >
            取消
          </button>
        </template>
      </div>
    </div>

    <!-- 新增 / 編輯表單 -->
    <div
      v-if="dialog?.mode === 'form'"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="closeDialog"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
        <h3 class="text-base font-bold text-ink">
          {{
            dialog.id
              ? `編輯${TASK_KIND_META[dialog.kind]?.label || '項目'}`
              : `新增${TASK_KIND_META[dialog.kind]?.label || '項目'}`
          }}
        </h3>
        <p class="mt-1 text-xs font-medium text-ink/70">{{ dialog.date }} · {{ dialog.timeSlot }}</p>

        <div class="mt-4">
          <p class="mb-2 text-sm font-medium">類型</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-xl border px-3 py-2 text-sm"
              :class="dialog.kind === TASK_KIND.plan ? 'border-brand bg-brand-soft font-semibold' : 'border-line'"
              @click="dialog.kind = TASK_KIND.plan"
            >
              計劃
            </button>
            <button
              type="button"
              class="rounded-xl border px-3 py-2 text-sm"
              :class="dialog.kind === TASK_KIND.schedule ? 'border-brand bg-brand-soft font-semibold' : 'border-line'"
              @click="dialog.kind = TASK_KIND.schedule"
            >
              日程
            </button>
          </div>
        </div>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">時長</span>
          <select
            v-model.number="dialog.duration"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          >
            <option
              v-for="opt in durationOptions(dialog.timeSlot)"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">
            {{ dialog.kind === TASK_KIND.schedule ? '日程內容' : '計劃名稱' }}
          </span>
          <input
            ref="titleInput"
            v-model="dialog.title"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            :placeholder="dialog.kind === TASK_KIND.schedule ? '例如：與小王開會討論提案' : '例如：處理郵件'"
            @keydown.enter.prevent="saveEdit"
          />
        </label>

        <div v-if="dialog.kind === TASK_KIND.plan" class="mt-4">
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
