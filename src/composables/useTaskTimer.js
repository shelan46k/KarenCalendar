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
    return {
      ...parsed,
      pausedMs: Number(parsed.pausedMs) >= 0 ? Number(parsed.pausedMs) : 0,
      pausedAt: parsed.pausedAt || null
    }
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

  const isPaused = computed(() => !!active.value?.pausedAt)

  const startMoment = computed(() => {
    if (!active.value?.startAt) return null
    return parseLocalDateTime(active.value.startAt)
  })

  /** 已累積暫停 + 目前這段暫停（若正在暫停） */
  function totalPausedMsAt(nowMs) {
    if (!active.value) return 0
    let total = Number(active.value.pausedMs) || 0
    if (active.value.pausedAt) {
      const pausedStart = parseLocalDateTime(active.value.pausedAt)
      if (pausedStart) total += Math.max(0, nowMs - pausedStart.getTime())
    }
    return total
  }

  const elapsedMs = computed(() => {
    if (!startMoment.value) return 0
    const wall = nowTick.value - startMoment.value.getTime()
    return Math.max(0, wall - totalPausedMsAt(nowTick.value))
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
    if (!active.value?.startAt || active.value.pausedAt) {
      if (active.value) active.value.nextReminderAt = null
      return
    }
    const mins = settings.value.reminderMinutes
    active.value.reminderMinutes = mins
    if (mins <= 0) {
      active.value.nextReminderAt = null
      return
    }
    const interval = mins * 60_000
    // 以「有效工作時間」為準：下次提醒 = 現在 + 剩餘到下一個間隔
    const worked = elapsedMs.value
    const nextWorked = Math.floor(worked / interval) * interval + interval
    const delay = Math.max(1000, nextWorked - worked)
    active.value.nextReminderAt = formatLocalDateTime(new Date(Date.now() + delay), true)
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
    if (active.value.pausedAt) return
    const next = parseLocalDateTime(active.value.nextReminderAt)
    if (!next || Date.now() < next.getTime()) return

    void showAppNotification('仍在計時中', `已 ${formatElapsed(elapsedMs.value)}`, 'karen-timer-reminder')
    syncNextReminder()
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
      pausedMs: 0,
      pausedAt: null,
      reminderMinutes: settings.value.reminderMinutes,
      nextReminderAt: null
    }
    nowTick.value = Date.now()
    syncNextReminder()
    saveActive(active.value)
    startTicking()

    if (granted) {
      void showAppNotification('任務開始啦！', '加油～', 'karen-timer-start')
    }
  }

  function pauseTimer() {
    if (!active.value?.startAt || active.value.pausedAt) return
    active.value.pausedAt = formatLocalDateTime(new Date(), true)
    active.value.nextReminderAt = null
    saveActive(active.value)
    nowTick.value = Date.now()
  }

  function resumeTimer() {
    if (!active.value?.startAt || !active.value.pausedAt) return
    const pausedStart = parseLocalDateTime(active.value.pausedAt)
    const now = Date.now()
    if (pausedStart) {
      active.value.pausedMs = (Number(active.value.pausedMs) || 0) + Math.max(0, now - pausedStart.getTime())
    }
    active.value.pausedAt = null
    nowTick.value = now
    syncNextReminder()
    saveActive(active.value)
  }

  function openEndDialog() {
    if (!isRunning.value) return
    showEndDialog.value = true
  }

  function closeEndDialog() {
    showEndDialog.value = false
  }

  /**
   * 結束計時用的時間區間（不清除計時狀態）
   * endAt = 實際結束時刻 − 暫停總時長，使紀錄時長 = 有效工作時間
   * 例：1:00 開始、1:50 結束、暫停 10 分 → 記錄 1:00–1:40
   */
  function getFinishRange() {
    if (!active.value?.startAt) return null
    const startAt = active.value.startAt
    const start = parseLocalDateTime(startAt)
    if (!start) return null

    const now = Date.now()
    const paused = totalPausedMsAt(now)
    let end = new Date(now - paused)
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
    if (document.visibilityState === 'visible' && isRunning.value && !isPaused.value) {
      checkReminders()
    }
  }

  onMounted(() => {
    if (isRunning.value) {
      nowTick.value = Date.now()
      if (!isPaused.value) syncNextReminder()
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
    isPaused,
    elapsedLabel,
    elapsedMs,
    reminderMinutes,
    showEndDialog,
    notifyHint,
    startTimer,
    pauseTimer,
    resumeTimer,
    openEndDialog,
    closeEndDialog,
    getFinishRange,
    finalizeAfterSave,
    ensureNotificationPermission
  }
}
