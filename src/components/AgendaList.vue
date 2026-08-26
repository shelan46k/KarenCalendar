<script setup>
import { computed, inject, ref } from 'vue'
import {
  formatDisplayDate,
  parseDateKey,
  STATUS,
  TIME_SLOTS,
  weekdayLabel
} from '../lib/utils'
import CollapsibleSection from './CollapsibleSection.vue'
import StatusIcon from './StatusIcon.vue'

const app = inject('calendarApp')

const scope = ref('month')
const showIncomplete = ref(false)
const showDone = ref(false)

const slotOrder = Object.fromEntries(TIME_SLOTS.map((s, i) => [s, i]))

const filteredTasks = computed(() => {
  let list = [...app.store.tasks]

  if (scope.value === 'month') {
    list = list.filter((t) => t.date.startsWith(app.monthKey.value))
  }

  if (showIncomplete.value || showDone.value) {
    list = list.filter((t) => {
      const done = t.status === STATUS.done
      if (showIncomplete.value && showDone.value) return true
      if (showIncomplete.value) return !done
      if (showDone.value) return done
      return true
    })
  }

  return list.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (slotOrder[a.timeSlot] ?? 0) - (slotOrder[b.timeSlot] ?? 0)
  })
})

const incompleteCount = computed(
  () => filteredTasks.value.filter((t) => t.status !== STATUS.done).length
)

const summaryText = computed(() => {
  const scopeLabel = scope.value === 'month' ? '本月' : '全部'
  return `${scopeLabel} ${filteredTasks.value.length} 筆 · 未完成 ${incompleteCount.value}`
})

function displayDate(dateKey) {
  const d = parseDateKey(dateKey)
  return `${formatDisplayDate(d)} ${weekdayLabel(d)}`
}

function onSelect(task) {
  app.jumpToTask(task)
}

function chipClass(active) {
  return active
    ? 'bg-brand text-white'
    : 'bg-soft text-mute hover:bg-panel'
}
</script>

<template>
  <CollapsibleSection id="agenda" title="全部行程" icon="list" :default-open="true">
    <template #summary>{{ summaryText }}</template>

    <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] text-mute">範圍</span>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
          :class="chipClass(scope === 'month')"
          @click="scope = 'month'"
        >
          本月
        </button>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
          :class="chipClass(scope === 'all')"
          @click="scope = 'all'"
        >
          全部
        </button>
      </div>
      <div class="hidden h-4 w-px bg-line sm:block" />
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] text-mute">狀態</span>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
          :class="chipClass(showIncomplete)"
          @click="showIncomplete = !showIncomplete"
        >
          未完成
        </button>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1 text-xs font-medium transition"
          :class="chipClass(showDone)"
          @click="showDone = !showDone"
        >
          已完成
        </button>
      </div>
    </div>

    <div v-if="filteredTasks.length" class="max-h-64 space-y-1 overflow-y-auto pr-1">
      <div
        v-for="task in filteredTasks"
        :key="task.id"
        class="flex items-start gap-2 rounded-xl px-2 py-2 transition hover:bg-soft"
      >
        <StatusIcon
          :status="task.status"
          size="sm"
          class="mt-0.5"
          @click="app.cycleTaskStatus(task.id)"
        />
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          :title="`${task.title || '（未命名）'} · ${displayDate(task.date)} · ${task.timeSlot}`"
          @click="onSelect(task)"
        >
          <p class="truncate text-sm text-ink">
            {{ task.title || '（未命名）' }}
          </p>
          <p class="mt-0.5 text-[11px] text-mute">
            {{ displayDate(task.date) }} · {{ task.timeSlot }}
          </p>
        </button>
      </div>
    </div>
    <p v-else class="text-sm text-mute">沒有符合的行程</p>
  </CollapsibleSection>
</template>
