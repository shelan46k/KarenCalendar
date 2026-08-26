<script setup>
import { computed, onMounted, provide, ref } from 'vue'
import { useCalendarApp } from './composables/useCalendarApp'
import SetupModal from './components/SetupModal.vue'
import LeftDashboard from './components/LeftDashboard.vue'
import WeeklySchedule from './components/WeeklySchedule.vue'

const app = useCalendarApp()
provide('calendarApp', app)

const bootError = ref('')
const booting = ref(!!app.config.value)

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
})

const showSetup = computed(() => !app.config.value && !booting.value)

async function handleLogin(form) {
  bootError.value = ''
  try {
    await app.login(form)
  } catch (err) {
    bootError.value = err.message || String(err)
  }
}

function handleLogout() {
  if (confirm('確定清除本機 Token 與設定？資料仍保留在 GitHub 私有儲存庫中。')) {
    app.logout()
  }
}
</script>

<template>
  <div class="min-h-screen">
    <header
      class="sticky top-0 z-40 border-b border-line/80 bg-white/90 backdrop-blur"
    >
      <div class="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 class="text-lg font-bold tracking-tight text-ink md:text-xl">
            Karen Calendar
            <span class="ml-2 text-sm font-medium text-brand">高效管理</span>
          </h1>
          <p class="text-xs text-mute">
            資料同步至 GitHub 私有儲存庫 ·
            <span v-if="app.saving.value" class="text-brand">同步中…</span>
            <span v-else-if="app.syncOk.value" class="text-status-done">{{ app.syncOk.value }}</span>
            <span v-else-if="app.syncError.value" class="text-status-todo">同步失敗</span>
            <span v-else>就緒</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            v-if="app.config.value"
            class="hidden rounded-full bg-panel px-3 py-1 text-xs text-mute sm:inline"
          >
            {{ app.config.value.owner }}/{{ app.config.value.repo }}
          </span>
          <button
            v-if="app.config.value"
            type="button"
            class="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-soft"
            @click="handleLogout"
          >
            登出 / 清除 Token
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
      正在驗證 GitHub 並載入資料…
    </div>

    <SetupModal
      v-if="showSetup"
      :error="bootError"
      :loading="app.loading.value"
      @submit="handleLogin"
    />
  </div>
</template>
