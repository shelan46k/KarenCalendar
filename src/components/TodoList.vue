<script setup>
import { computed, inject, nextTick, reactive, ref } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'

const app = inject('calendarApp')

const todoUi = ref(null)
const activeTodo = ref(null)
const todoForm = reactive({ title: '' })
const titleInput = ref(null)
const draggingTodoIndex = ref(null)
const dropTargetIndex = ref(null)
let suppressTodoClick = false

const summaryText = computed(() => {
  const n = app.todos.value.length
  return n ? `${n} 項待辦` : '尚未新增待辦'
})

function closeTodoUi() {
  todoUi.value = null
  activeTodo.value = null
  todoForm.title = ''
}

function openAddTodo() {
  activeTodo.value = null
  todoForm.title = ''
  todoUi.value = 'form'
  nextTick(() => titleInput.value?.focus())
}

function openTodoEdit(todo) {
  if (suppressTodoClick) return
  activeTodo.value = todo
  todoForm.title = todo.title
  todoUi.value = 'form'
  nextTick(() => titleInput.value?.focus())
}

function deleteTodo() {
  if (!activeTodo.value) return
  if (!confirm('確定刪除這項待辦？')) return
  app.removeTodo(activeTodo.value.id)
  closeTodoUi()
}

function saveTodoForm() {
  const title = todoForm.title.trim()
  if (!title) return

  if (activeTodo.value) {
    app.updateTodo(activeTodo.value.id, { title })
    app.persistNow('Update todo')
  } else {
    app.addTodo({ title })
  }
  closeTodoUi()
}

function clearTodoDragState() {
  draggingTodoIndex.value = null
  dropTargetIndex.value = null
}

function onDragStart(event, todo, index) {
  draggingTodoIndex.value = index
  dropTargetIndex.value = index
  event.dataTransfer.setData('text/todo-id', todo.id)
  event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  suppressTodoClick = true
  setTimeout(() => {
    suppressTodoClick = false
  }, 0)
  clearTodoDragState()
}

function onTodoDragOver(event, index) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  if (draggingTodoIndex.value == null) return
  dropTargetIndex.value = index
}

function onTodoDrop(event, index) {
  event.preventDefault()
  const taskId = event.dataTransfer.getData('text/task-id')
  if (taskId) {
    app.placeTaskAsTodo(taskId)
    clearTodoDragState()
    return
  }
  event.stopPropagation()
  const from = draggingTodoIndex.value
  if (from == null || from === index) {
    clearTodoDragState()
    return
  }
  app.reorderTodo(from, index)
  clearTodoDragState()
}

function onListDragOver(event) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

function onListDrop(event) {
  event.preventDefault()
  event.stopPropagation()
  const taskId = event.dataTransfer.getData('text/task-id')
  if (taskId) {
    app.placeTaskAsTodo(taskId)
    return
  }
  const from = draggingTodoIndex.value
  const lastIndex = app.todos.value.length - 1
  if (from != null && from !== lastIndex) {
    app.reorderTodo(from, lastIndex)
  }
  clearTodoDragState()
}
</script>

<template>
  <div
    class="rounded-2xl"
    @dragover="onListDragOver"
    @drop="onListDrop"
  >
  <CollapsibleSection id="todos" title="待辦事項" icon="todo" :default-open="true">
    <template #summary>{{ summaryText }}</template>

    <p class="mb-3 text-[11px] text-mute">拖曳可調整順序，也可與每日計劃互相拖曳</p>

    <ul v-if="app.todos.value.length" class="mb-3 space-y-2">
      <li
        v-for="(todo, index) in app.todos.value"
        :key="todo.id"
        class="flex items-center gap-2"
        @dragover="onTodoDragOver($event, index)"
        @drop="onTodoDrop($event, index)"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-xl border px-1 py-1.5 text-left transition hover:bg-soft active:cursor-grabbing"
          :class="
            dropTargetIndex === index && draggingTodoIndex !== null && draggingTodoIndex !== index
              ? 'border-brand bg-brand-soft/50'
              : draggingTodoIndex === index
                ? 'border-brand/40 bg-brand-soft/30 opacity-60'
                : 'border-transparent'
          "
          :title="todo.title"
          draggable="true"
          @dragstart="onDragStart($event, todo, index)"
          @dragend="onDragEnd"
          @click="openTodoEdit(todo)"
        >
          <span class="w-5 shrink-0 text-xs text-mute">{{ index + 1 }}.</span>
          <span class="min-w-0 flex-1 truncate text-sm text-ink">{{ todo.title }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="mb-3 text-sm text-mute">尚未新增待辦事項</p>

    <button
      type="button"
      class="w-full rounded-xl border border-dashed border-brand/40 bg-brand-soft/40 px-3 py-2.5 text-sm font-medium text-brand hover:bg-brand-soft"
      @click="openAddTodo"
    >
      ＋ 新增待辦
    </button>
  </CollapsibleSection>
  </div>

  <div
    v-if="todoUi === 'form'"
    class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    @click.self="closeTodoUi"
  >
    <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-base font-bold text-ink">
          {{ activeTodo ? '編輯待辦' : '新增待辦' }}
        </h3>
        <button
          v-if="activeTodo"
          type="button"
          class="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-status-todo hover:bg-red-50"
          @click="deleteTodo"
        >
          刪除
        </button>
      </div>

      <label class="mt-4 block">
        <span class="mb-1 block text-sm font-medium">待辦內容</span>
        <input
          ref="titleInput"
          v-model="todoForm.title"
          type="text"
          class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          placeholder="例如：回覆客戶郵件"
          @keydown.enter.prevent="saveTodoForm"
        />
      </label>

      <div class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
          @click="closeTodoUi"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
          :disabled="!todoForm.title.trim()"
          @click="saveTodoForm"
        >
          儲存
        </button>
      </div>
    </div>
  </div>
</template>
