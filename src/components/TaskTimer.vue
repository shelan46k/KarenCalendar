<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import { notificationPermission, notificationSupported } from '../lib/notifications'
import {
  composeTaskTitleFromCategory,
  getCategoryChildren,
  resolveCategoryColor
} from '../lib/utils'
import CategoryTreeManager from './CategoryTreeManager.vue'
import CategoryTreeSelect from './CategoryTreeSelect.vue'
import CollapsibleSection from './CollapsibleSection.vue'
import SectionIcon from './SectionIcon.vue'

const app = inject('calendarApp')
const timer = inject('taskTimer')

const categories = computed(() => app.store.timerCategories || [])

const categorySummary = computed(() => {
  const roots = getCategoryChildren(categories.value, null)
  if (!roots.length) return '尚無分類 · 點開新增'
  if (roots.length <= 3) return roots.map((c) => c.name).join('、')
  return `${roots.length} 個根分類 · ${roots
    .slice(0, 2)
    .map((c) => c.name)
    .join('、')}…`
})

const selectedCatId = ref('')
const customTitle = ref('')
const customTitleInput = ref(null)
const endDialogError = ref('')
const saving = ref(false)

watch(
  () => timer.showEndDialog.value,
  (open) => {
    if (!open) {
      selectedCatId.value = ''
      customTitle.value = ''
      endDialogError.value = ''
      return
    }
    nextTick(() => customTitleInput.value?.focus())
  }
)

function resolveEndTitle() {
  return composeTaskTitleFromCategory(categories.value, selectedCatId.value || null, customTitle.value)
}

async function saveSchedule(payload) {
  const range = timer.getFinishRange()
  if (!range || saving.value) return

  saving.value = true
  try {
    await app.saveTimerSchedule({
      ...payload,
      startAt: range.startAt,
      endAt: range.endAt
    })
    timer.finalizeAfterSave()
    app.goToScheduleDate(range.startAt)
    customTitle.value = ''
    selectedCatId.value = ''
    endDialogError.value = ''
  } catch (err) {
    app.syncError.value = err?.message || '儲存失敗，請稍後再試'
  } finally {
    saving.value = false
  }
}

function trySaveEnd() {
  const title = resolveEndTitle()
  if (!title) {
    endDialogError.value = '請輸入或選擇內容'
    return
  }
  const color = selectedCatId.value
    ? resolveCategoryColor(categories.value, selectedCatId.value)
    : undefined
  saveSchedule({
    title,
    categoryId: selectedCatId.value || undefined,
    color
  })
}
</script>

<template>
  <section class="card-section overflow-hidden p-0">
    <div class="border-b border-line bg-panel px-4 py-3">
      <h2 class="flex items-center gap-1.5 text-base font-bold text-ink">
        <SectionIcon name="clock" class-name="h-4 w-4 text-brand-deep" />
        任務計時
      </h2>
    </div>

    <div class="space-y-3 px-4 py-4">
      <template v-if="!timer.isRunning.value">
        <p class="text-sm text-mute">
          開始後可縮小 App；結束時可選分類（含細項）並補充說明。
        </p>

        <CollapsibleSection id="timer-categories" title="計時分類" icon="list" :default-open="false">
          <template #summary>{{ categorySummary }}</template>
          <CategoryTreeManager />
        </CollapsibleSection>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink">縮小後提醒間隔</span>
          <select
            :value="timer.reminderMinutes.value"
            class="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
            @change="timer.reminderMinutes.value = Number($event.target.value)"
          >
            <option :value="0">僅開始／結束時通知</option>
            <option :value="15">每 15 分鐘</option>
            <option :value="30">每 30 分鐘</option>
            <option :value="60">每 60 分鐘</option>
          </select>
        </label>

        <p
          v-if="notificationSupported() && notificationPermission() === 'denied'"
          class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          通知已關閉。請到 iPhone「設定 → 通知 → Safari（或 Karen Calendar）」開啟。
        </p>

        <button
          type="button"
          class="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep"
          @click="timer.startTimer()"
        >
          開始計時 ❤️
        </button>
      </template>

      <template v-else>
        <div
          class="rounded-xl border px-4 py-3 text-center"
          :class="
            timer.isPaused.value
              ? 'border-amber-300/60 bg-amber-50/80'
              : 'border-brand/30 bg-brand-soft/50'
          "
        >
          <p
            class="text-xs font-medium"
            :class="timer.isPaused.value ? 'text-amber-800' : 'text-brand-deep'"
          >
            {{ timer.isPaused.value ? '已暫停' : '進行中' }}
          </p>
          <p class="mt-1 text-2xl font-bold tabular-nums tracking-tight text-ink">
            {{ timer.elapsedLabel.value }}
          </p>
          <p class="mt-1 text-[11px] text-mute">
            {{ timer.isPaused.value ? '暫停時間不計入紀錄' : '切到其他 App 也會繼續計時' }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            v-if="!timer.isPaused.value"
            type="button"
            class="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-soft"
            @click="timer.pauseTimer()"
          >
            暫停 ⏸
          </button>
          <button
            v-else
            type="button"
            class="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep"
            @click="timer.resumeTimer()"
          >
            繼續 ▶
          </button>
          <button
            type="button"
            class="rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-soft"
            @click="timer.openEndDialog()"
          >
            結束計時 🔚
          </button>
        </div>
      </template>

      <p v-if="timer.notifyHint.value" class="text-xs text-status-todo">
        {{ timer.notifyHint.value }}
      </p>
    </div>

    <Teleport to="body">
      <div
        v-if="timer.showEndDialog.value"
        class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
        @click.self="timer.closeEndDialog()"
      >
        <div class="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-soft">
          <h3 class="text-base font-bold text-ink">結束計時 · 選擇分類</h3>
          <p class="mt-1 text-xs text-mute">已計時 {{ timer.elapsedLabel.value }}</p>

          <label class="mt-4 block">
            <span class="mb-1 block text-sm font-medium text-ink">分類（可選細項）</span>
            <CategoryTreeSelect
              v-if="categories.length"
              v-model="selectedCatId"
              :categories="categories"
              placeholder="不選擇分類"
              @update:model-value="endDialogError = ''"
            />
            <p v-else class="text-xs text-mute">尚無分類，可先到計時分類新增。</p>
          </label>

          <label class="mt-4 block">
            <span class="mb-1 block text-sm font-medium text-ink">補充說明（可選）</span>
            <input
              ref="customTitleInput"
              v-model="customTitle"
              type="text"
              class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
              placeholder="輸入這段時間做了什麼"
              :disabled="saving"
              @input="endDialogError = ''"
              @keydown.enter.prevent="trySaveEnd"
            />
            <p class="mt-1 text-xs text-mute">先選分類、再視需要輸入說明，最後按「完成並記錄」。</p>
          </label>

          <p v-if="endDialogError" class="mt-2 text-sm text-status-todo">{{ endDialogError }}</p>

          <p v-if="resolveEndTitle()" class="mt-2 rounded-xl bg-soft px-3 py-2 text-xs text-ink">
            預覽：{{ resolveEndTitle() }}
          </p>

          <button
            type="button"
            class="mt-3 w-full rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            :disabled="saving"
            @click="trySaveEnd"
          >
            {{ saving ? '儲存中…' : '完成並記錄' }}
          </button>

          <div class="mt-4 flex justify-end">
            <button
              type="button"
              class="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
              :disabled="saving"
              @click="timer.closeEndDialog()"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
