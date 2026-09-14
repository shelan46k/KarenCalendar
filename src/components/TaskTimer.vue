<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import { notificationPermission, notificationSupported } from '../lib/notifications'
import { composeTaskTitle, scheduleStyleFromColor } from '../lib/utils'
import CollapsibleSection from './CollapsibleSection.vue'
import SectionIcon from './SectionIcon.vue'

const app = inject('calendarApp')
const timer = inject('taskTimer')

const categories = computed(() => app.store.timerCategories || [])

const categorySummary = computed(() => {
  const list = categories.value
  if (!list.length) return '尚無分類 · 點開新增'
  if (list.length <= 3) return list.map((c) => c.name).join('、')
  return `${list.length} 個分類 · ${list
    .slice(0, 2)
    .map((c) => c.name)
    .join('、')}…`
})

const showCategoryForm = ref(false)
const newCatName = ref('')
const newCatColor = ref('#F4A4B4')

const selectedCatId = ref(null)
const customTitle = ref('')
const customTitleInput = ref(null)
const endDialogError = ref('')
const saving = ref(false)

watch(
  () => timer.showEndDialog.value,
  (open) => {
    if (!open) {
      selectedCatId.value = null
      customTitle.value = ''
      endDialogError.value = ''
      return
    }
    nextTick(() => customTitleInput.value?.focus())
  }
)

function resolveEndTitle() {
  const cat = categories.value.find((c) => c.id === selectedCatId.value)
  return composeTaskTitle(cat?.name, customTitle.value)
}

function catChipStyle(cat) {
  const base = scheduleStyleFromColor(cat.color) || {}
  const selected = selectedCatId.value === cat.id
  return selected ? { ...base, boxShadow: '0 0 0 2px color-mix(in srgb, #BBAEE3 55%, white)' } : base
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
    selectedCatId.value = null
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
  const cat = categories.value.find((c) => c.id === selectedCatId.value)
  saveSchedule({
    title,
    categoryId: cat?.id,
    color: cat?.color
  })
}

function onCategoryClick(cat) {
  selectedCatId.value = selectedCatId.value === cat.id ? null : cat.id
  endDialogError.value = ''
}

function addCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  const cat = app.addTimerCategory({ name, color: newCatColor.value })
  if (cat) {
    newCatName.value = ''
    showCategoryForm.value = false
  }
}

function removeCategory(id) {
  if (!confirm('確定刪除此分類？已記錄的日程會保留原色。')) return
  app.removeTimerCategory(id)
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
          開始後可縮小 App；結束時點分類即可記錄，無須每次打字。
        </p>

        <CollapsibleSection id="timer-categories" title="計時分類" icon="list" :default-open="false">
          <template #summary>{{ categorySummary }}</template>

          <div class="mb-3 flex justify-end">
            <button
              type="button"
              class="text-xs font-medium text-brand-deep hover:underline"
              @click="showCategoryForm = !showCategoryForm"
            >
              {{ showCategoryForm ? '取消新增' : '＋ 新增分類' }}
            </button>
          </div>

          <div v-if="showCategoryForm" class="mb-3 flex flex-wrap items-end gap-2">
            <label class="min-w-0 flex-1">
              <span class="mb-1 block text-[11px] text-mute">名稱</span>
              <input
                v-model="newCatName"
                type="text"
                class="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                placeholder="例如：工作"
                @keydown.enter.prevent="addCategory"
              />
            </label>
            <label class="shrink-0">
              <span class="mb-1 block text-[11px] text-mute">顏色</span>
              <input
                v-model="newCatColor"
                type="color"
                class="h-10 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
              />
            </label>
            <button
              type="button"
              class="shrink-0 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
              :disabled="!newCatName.trim()"
              @click="addCategory"
            >
              加入
            </button>
          </div>

          <ul v-if="categories.length" class="space-y-1.5">
            <li
              v-for="cat in categories"
              :key="cat.id"
              class="flex items-center gap-2 rounded-xl border border-line bg-white px-2 py-1.5"
            >
              <input
                type="color"
                :value="cat.color"
                class="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-line p-0.5"
                @input="app.updateTimerCategory(cat.id, { color: $event.target.value })"
              />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink">{{ cat.name }}</span>
              <button
                type="button"
                class="shrink-0 rounded-lg px-2 py-1 text-xs text-mute hover:bg-soft hover:text-status-todo"
                @click="removeCategory(cat.id)"
              >
                刪除
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-mute">尚無分類，請先新增以便結束計時時快速選取。</p>
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
        <div class="rounded-xl border border-brand/30 bg-brand-soft/50 px-4 py-3 text-center">
          <p class="text-xs font-medium text-brand-deep">進行中</p>
          <p class="mt-1 text-2xl font-bold tabular-nums tracking-tight text-ink">
            {{ timer.elapsedLabel.value }}
          </p>
          <p class="mt-1 text-[11px] text-mute">切到其他 App 也會繼續計時</p>
        </div>

        <button
          type="button"
          class="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-soft"
          @click="timer.openEndDialog()"
        >
          結束計時 🔚
        </button>
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

          <div v-if="categories.length" class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="rounded-xl border px-3 py-3 text-left text-sm font-semibold text-ink transition hover:brightness-[0.98] disabled:opacity-50"
              :class="selectedCatId === cat.id ? 'border-brand' : 'border-line'"
              :style="catChipStyle(cat)"
              :disabled="saving"
              @click="onCategoryClick(cat)"
            >
              {{ cat.name }}
            </button>
          </div>

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
