<script setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  addDays,
  completionRate,
  formatDisplayDate,
  formatRate,
  formatTimeRange,
  isPlanTask,
  layoutDayOverlaps,
  composeTaskTitle,
  parseTaskTitleForEdit,
  resolveTaskColor,
  scheduleStyleFromColor,
  SELECT_COLOR,
  selectBgStyle,
  selectBorderBgStyle,
  STATUS,
  TASK_KIND,
  TASK_KIND_META,
  taskDuration,
  taskEndMoment,
  taskOverlapsDate,
  taskStartMoment,
  taskTimelineOnDate,
  TIME_SLOTS,
  toDateKey,
  toDatetimeLocalValue,
  momentFromColumnDateAndClock,
  buildRangeFromDatetimeLocal,
  DAY_VIEW_MINUTES,
  pad,
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
const noteInput = ref(null)
const formError = ref('')
/** 計時分類（與任務計時共用） */
const timerCategories = computed(() => app.store.timerCategories || [])
/** 'all' | 'plan' | 'schedule' — 與 app.weekViewFilter 同步 */
const viewFilter = computed({
  get: () => app.weekViewFilter.value,
  set: (v) => {
    app.weekViewFilter.value = v
  }
})
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

function isDropTargetRow(slot) {
  return !!dropTarget.value && dropTarget.value.endsWith(`|${slot}`)
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

/** 本週各日欄上的項目（分鐘級定位 + 重疊並排） */
const dayBlockLayers = computed(() => {
  return weekDateKeys.value.map((dateKey, dayIdx) => {
    let list = app.store.tasks.filter((t) => taskOverlapsDate(t, dateKey))
    if (viewFilter.value === 'plan') list = list.filter(isPlanTask)
    else if (viewFilter.value === 'schedule') list = list.filter((t) => !isPlanTask(t))

    const layout = layoutDayOverlaps(list, dateKey)
    const gap = 3

    const blocks = list
      .map((task) => {
        const range = taskTimelineOnDate(task, dateKey)
        if (!range) return null
        const { lane, lanes } = layout.get(task.id) || { lane: 0, lanes: 1 }
        const topPct = (range.startMin / DAY_VIEW_MINUTES) * 100
        const heightPct = ((range.endMin - range.startMin) / DAY_VIEW_MINUTES) * 100
        if (heightPct <= 0) return null
        return {
          task,
          compact: heightPct < 1.2,
          style: {
            top: `${topPct}%`,
            height: `${heightPct}%`,
            width: `calc(${100 / lanes}% - ${gap}px)`,
            left: `calc(${(100 / lanes) * lane}% + ${gap / 2}px)`
          }
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ra = taskTimelineOnDate(a.task, dateKey)
        const rb = taskTimelineOnDate(b.task, dateKey)
        return (ra?.startMin ?? 0) - (rb?.startMin ?? 0)
      })

    return { dayIdx, dateKey, blocks }
  })
})

function startTimeFromSlot(timeSlot) {
  return `${timeSlot.slice(0, 2)}:00:00`
}

function initialDatetimeRange(date, timeSlot) {
  const start = momentFromColumnDateAndClock(date, startTimeFromSlot(timeSlot))
  const end = new Date(start.getTime() + 3600000)
  return {
    startAtLocal: toDatetimeLocalValue(start),
    endAtLocal: toDatetimeLocalValue(end)
  }
}

function scheduleChipClass(task) {
  if (isPlanTask(task)) return 'task-chip-plan'
  if (resolveTaskColor(task, app.store.timerCategories)) return 'task-chip-custom'
  return 'task-chip-schedule'
}

function scheduleChipStyle(task) {
  if (isPlanTask(task)) return undefined
  return scheduleStyleFromColor(resolveTaskColor(task, app.store.timerCategories))
}

function showTimeRange(task) {
  const s = taskStartMoment(task)
  const e = taskEndMoment(task)
  if (!s || !e) return taskDuration(task) > 1
  return (
    taskDuration(task) > 1 ||
    s.getMinutes() !== 0 ||
    e.getMinutes() !== 0 ||
    s.getSeconds() !== 0 ||
    e.getSeconds() !== 0
  )
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
  const range =
    payload.date && payload.timeSlot
      ? initialDatetimeRange(payload.date, payload.timeSlot)
      : {
          startAtLocal: toDatetimeLocalValue(new Date()),
          endAtLocal: toDatetimeLocalValue(new Date(Date.now() + 3600000))
        }
  dialog.value = {
    mode: 'kind-pick',
    kind: TASK_KIND.plan,
    ...range,
    ...payload
  }
}

function chooseKind(kind) {
  if (!dialog.value || dialog.value.mode !== 'kind-pick') return
  const { purpose, date, timeSlot, taskId, startAtLocal, endAtLocal } = dialog.value

  if (purpose === 'add') {
    openAddForm(date, timeSlot, kind, { startAtLocal, endAtLocal })
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
  const { date, timeSlot, todoId, kind, startAtLocal, endAtLocal } = dialog.value
  const range = buildRangeFromDatetimeLocal(startAtLocal, endAtLocal)
  if (!range) return
  app.placeTodo(todoId, date, timeSlot, kind || TASK_KIND.plan, range.startAt, range.endAt)
  closeDialog()
}

function openAddForm(date, timeSlot, kind = TASK_KIND.plan, preset = null) {
  const range = preset || initialDatetimeRange(date, timeSlot)
  dialog.value = {
    mode: 'form',
    date,
    timeSlot,
    startAtLocal: range.startAtLocal,
    endAtLocal: range.endAtLocal,
    categoryId: '',
    note: '',
    status: STATUS.todo,
    kind,
    id: null
  }
  formError.value = ''
  nextTick(() => noteInput.value?.focus())
}

function openEditForm(task) {
  const start = taskStartMoment(task)
  const end = taskEndMoment(task)
  const parsed = parseTaskTitleForEdit(task, app.store.timerCategories)
  dialog.value = {
    mode: 'form',
    date: task.date,
    timeSlot: task.timeSlot,
    startAtLocal: start ? toDatetimeLocalValue(start) : '',
    endAtLocal: end ? toDatetimeLocalValue(end) : '',
    categoryId: parsed.categoryId || '',
    note: parsed.note,
    status: task.status || STATUS.todo,
    kind: isPlanTask(task) ? TASK_KIND.plan : TASK_KIND.schedule,
    id: task.id
  }
  formError.value = ''
  nextTick(() => noteInput.value?.focus())
}

function pickerTasks() {
  if (!dialog.value || dialog.value.mode !== 'picker') return []
  return app.tasksAt(dialog.value.date, dialog.value.timeSlot)
}

function closeDialog() {
  dialog.value = null
  formError.value = ''
}

function resolveFormTitle() {
  if (!dialog.value || dialog.value.mode !== 'form') return ''
  const cat = timerCategories.value.find((c) => c.id === dialog.value.categoryId)
  return composeTaskTitle(cat?.name, dialog.value.note)
}

function saveEdit() {
  if (!dialog.value || dialog.value.mode !== 'form') return
  const { status, kind, id, startAtLocal, endAtLocal, categoryId } = dialog.value
  const title = resolveFormTitle()
  if (!title) {
    formError.value = '請輸入或選擇內容'
    return
  }
  const range = buildRangeFromDatetimeLocal(startAtLocal, endAtLocal)
  if (!range) return
  const cat = timerCategories.value.find((c) => c.id === categoryId)
  app.upsertTask({
    id: id || undefined,
    title,
    status,
    kind,
    startAt: range.startAt,
    endAt: range.endAt,
    categoryId: cat?.id,
    color: cat?.color
  })
  app.persistNow(`Upsert task: ${title}`)
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
              :class="isDropTargetRow(slot) ? 'grid-row-drop-hint' : ''"
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
              :class="{
                'grid-cell-drop-target': isDropTarget(day, slot),
                'grid-row-drop-hint': isDropTargetRow(slot) && !isDropTarget(day, slot)
              }"
              :style="{ gridColumn: di + 2, gridRow: si + 1 }"
              @click="openCell(day, slot)"
              @dragenter="onDragEnter($event, day, slot)"
              @dragover="onDragOver($event, day, slot)"
              @dragleave="onDragLeave($event, day, slot)"
              @drop="onDrop($event, day, slot)"
            />
          </template>

          <div
            v-for="layer in dayBlockLayers"
            :key="`layer-${layer.dateKey}`"
            class="day-block-layer pointer-events-none z-[5]"
            :style="{ gridColumn: layer.dayIdx + 2, gridRow: '1 / -1' }"
          >
            <div
              v-for="block in layer.blocks"
              :key="block.task.id"
              class="task-span absolute flex min-h-0 flex-col gap-0.5"
              :style="block.style"
            >
              <div
                class="task-chip relative h-full min-h-0 flex-1 text-ink"
                :class="scheduleChipClass(block.task)"
                :style="scheduleChipStyle(block.task)"
                draggable="true"
                :title="`${kindLabel(block.task)} · ${block.task.title} · ${formatTimeRange(block.task)}`"
                @dragstart="onDragStart($event, block.task)"
                @dragend="onDragEnd"
                @click.stop="openEditForm(block.task)"
              >
                <span class="flex min-w-0 flex-1 flex-col justify-center truncate px-1 text-left">
                  <span class="truncate font-medium text-ink">{{ block.task.title }}</span>
                  <span
                    v-if="!block.compact && showTimeRange(block.task)"
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
              <span class="mb-1 block text-sm font-medium text-ink">開始</span>
              <input
                v-model="dialog.startAtLocal"
                type="datetime-local"
                step="60"
                class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-sm font-medium text-ink">結束</span>
              <input
                v-model="dialog.endAtLocal"
                type="datetime-local"
                step="60"
                class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <p class="mt-1 text-xs text-mute">可選不同日期以設定跨日行程。</p>
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
        <p class="mt-1 text-xs text-mute">開始與結束可含日期，支援跨日。</p>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">開始</span>
          <input
            v-model="dialog.startAtLocal"
            type="datetime-local"
            step="60"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </label>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">結束</span>
          <input
            v-model="dialog.endAtLocal"
            type="datetime-local"
            step="60"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </label>

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
          <span class="mb-1 block text-sm font-medium">計時分類（可選）</span>
          <select
            v-if="timerCategories.length"
            v-model="dialog.categoryId"
            class="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            @change="formError = ''"
          >
            <option value="">不選擇</option>
            <option v-for="cat in timerCategories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
          <p v-else class="text-xs text-mute">尚無分類，可於左側「任務計時」新增。</p>
        </label>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">補充說明（可選）</span>
          <input
            ref="noteInput"
            v-model="dialog.note"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            :placeholder="dialog.kind === TASK_KIND.schedule ? '例如：與小王開會討論提案' : '例如：處理郵件'"
            @keydown.enter.prevent="saveEdit"
            @input="formError = ''"
          />
          <p class="mt-1 text-xs text-mute">選分類或輸入文字即可儲存；兩者都有時會組成「分類「備註」」。</p>
        </label>

        <p v-if="formError" class="mt-2 text-sm text-status-todo">{{ formError }}</p>

        <p v-if="resolveFormTitle()" class="mt-2 rounded-xl bg-soft px-3 py-2 text-xs text-ink">
          預覽：{{ resolveFormTitle() }}
        </p>

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
