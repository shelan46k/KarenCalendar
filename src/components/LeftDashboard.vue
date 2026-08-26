<script setup>
import { computed, inject, nextTick, reactive, ref, watch } from 'vue'
import { completionRate, formatRate, STATUS, toDateKey } from '../lib/utils'
import AgendaList from './AgendaList.vue'
import CollapsibleSection from './CollapsibleSection.vue'
import DonutChart from './DonutChart.vue'
import MiniCalendar from './MiniCalendar.vue'
import StatList from './StatList.vue'
import StatusIcon from './StatusIcon.vue'

const app = inject('calendarApp')

const achievements = ref(app.review.value.achievements)
const reflections = ref(app.review.value.reflections)

const planUi = ref(null)
const activePlan = ref(null)
const planForm = reactive({
  title: '',
  status: STATUS.todo
})
const titleInput = ref(null)

const todayRateText = computed(() =>
  formatRate(
    completionRate(app.store.tasks.filter((t) => t.date === toDateKey(new Date())))
  )
)

const todaySummary = computed(() => {
  const s = app.todayStats.value
  return `完成 ${s.done}/${s.total} · 完成率 ${todayRateText.value}`
})

const monthSummary = computed(() => {
  const s = app.monthStats.value
  return `完成 ${s.done}/${s.total} · 完成率 ${formatRate(app.monthRate.value)}`
})

const keyPlanSummary = computed(() => {
  const plans = app.keyPlans.value
  if (!plans.length) return '尚未新增重點計劃'
  const done = plans.filter((p) => p.status === STATUS.done).length
  return `${plans.length} 項 · 已完成 ${done}`
})

const reviewSummary = computed(() => {
  const a = (achievements.value || '').trim()
  const r = (reflections.value || '').trim()
  if (!a && !r) return '尚未填寫成果／反思'
  const bits = []
  if (a) bits.push('成果已填')
  if (r) bits.push('反思已填')
  return bits.join(' · ')
})

watch(
  () => app.monthKey.value,
  () => {
    achievements.value = app.review.value.achievements
    reflections.value = app.review.value.reflections
    closePlanUi()
  }
)

watch(
  () => [app.review.value.achievements, app.review.value.reflections],
  ([a, r]) => {
    achievements.value = a
    reflections.value = r
  }
)

function closePlanUi() {
  planUi.value = null
  activePlan.value = null
  planForm.title = ''
  planForm.status = STATUS.todo
}

function openAddPlan() {
  activePlan.value = null
  planForm.title = ''
  planForm.status = STATUS.todo
  planUi.value = 'form'
  nextTick(() => titleInput.value?.focus())
}

function openPlanEdit(plan) {
  activePlan.value = plan
  planForm.title = plan.title
  planForm.status = plan.status
  planUi.value = 'form'
  nextTick(() => titleInput.value?.focus())
}

function deletePlan() {
  if (!activePlan.value) return
  if (!confirm('確定刪除這項重點計劃？')) return
  app.removeKeyPlan(activePlan.value.id)
  closePlanUi()
}

function savePlanForm() {
  const title = planForm.title.trim()
  if (!title) return

  if (activePlan.value) {
    app.updateKeyPlan(activePlan.value.id, {
      title,
      status: planForm.status
    })
    app.persistNow('Update key plan')
  } else {
    app.addKeyPlan({ title, status: planForm.status })
  }
  closePlanUi()
}

function onAchievementsInput(e) {
  achievements.value = e.target.value
  app.updateReview('achievements', e.target.value)
}

function onReflectionsInput(e) {
  reflections.value = e.target.value
  app.updateReview('reflections', e.target.value)
}
</script>

<template>
  <aside class="flex flex-col gap-3">
    <MiniCalendar />
    <AgendaList />

    <CollapsibleSection id="today-stats" title="今日計劃情況" icon="today" :default-open="true">
      <template #summary>{{ todaySummary }}</template>
      <StatList
        :done="app.todayStats.value.done"
        :in-progress="app.todayStats.value.in_progress"
        :todo="app.todayStats.value.todo"
        :total="app.todayStats.value.total"
        show-ratio
      />
      <p class="mt-2 text-right text-xs text-mute">
        今日完成率 {{ todayRateText }}
      </p>
    </CollapsibleSection>

    <CollapsibleSection id="month-stats" title="本月計劃情況" icon="chart" :default-open="true">
      <template #summary>{{ monthSummary }}</template>
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <StatList
            :done="app.monthStats.value.done"
            :in-progress="app.monthStats.value.in_progress"
            :todo="app.monthStats.value.todo"
            :total="app.monthStats.value.total"
          />
        </div>
        <DonutChart :rate="app.monthRate.value" />
      </div>
    </CollapsibleSection>

    <CollapsibleSection id="key-plans" title="本月重點計劃" icon="flag" :default-open="true">
      <template #summary>{{ keyPlanSummary }}</template>

      <div class="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-mute">
        <span class="inline-flex items-center gap-1">
          <StatusIcon status="done" size="sm" />
          已完成
        </span>
        <span class="inline-flex items-center gap-1">
          <StatusIcon status="in_progress" size="sm" />
          進行中
        </span>
        <span class="inline-flex items-center gap-1">
          <StatusIcon status="todo" size="sm" />
          未開始
        </span>
      </div>

      <ul v-if="app.keyPlans.value.length" class="mb-3 space-y-2">
        <li
          v-for="(plan, index) in app.keyPlans.value"
          :key="plan.id"
          class="flex items-center gap-2"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1.5 text-left transition hover:bg-soft"
            :title="plan.title"
            @click="openPlanEdit(plan)"
          >
            <span
              class="w-5 shrink-0 text-xs"
              :class="plan.status === 'done' ? 'text-slate-300' : 'text-mute'"
            >{{ index + 1 }}.</span>
            <span
              class="min-w-0 flex-1 truncate text-sm"
              :class="plan.status === 'done' ? 'text-slate-400 line-through' : 'text-ink'"
            >{{ plan.title }}</span>
          </button>
          <StatusIcon
            :status="plan.status"
            @click="app.cycleKeyPlanStatus(plan.id)"
          />
        </li>
      </ul>
      <p v-else class="mb-3 text-sm text-mute">尚未新增重點計劃</p>

      <button
        type="button"
        class="w-full rounded-xl border border-dashed border-brand/40 bg-brand-soft/40 px-3 py-2.5 text-sm font-medium text-brand hover:bg-brand-soft"
        @click="openAddPlan"
      >
        ＋ 新增計劃
      </button>
    </CollapsibleSection>

    <CollapsibleSection id="review" title="本月計劃覆盤" icon="note" :default-open="false">
      <template #summary>{{ reviewSummary }}</template>
      <div class="space-y-3">
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-brand">成果</span>
          <textarea
            :value="achievements"
            rows="4"
            class="w-full resize-y rounded-xl border border-line bg-soft/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            placeholder="1. …&#10;2. …"
            @input="onAchievementsInput"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-status-todo">反思</span>
          <textarea
            :value="reflections"
            rows="4"
            class="w-full resize-y rounded-xl border border-line bg-soft/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            placeholder="1. …&#10;2. …"
            @input="onReflectionsInput"
          />
        </label>
      </div>
    </CollapsibleSection>

    <div
      v-if="planUi === 'form'"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      @click.self="closePlanUi"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-base font-bold">
            {{ activePlan ? '編輯重點計劃' : '新增重點計劃' }}
          </h3>
          <button
            v-if="activePlan"
            type="button"
            class="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-status-todo hover:bg-red-50"
            @click="deletePlan"
          >
            刪除
          </button>
        </div>

        <label class="mt-4 block">
          <span class="mb-1 block text-sm font-medium">計劃內容</span>
          <input
            ref="titleInput"
            v-model="planForm.title"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
            placeholder="例如：訪談 8 家大型客戶"
            @keydown.enter.prevent="savePlanForm"
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
              :class="planForm.status === s ? 'border-brand bg-brand-soft' : 'border-line'"
              @click="planForm.status = s"
            >
              <StatusIcon :status="s" />
              {{ s === 'done' ? '已完成' : s === 'in_progress' ? '進行中' : '未開始' }}
            </button>
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
            @click="closePlanUi"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            :disabled="!planForm.title.trim()"
            @click="savePlanForm"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>
