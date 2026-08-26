<script setup>
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useCalendarApp } from './composables/useCalendarApp'
import SetupModal from './components/SetupModal.vue'
import LeftDashboard from './components/LeftDashboard.vue'
import WeeklySchedule from './components/WeeklySchedule.vue'

const POLL_MS = 60_000

const app = useCalendarApp()
provide('calendarApp', app)

const bootError = ref('')
const booting = ref(!!app.config.value)
const refreshing = ref(false)
const softRefreshing = ref(false)
const nextPollAt = ref(0)
const nowTick = ref(Date.now())
const pageVisible = ref(
  typeof document === 'undefined' ? true : document.visibilityState === 'visible'
)

let countdownTimer = null

const secondsToPoll = computed(() => {
  if (!app.config.value || !nextPollAt.value || !pageVisible.value) return null
  const sec = Math.ceil((nextPollAt.value - nowTick.value) / 1000)
  return Math.max(0, sec)
})

const countdownText = computed(() => {
  if (softRefreshing.value) return '背景更新中…'
  if (secondsToPoll.value == null) return ''
  if (secondsToPoll.value <= 0) return '即將更新…'
  return `${secondsToPoll.value} 秒後更新`
})

onMounted(async () => {
  if (!app.config.value) {
    booting.value = false
    return
  }
  try {
    await app.bootstrap()
  } catch (err) {
    bootError.value = err.message || String(err)
    app.logout()
  } finally {
    booting.value = false
  }
  startPolling()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

watch(
  () => app.config.value,
  (cfg) => {
    if (cfg) startPolling()
    else stopPolling()
  }
)

const showSetup = computed(() => !app.config.value && !booting.value)

function scheduleNextPoll(from = Date.now()) {
  nextPollAt.value = from + POLL_MS
  nowTick.value = Date.now()
}

function startCountdownTick() {
  if (countdownTimer != null) return
  countdownTimer = window.setInterval(() => {
    nowTick.value = Date.now()
    if (
      app.config.value &&
      document.visibilityState === 'visible' &&
      nextPollAt.value &&
      Date.now() >= nextPollAt.value &&
      !softRefreshing.value &&
      !refreshing.value
    ) {
      softPoll()
    }
  }, 250)
}

function startPolling() {
  stopPolling()
  if (!app.config.value) return
  scheduleNextPoll()
  startCountdownTick()
}

function stopPolling() {
  if (countdownTimer != null) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  nextPollAt.value = 0
}

function onVisibilityChange() {
  pageVisible.value = document.visibilityState === 'visible'
  nowTick.value = Date.now()
  if (pageVisible.value && app.config.value) {
    softPoll()
  }
}

/** 背景軟更新：只重抓資料 */
async function softPoll() {
  if (!app.config.value) return
  if (document.visibilityState === 'hidden') return
  if (refreshing.value || softRefreshing.value || app.saving.value || app.loading.value) {
    // 忙碌中：稍後再試，避免卡住倒數
    scheduleNextPoll(Date.now() + 5_000)
    return
  }
  softRefreshing.value = true
  try {
    await app.reloadData({ silent: true })
  } catch {
    // 背景失敗不打斷操作，下次再試
  } finally {
    softRefreshing.value = false
    scheduleNextPoll()
  }
}

async function handleLogin(form) {
  bootError.value = ''
  try {
    await app.login(form)
    startPolling()
  } catch (err) {
    bootError.value = err.message || String(err)
  }
}

function handleLogout() {
  if (confirm('確定要登出嗎？')) {
    stopPolling()
    app.logout()
  }
}

/** 原本模式：清暫存 + 整頁重載，保留登入 */
async function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.update().catch(() => {})))
    }
  } catch {
    // 暫存清除失敗仍繼續重新載入
  } finally {
    window.location.reload()
  }
}
</script>

<template>
  <div class="min-h-screen">
    <header
      class="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur"
    >
      <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0 shrink">
          <h1 class="text-lg font-bold tracking-tight text-ink md:text-xl">
            Karen Calendar
          </h1>
          <p class="text-xs text-mute">
            <span v-if="app.saving.value" class="text-brand">同步中…</span>
            <span v-else-if="refreshing" class="text-brand">讀取中…</span>
            <span v-else-if="app.syncOk.value" class="text-status-done">{{ app.syncOk.value }}</span>
            <span v-else-if="app.syncError.value" class="text-status-todo">同步失敗</span>
            <span v-else>就緒</span>
            <span
              v-if="app.config.value && countdownText"
              class="ml-2 text-brand"
            >· {{ countdownText }}</span>
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="app.config.value"
            type="button"
            class="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-soft disabled:opacity-60"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            {{ refreshing ? '讀取中…' : '重新讀取' }}
          </button>
          <button
            v-if="app.config.value"
            type="button"
            class="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-soft"
            @click="handleLogout"
          >
            登出
          </button>
        </div>
      </div>
      <div
        v-if="app.syncError.value"
        class="border-t border-red-100 bg-red-50 px-4 py-2 text-center text-sm text-status-todo"
      >
        {{ app.syncError.value }}
      </div>
    </header>

    <main
      v-if="app.config.value && !booting"
      class="mx-auto grid max-w-[1600px] gap-4 p-3 md:p-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]"
    >
      <LeftDashboard />
      <WeeklySchedule />
    </main>

    <div
      v-if="booting"
      class="flex min-h-[70vh] items-center justify-center text-mute"
    >
      載入中…
    </div>

    <SetupModal
      v-if="showSetup"
      :error="bootError"
      :loading="app.loading.value"
      @submit="handleLogin"
    />
  </div>
</template>
