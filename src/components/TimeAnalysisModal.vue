<script setup>
import { computed, inject, ref, watch } from 'vue'
import {
  buildTimeAnalysisSlices,
  formatDurationMs,
  toDateKey,
  UNCATEGORIZED_ID,
  weekDates
} from '../lib/utils'
import CategoryMultiSelect from './CategoryMultiSelect.vue'
import CategoryPieChart from './CategoryPieChart.vue'

const props = defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const app = inject('calendarApp')

const categories = computed(() => app.store.timerCategories || [])

const todayKey = toDateKey(new Date())
const fromKey = ref(todayKey)
const toKey = ref(todayKey)
const selectedIds = ref([])
const rangePreset = ref('week')
const categoryPanelOpen = ref(true)

const selectedCountLabel = computed(() => {
  const n = selectedIds.value.length
  return n ? `已選 ${n} 項` : '尚未選擇'
})

function applyPreset(preset) {
  rangePreset.value = preset
  const anchor = app.selectedDate.value || new Date()
  if (preset === 'day') {
    const key = toDateKey(anchor)
    fromKey.value = key
    toKey.value = key
    return
  }
  if (preset === 'week') {
    const days = weekDates(anchor)
    fromKey.value = toDateKey(days[0])
    toKey.value = toDateKey(days[6])
    return
  }
  if (preset === 'month') {
    const y = anchor.getFullYear()
    const m = anchor.getMonth()
    fromKey.value = toDateKey(new Date(y, m, 1))
    toKey.value = toDateKey(new Date(y, m + 1, 0))
    return
  }
  if (preset === 'all') {
    const tasks = app.store.tasks || []
    let min = null
    let max = null
    for (const t of tasks) {
      const key = t.date || (t.startAt ? String(t.startAt).slice(0, 10) : '')
      if (!key) continue
      if (!min || key < min) min = key
      if (!max || key > max) max = key
    }
    fromKey.value = min || todayKey
    toKey.value = max || todayKey
  }
}

function defaultSelectedIds() {
  const roots = categories.value.filter((c) => !c.parentId).map((c) => c.id)
  return [...roots, UNCATEGORIZED_ID]
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    applyPreset('week')
    selectedIds.value = defaultSelectedIds()
  }
)

watch([fromKey, toKey], () => {
  rangePreset.value = 'custom'
})

const analysis = computed(() =>
  buildTimeAnalysisSlices({
    tasks: app.store.tasks,
    categories: categories.value,
    fromKey: fromKey.value,
    toKey: toKey.value,
    selectedIds: selectedIds.value
  })
)

const slices = computed(() => analysis.value.slices || [])
const stats = computed(() => analysis.value.stats || { taskCount: 0, timedCount: 0, totalMs: 0 })

const totalLabel = computed(() => {
  const ms = stats.value.totalMs || 0
  return ms > 0 ? formatDurationMs(ms) : '0 秒'
})

function chipClass(active) {
  return active
    ? 'border-brand bg-brand-soft font-semibold text-brand-deep'
    : 'border-line bg-white text-mute hover:bg-soft'
}

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="close"
    >
      <div class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-soft sm:p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-bold text-ink">時間分析</h3>
            <p class="mt-1 text-xs text-mute">自訂區間並勾選分類，查看時間占比</p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-line px-2.5 py-1 text-sm text-mute hover:bg-soft"
            @click="close"
          >
            關閉
          </button>
        </div>

        <div class="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            class="rounded-lg border px-2.5 py-1 text-xs transition"
            :class="chipClass(rangePreset === 'day')"
            @click="applyPreset('day')"
          >
            當日
          </button>
          <button
            type="button"
            class="rounded-lg border px-2.5 py-1 text-xs transition"
            :class="chipClass(rangePreset === 'week')"
            @click="applyPreset('week')"
          >
            當周
          </button>
          <button
            type="button"
            class="rounded-lg border px-2.5 py-1 text-xs transition"
            :class="chipClass(rangePreset === 'month')"
            @click="applyPreset('month')"
          >
            本月
          </button>
          <button
            type="button"
            class="rounded-lg border px-2.5 py-1 text-xs transition"
            :class="chipClass(rangePreset === 'all')"
            @click="applyPreset('all')"
          >
            全部日期
          </button>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-2">
          <label class="block">
            <span class="mb-1 block text-[11px] text-mute">起日</span>
            <input
              v-model="fromKey"
              type="date"
              class="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-[11px] text-mute">迄日</span>
            <input
              v-model="toKey"
              type="date"
              class="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
        </div>

        <p class="mt-2 text-[11px] text-mute">
          此區間共 {{ stats.taskCount }} 筆項目、其中 {{ stats.timedCount }} 筆有可計算時長。
          沒有綁定分類的會算在「未分類」（請勾選）。
        </p>

        <div class="mt-4 rounded-xl border border-line">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-soft/60"
            @click="categoryPanelOpen = !categoryPanelOpen"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink">選擇分類（可多選）</span>
              <span class="mt-0.5 block text-[11px] text-mute">
                {{ selectedCountLabel }} · 選父層會拆成子項占比；圓餅 100% = 所選合計
              </span>
            </span>
            <span class="shrink-0 text-xs text-mute" aria-hidden="true">
              {{ categoryPanelOpen ? '收合 ▴' : '展開 ▾' }}
            </span>
          </button>
          <div v-show="categoryPanelOpen" class="border-t border-line px-3 py-3">
            <CategoryMultiSelect v-model="selectedIds" :categories="categories" />
          </div>
        </div>

        <div class="mt-5 rounded-2xl border border-line bg-soft/40 p-4 sm:p-5">
          <div class="mb-4 flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-ink">時間分布</p>
            <p class="text-xs text-mute">合計 {{ totalLabel }}</p>
          </div>
          <CategoryPieChart v-if="slices.length" :slices="slices" />
          <p v-else class="py-8 text-center text-sm text-mute">
            <template v-if="!selectedIds.length">請先勾選至少一個分類</template>
            <template v-else-if="stats.timedCount === 0">
              此區間沒有可計算時長的項目，可改選「當周／本月／全部日期」
            </template>
            <template v-else>所選分類在此區間沒有時間資料（可勾「未分類」試試）</template>
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
