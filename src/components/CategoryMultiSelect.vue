<script setup>
import { computed, ref } from 'vue'
import {
  flattenCategoryOptions,
  getCategoryChildren,
  getCategoryPath,
  UNCATEGORIZED_ID
} from '../lib/utils'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  includeUncategorized: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const collapsedIds = ref(new Set())

const allOptions = computed(() => flattenCategoryOptions(props.categories))

const visibleOptions = computed(() => {
  const collapsed = collapsedIds.value
  return allOptions.value
    .filter((opt) => {
      const path = getCategoryPath(props.categories, opt.id)
      for (let i = 0; i < path.length - 1; i++) {
        if (collapsed.has(path[i].id)) return false
      }
      return true
    })
    .map((opt) => ({
      ...opt,
      childCount: getCategoryChildren(props.categories, opt.id).length
    }))
})

const allIds = computed(() => {
  const ids = allOptions.value.map((o) => o.id)
  if (props.includeUncategorized) ids.unshift(UNCATEGORIZED_ID)
  return ids
})

const selectedSet = computed(() => new Set(props.modelValue || []))

function isCollapsed(id) {
  return collapsedIds.value.has(id)
}

function toggleCollapse(id) {
  const next = new Set(collapsedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedIds.value = next
}

function toggle(id) {
  const next = new Set(props.modelValue || [])
  if (next.has(id)) next.delete(id)
  else next.add(id)
  emit('update:modelValue', [...next])
}

function isOn(id) {
  return selectedSet.value.has(id)
}

function selectAll() {
  emit('update:modelValue', [...allIds.value])
}

function clearAll() {
  emit('update:modelValue', [])
}
</script>

<template>
  <div>
    <div class="mb-2 flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-soft"
        @click="selectAll"
      >
        全選
      </button>
      <button
        type="button"
        class="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-mute hover:bg-soft"
        @click="clearAll"
      >
        全不選
      </button>
    </div>
    <div class="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line bg-soft/30 p-2">
      <button
        v-if="includeUncategorized"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
        :class="isOn(UNCATEGORIZED_ID) ? 'bg-brand-soft font-semibold text-ink' : 'text-ink hover:bg-white'"
        @click="toggle(UNCATEGORIZED_ID)"
      >
        <span class="inline-flex h-5 w-3.5 shrink-0" aria-hidden="true" />
        <span
          class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]"
          :class="isOn(UNCATEGORIZED_ID) ? 'border-brand bg-brand text-white' : 'border-line bg-white'"
        >
          {{ isOn(UNCATEGORIZED_ID) ? '✓' : '' }}
        </span>
        未分類
      </button>
      <div
        v-for="opt in visibleOptions"
        :key="opt.id"
        class="flex items-center gap-1 rounded-lg transition"
        :class="isOn(opt.id) ? 'bg-brand-soft' : 'hover:bg-white'"
        :style="{ paddingLeft: `${4 + opt.depth * 14}px` }"
      >
        <button
          v-if="opt.childCount > 0"
          type="button"
          class="inline-flex h-5 w-3.5 shrink-0 items-center justify-center text-ink/65 hover:text-ink"
          :title="isCollapsed(opt.id) ? '展開' : '收合'"
          @click.stop="toggleCollapse(opt.id)"
        >
          <svg
            class="h-3 w-3 origin-center scale-[1.55]"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              v-if="isCollapsed(opt.id)"
              d="M4.2 2.2v7.6L9.5 6 4.2 2.2z"
            />
            <path v-else d="M2.2 4.2h7.6L6 9.5 2.2 4.2z" />
          </svg>
        </button>
        <span v-else class="inline-flex h-5 w-3.5 shrink-0" aria-hidden="true" />
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm"
          :class="isOn(opt.id) ? 'font-semibold text-ink' : 'text-ink'"
          @click="toggle(opt.id)"
        >
          <span
            class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]"
            :class="isOn(opt.id) ? 'border-brand bg-brand text-white' : 'border-line bg-white'"
          >
            {{ isOn(opt.id) ? '✓' : '' }}
          </span>
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ backgroundColor: opt.color }"
          />
          <span class="min-w-0 truncate">
            {{ opt.name }}
            <span v-if="opt.childCount > 0 && isCollapsed(opt.id)" class="text-[11px] font-normal text-mute">
              （{{ opt.childCount }}）
            </span>
          </span>
        </button>
      </div>
      <p v-if="!allOptions.length && !includeUncategorized" class="px-2 py-1 text-xs text-mute">尚無分類</p>
    </div>
  </div>
</template>
