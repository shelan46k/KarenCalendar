<script setup>
import { computed, inject, ref, watch } from 'vue'
import { completionRate, formatRate, toDateKey } from '../lib/utils'
import DonutChart from './DonutChart.vue'
import MiniCalendar from './MiniCalendar.vue'
import StatList from './StatList.vue'
import StatusIcon from './StatusIcon.vue'

const app = inject('calendarApp')

const monthRate = computed(() => completionRate(
  app.store.tasks.filter((t) => t.date.startsWith(app.monthKey.value))
))

const achievements = ref(app.review.value.achievements)
const reflections = ref(app.review.value.reflections)

watch(
  () => app.monthKey.value,
  () => {
    achievements.value = app.review.value.achievements
    reflections.value = app.review.value.reflections
  }
)

watch(
  () => [app.review.value.achievements, app.review.value.reflections],
  ([a, r]) => {
    achievements.value = a
    reflections.value = r
  }
)

function onKeyPlanTitle(plan, event) {
  app.updateKeyPlan(plan.id, { title: event.target.value })
  app.persistDebounced('Update key plan title')
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

    <section class="card-section">
      <h3 class="section-title">今日計劃情況</h3>
      <StatList
        :done="app.todayStats.value.done"
        :in-progress="app.todayStats.value.in_progress"
        :todo="app.todayStats.value.todo"
        :total="app.todayStats.value.total"
        show-ratio
      />
      <p class="mt-2 text-right text-xs text-mute">
        今日完成率
        {{ formatRate(completionRate(app.store.tasks.filter((t) => t.date === toDateKey(new Date())))) }}
      </p>
    </section>

    <section class="card-section">
      <h3 class="section-title">本月計劃情況</h3>
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <StatList
            :done="app.monthStats.value.done"
            :in-progress="app.monthStats.value.in_progress"
            :todo="app.monthStats.value.todo"
            :total="app.monthStats.value.total"
          />
        </div>
        <DonutChart :rate="monthRate" />
      </div>
    </section>

    <section class="card-section">
      <h3 class="section-title">本月重點計劃</h3>
      <ul class="space-y-2">
        <li
          v-for="(plan, index) in app.keyPlans.value"
          :key="plan.id"
          class="flex items-center gap-2"
        >
          <span class="w-5 shrink-0 text-xs text-mute">{{ index + 1 }}.</span>
          <input
            :value="plan.title"
            type="text"
            class="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm outline-none focus:border-brand"
            placeholder="輸入重點計劃…"
            @input="onKeyPlanTitle(plan, $event)"
          />
          <StatusIcon :status="plan.status" @click="app.cycleKeyPlanStatus(plan.id)" />
        </li>
      </ul>
    </section>

    <section class="card-section">
      <h3 class="section-title">本月計劃覆盤</h3>
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
        <p class="text-[11px] text-mute">文字輸入會在 1.5 秒無操作後自動同步至 GitHub。</p>
      </div>
    </section>
  </aside>
</template>
