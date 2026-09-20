<script setup>
import { computed } from 'vue'
import {
  flattenCategoryOptions,
  UNCATEGORIZED_ID
} from '../lib/utils'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  includeUncategorized: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const options = computed(() => flattenCategoryOptions(props.categories))

const allIds = computed(() => {
  const ids = options.value.map((o) => o.id)
  if (props.includeUncategorized) ids.unshift(UNCATEGORIZED_ID)
  return ids
})

const selectedSet = computed(() => new Set(props.modelValue || []))

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
        <span
          class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]"
          :class="isOn(UNCATEGORIZED_ID) ? 'border-brand bg-brand text-white' : 'border-line bg-white'"
        >
          {{ isOn(UNCATEGORIZED_ID) ? '✓' : '' }}
        </span>
        未分類
      </button>
      <button
        v-for="opt in options"
        :key="opt.id"
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
        :class="isOn(opt.id) ? 'bg-brand-soft font-semibold text-ink' : 'text-ink hover:bg-white'"
        :style="{ paddingLeft: `${8 + opt.depth * 14}px` }"
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
        <span class="min-w-0 truncate">{{ opt.name }}</span>
      </button>
      <p v-if="!options.length && !includeUncategorized" class="px-2 py-1 text-xs text-mute">尚無分類</p>
    </div>
  </div>
</template>
