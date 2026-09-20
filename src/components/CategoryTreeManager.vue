<script setup>
import { computed, inject, nextTick, ref } from 'vue'
import {
  flattenCategoryOptions,
  getCategoryById,
  getCategoryChildren,
  getCategoryPath,
  getCategoryPathLabel,
  resolveCategoryColor
} from '../lib/utils'

const app = inject('calendarApp')

const categories = computed(() => app.store.timerCategories || [])
/** 收合中的節點 id（子孫一併隱藏） */
const collapsedIds = ref(new Set())

const visibleRows = computed(() => {
  const rows = flattenCategoryOptions(categories.value)
  const collapsed = collapsedIds.value
  return rows
    .filter((row) => {
      const path = getCategoryPath(categories.value, row.id)
      for (let i = 0; i < path.length - 1; i++) {
        if (collapsed.has(path[i].id)) return false
      }
      return true
    })
    .map((row) => ({
      ...row,
      childCount: getCategoryChildren(categories.value, row.id).length
    }))
})

function isCollapsed(id) {
  return collapsedIds.value.has(id)
}

function toggleCollapse(id) {
  const next = new Set(collapsedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedIds.value = next
}

function expandNode(id) {
  if (!collapsedIds.value.has(id)) return
  const next = new Set(collapsedIds.value)
  next.delete(id)
  collapsedIds.value = next
}

const showRootForm = ref(false)
const newRootName = ref('')
const newRootColor = ref('#F4A4B4')
const rootNameInput = ref(null)

const addingChildFor = ref(null)
const newChildName = ref('')
const newChildColor = ref('#F4A4B4')
const childNameInput = ref(null)

const draggingId = ref(null)
const dropHint = ref(null)

const editOpen = ref(false)
const editId = ref(null)
const editName = ref('')
const editColor = ref('#F4A4B4')

const editCat = computed(() => (editId.value ? getCategoryById(categories.value, editId.value) : null))

const editPathLabel = computed(() =>
  editId.value ? getCategoryPathLabel(categories.value, editId.value) : ''
)

const canMoveUp = computed(() => !!editCat.value?.parentId)

const canMoveDown = computed(() => {
  if (!editCat.value) return false
  const siblings = getCategoryChildren(categories.value, editCat.value.parentId || null)
  const idx = siblings.findIndex((c) => c.id === editCat.value.id)
  return idx > 0
})

function setChildNameInput(el) {
  childNameInput.value = el || null
}

function focusNameInput(inputRef) {
  nextTick(() => {
    nextTick(() => {
      const el = inputRef.value
      const node = Array.isArray(el) ? el.find(Boolean) : el
      node?.focus?.()
    })
  })
}

function toggleRootForm() {
  showRootForm.value = !showRootForm.value
  if (showRootForm.value) {
    focusNameInput(rootNameInput)
  }
}

function startAddChild(cat) {
  addingChildFor.value = cat.id
  newChildName.value = ''
  newChildColor.value = resolveCategoryColor(categories.value, cat.id) || cat.color || '#F4A4B4'
  expandNode(cat.id)
  focusNameInput(childNameInput)
}

function cancelAddChild() {
  addingChildFor.value = null
  newChildName.value = ''
}

function addRoot() {
  const name = newRootName.value.trim()
  if (!name) return
  app.addTimerCategory({ name, color: newRootColor.value, parentId: null })
  newRootName.value = ''
  showRootForm.value = false
}

function addChild() {
  const name = newChildName.value.trim()
  if (!name || !addingChildFor.value) return
  app.addTimerCategory({
    name,
    color: newChildColor.value,
    parentId: addingChildFor.value
  })
  cancelAddChild()
}

function removeCategory(id) {
  const hasKids = getCategoryChildren(categories.value, id).length > 0
  const msg = hasKids
    ? '確定刪除此分類？其子分類也會一併刪除。已記錄的項目會保留原色。'
    : '確定刪除此分類？已記錄的項目會保留原色。'
  if (!confirm(msg)) return
  if (editId.value === id) closeEdit()
  app.removeTimerCategory(id)
}

function openEdit(row) {
  editId.value = row.id
  editName.value = row.name
  editColor.value = row.color || '#F4A4B4'
  editOpen.value = true
}

function closeEdit() {
  editOpen.value = false
  editId.value = null
  editName.value = ''
}

function saveEdit() {
  if (!editId.value) return
  const name = editName.value.trim()
  if (!name) return
  app.updateTimerCategory(editId.value, {
    name,
    color: editColor.value
  })
  closeEdit()
}

function moveLevelUp() {
  if (!editId.value || !canMoveUp.value) return
  app.shiftTimerCategoryLevel(editId.value, 'up')
}

function moveLevelDown() {
  if (!editId.value || !canMoveDown.value) return
  app.shiftTimerCategoryLevel(editId.value, 'down')
}

function onDragStart(event, id) {
  draggingId.value = id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/category-id', id)
}

function onDragEnd() {
  draggingId.value = null
  dropHint.value = null
}

function onDragOver(event, id) {
  event.preventDefault()
  if (!draggingId.value || draggingId.value === id) return
  const rect = event.currentTarget.getBoundingClientRect()
  const y = event.clientY - rect.top
  const ratio = y / rect.height
  let place = 'child'
  if (ratio < 0.28) place = 'before'
  else if (ratio > 0.72) place = 'after'
  dropHint.value = { id, place }
}

function onDrop(event, id) {
  event.preventDefault()
  const from = draggingId.value || event.dataTransfer.getData('text/category-id')
  const hint = dropHint.value
  dropHint.value = null
  draggingId.value = null
  if (!from || !hint || hint.id !== id) return
  app.moveTimerCategory(from, id, hint.place)
}

function rowClass(row) {
  const hint = dropHint.value
  if (!hint || hint.id !== row.id) return ''
  if (hint.place === 'before') return 'ring-2 ring-inset ring-brand'
  if (hint.place === 'after') return 'ring-2 ring-inset ring-brand'
  return 'ring-2 ring-brand brightness-95'
}

function rowStyle(row) {
  const hex = row.color || '#F4A4B4'
  return {
    marginLeft: `${row.depth * 12}px`,
    backgroundColor: `color-mix(in srgb, ${hex} 42%, white)`,
    borderColor: `color-mix(in srgb, ${hex} 70%, white)`
  }
}
</script>

<template>
  <div>
    <div class="mb-3 flex justify-end">
      <button
        type="button"
        class="text-xs font-medium text-brand-deep hover:underline"
        @click="toggleRootForm"
      >
        {{ showRootForm ? '取消新增' : '＋ 新增根分類' }}
      </button>
    </div>

    <div v-if="showRootForm" class="mb-3 flex flex-wrap items-end gap-2">
      <label class="min-w-0 flex-1">
        <span class="mb-1 block text-[11px] text-mute">名稱</span>
        <input
          ref="rootNameInput"
          v-model="newRootName"
          type="text"
          class="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          placeholder="例如：運動"
          @keydown.enter.prevent="addRoot"
        />
      </label>
      <label class="shrink-0">
        <span class="mb-1 block text-[11px] text-mute">顏色</span>
        <input
          v-model="newRootColor"
          type="color"
          class="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
        />
      </label>
      <button
        type="button"
        class="shrink-0 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
        :disabled="!newRootName.trim()"
        @click="addRoot"
      >
        加入
      </button>
    </div>

    <ul v-if="visibleRows.length" class="space-y-1">
      <li
        v-for="row in visibleRows"
        :key="row.id"
        class="rounded-xl border transition"
        :class="rowClass(row)"
        :style="rowStyle(row)"
        @dragover="onDragOver($event, row.id)"
        @drop="onDrop($event, row.id)"
      >
        <div class="flex items-center gap-1 px-2 py-1.5">
          <button
            v-if="row.childCount > 0"
            type="button"
            class="inline-flex h-5 w-4 shrink-0 items-center justify-center rounded text-ink/75 hover:bg-white/70 hover:text-ink"
            :title="isCollapsed(row.id) ? '展開子分類' : '收合子分類'"
            @click="toggleCollapse(row.id)"
          >
            <svg
              class="h-3 w-3 origin-center scale-[1.55]"
              viewBox="0 0 12 12"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                v-if="isCollapsed(row.id)"
                d="M4.2 2.2v7.6L9.5 6 4.2 2.2z"
              />
              <path v-else d="M2.2 4.2h7.6L6 9.5 2.2 4.2z" />
            </svg>
          </button>
          <span
            v-else
            class="inline-flex h-5 w-4 shrink-0"
            aria-hidden="true"
          />
          <button
            type="button"
            class="cursor-grab px-1 text-ink/50 active:cursor-grabbing"
            title="拖曳調整同層順序／變成子分類"
            draggable="true"
            @dragstart="onDragStart($event, row.id)"
            @dragend="onDragEnd"
          >
            ⋮⋮
          </button>
          <button
            type="button"
            class="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink"
            :title="row.pathLabel"
            @click="row.childCount > 0 ? toggleCollapse(row.id) : undefined"
          >
            {{ row.name }}
            <span v-if="row.childCount > 0 && isCollapsed(row.id)" class="ml-1 text-[11px] font-normal text-mute">
              （{{ row.childCount }}）
            </span>
          </button>
          <div class="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm font-semibold text-ink/80 hover:bg-white/70"
              title="新增子分類"
              @click="startAddChild({ id: row.id, color: row.color })"
            >
              ＋
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm text-ink/70 hover:bg-white/70"
              title="編輯"
              @click="openEdit(row)"
            >
              ✎
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm text-ink/70 hover:bg-white/70 hover:text-status-todo"
              title="刪除"
              @click="removeCategory(row.id)"
            >
              ×
            </button>
          </div>
        </div>

        <div
          v-if="addingChildFor === row.id"
          class="flex flex-wrap items-end gap-2 border-t border-black/5 px-2 py-2"
        >
          <label class="min-w-0 flex-1">
            <span class="mb-1 block text-[11px] text-mute">子分類名稱</span>
            <input
              :ref="setChildNameInput"
              v-model="newChildName"
              type="text"
              class="w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              placeholder="例如：上肢"
              @keydown.enter.prevent="addChild"
            />
          </label>
          <label class="shrink-0">
            <span class="mb-1 block text-[11px] text-mute">顏色</span>
            <input
              v-model="newChildColor"
              type="color"
              class="h-9 w-11 cursor-pointer rounded-lg border border-line bg-white p-1"
              title="子分類顏色"
            />
          </label>
          <button
            type="button"
            class="rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            :disabled="!newChildName.trim()"
            @click="addChild"
          >
            加入
          </button>
          <button
            type="button"
            class="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-mute"
            @click="cancelAddChild"
          >
            取消
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="text-xs text-mute">尚無分類，請先新增根分類。</p>
    <p v-if="visibleRows.length" class="mt-2 text-[11px] text-mute">
      點 ▾／名稱可收合子分類；拖曳 ⋮⋮ 可調同層順序或變成子分類；名稱／顏色／階層請按 ✎ 編輯。
    </p>

    <Teleport to="body">
      <div
        v-if="editOpen"
        class="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
        @click.self="closeEdit"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-soft">
          <h3 class="text-base font-bold text-ink">編輯分類</h3>
          <p v-if="editPathLabel" class="mt-1 text-xs text-mute">目前路徑：{{ editPathLabel }}</p>

          <label class="mt-4 block">
            <span class="mb-1 block text-sm font-medium text-ink">名稱</span>
            <input
              v-model="editName"
              type="text"
              class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              @keydown.enter.prevent="saveEdit"
            />
          </label>

          <label class="mt-4 block">
            <span class="mb-1 block text-sm font-medium text-ink">顏色</span>
            <div class="flex items-center gap-3">
              <input
                v-model="editColor"
                type="color"
                class="h-11 w-14 cursor-pointer rounded-xl border border-line bg-white p-1"
              />
              <span
                class="flex-1 rounded-xl border px-3 py-2 text-sm font-medium text-ink"
                :style="{
                  backgroundColor: `color-mix(in srgb, ${editColor} 42%, white)`,
                  borderColor: `color-mix(in srgb, ${editColor} 70%, white)`
                }"
              >
                預覽
              </span>
            </div>
          </label>

          <div class="mt-4">
            <p class="mb-2 text-sm font-medium text-ink">階層</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-soft disabled:opacity-40"
                :disabled="!canMoveUp"
                title="成為上一層的同層（根層則無法再上）"
                @click="moveLevelUp"
              >
                往上一層
              </button>
              <button
                type="button"
                class="rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-soft disabled:opacity-40"
                :disabled="!canMoveDown"
                title="成為前一個同層項目的子分類"
                @click="moveLevelDown"
              >
                往下一層
              </button>
            </div>
            <p class="mt-1.5 text-[11px] text-mute">
              往上：提到父層旁邊；往下：掛到上方同層項目底下。
            </p>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
              @click="closeEdit"
            >
              取消
            </button>
            <button
              type="button"
              class="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
              :disabled="!editName.trim()"
              @click="saveEdit"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
