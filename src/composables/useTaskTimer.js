import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ensureNotificationPermission, showAppNotification } from '../lib/notifications'
import { formatLocalDateTime, parseLocalDateTime } from '../lib/utils'

const STORAGE_KEY = 'karen-active-timer'
const SETTINGS_KEY = 'karen-timer-settings'

function loadActive() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.startAt) return null
    return parsed
  } catch {
    return null
  }
}

function saveActive(data) {
  if (!data) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { reminderMinutes: 30 }
    const parsed = JSON.parse(raw)
    return {
      reminderMinutes: Number(parsed?.reminderMinutes) >= 0 ? Number(parsed.reminderMinutes) : 30
    }
  } catch {
    return { reminderMinutes: 30 }
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h} 小時 ${m} 分 ${s} 秒`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

export function useTaskTimer() {
  const active = ref(loadActive())
  const settings = ref(loadSettings())
  const nowTick = ref(Date.now())
  const showEndDialog = ref(false)
  const notifyHint = ref('')

  let tickTimer = null

  const isRunning = computed(() => !!active.value?.startAt)

  const startMoment = computed(() => {
    if (!active.value?.startAt) return null
    return parseLocalDateTime(active.value.startAt)
  })

  const elapsedMs = computed(() => {
    if (!startMoment.value) return 0
    return nowTick.value - startMoment.value.getTime()
  })

  const elapsedLabel = computed(() => formatElapsed(elapsedMs.value))

  const reminderMinutes = computed({
    get: () => settings.value.reminderMinutes,
    set: (v) => {
      settings.value = { reminderMinutes: Number(v) }
      saveSettings(settings.value)
      if (active.value) {
        syncNextReminder()
        saveActive(active.value)
      }
    }
  })

  function syncNextReminder() {
    if (!active.value?.startAt) return
    const mins = settings.value.reminderMinutes
    active.value.reminderMinutes = mins
    if (mins <= 0) {
      active.value.nextReminderAt = null
      return
    }
    const start = parseLocalDateTime(active.value.startAt)
    if (!start) return
    const interval = mins * 60_000
    let next = start.getTime() + interval
    while (next <= Date.now()) next += interval
    active.value.nextReminderAt = formatLocalDateTime(new Date(next), true)
  }

  function startTicking() {
    if (tickTimer != null) return
    tickTimer = window.setInterval(() => {
      nowTick.value = Date.now()
      checkReminders()
    }, 1000)
  }

  function stopTicking() {
    if (tickTimer != null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  async function checkReminders() {
    if (!active.value?.nextReminderAt || settings.value.reminderMinutes <= 0) return
    const next = parseLocalDateTime(active.value.nextReminderAt)
    if (!next || Date.now() < next.getTime()) return

    void showAppNotification('仍在計時中', `已 ${formatElapsed(elapsedMs.value)}`, 'karen-timer-reminder')

    const interval = settings.value.reminderMinutes * 60_000
    let ts = next.getTime()
    while (ts <= Date.now()) ts += interval
    active.value.nextReminderAt = formatLocalDateTime(new Date(ts), true)
    saveActive(active.value)
  }

  async function startTimer() {
    const granted = await ensureNotificationPermission()
    if (!granted) {
      notifyHint.value = '未允許通知：縮小後可能收不到提醒。請到 Safari／設定 → 通知 開啟。'
    } else {
      notifyHint.value = ''
    }

    const startAt = formatLocalDateTime(new Date(), true)
    active.value = {
      startAt,
      reminderMinutes: settings.value.reminderMinutes,
      nextReminderAt: null
    }
    syncNextReminder()
    saveActive(active.value)
    nowTick.value = Date.now()
    startTicking()

    if (granted) {
      void showAppNotification('任務開始啦！', '加油～', 'karen-timer-start')
    }
  }

  function openEndDialog() {
    if (!isRunning.value) return
    showEndDialog.value = true
  }

  function closeEndDialog() {
    showEndDialog.value = false
  }

  /** 結束計時用的時間區間（不清除計時狀態） */
  function getFinishRange() {
    if (!active.value?.startAt) return null
    const startAt = active.value.startAt
    const start = parseLocalDateTime(startAt)
    if (!start) return null
    let end = new Date()
    if (end <= start) {
      end = new Date(start.getTime() + 1000)
    }
    return {
      startAt,
      endAt: formatLocalDateTime(end, true)
    }
  }

  async function finalizeAfterSave() {
    active.value = null
    saveActive(null)
    stopTicking()
    showEndDialog.value = false
    nowTick.value = Date.now()
    void showAppNotification('任務結束啦！', '恭喜～', 'karen-timer-end')
  }

  function onVisibilityChange() {
    nowTick.value = Date.now()
    if (document.visibilityState === 'visible' && isRunning.value) {
      checkReminders()
    }
  }

  onMounted(() => {
    if (isRunning.value) {
      nowTick.value = Date.now()
      syncNextReminder()
      saveActive(active.value)
      startTicking()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    stopTicking()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  watch(isRunning, (running) => {
    if (running) startTicking()
    else stopTicking()
  })

  return {
    active,
    isRunning,
    elapsedLabel,
    elapsedMs,
    reminderMinutes,
    showEndDialog,
    notifyHint,
    startTimer,
    openEndDialog,
    closeEndDialog,
    getFinishRange,
    finalizeAfterSave,
    ensureNotificationPermission
  }
}
