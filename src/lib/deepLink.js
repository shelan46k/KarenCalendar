const PENDING_ACTION_KEY = 'karen-pending-action'

const START_ALIASES = new Set(['start-timer', 'start', 'timer-start'])
const END_ALIASES = new Set(['end-timer', 'end', 'stop-timer', 'timer-end', 'stop'])

export function normalizeTimerAction(raw) {
  const action = String(raw || '')
    .trim()
    .toLowerCase()
  if (START_ALIASES.has(action)) return 'start-timer'
  if (END_ALIASES.has(action)) return 'end-timer'
  return null
}

export function readTimerActionFromUrl() {
  try {
    return normalizeTimerAction(new URLSearchParams(window.location.search).get('action'))
  } catch {
    return null
  }
}

export function clearTimerActionFromUrl() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('action')) return
    url.searchParams.delete('action')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(null, '', next)
  } catch {
    // ignore
  }
}

export function stashPendingTimerAction(action) {
  if (!action) return
  try {
    sessionStorage.setItem(PENDING_ACTION_KEY, action)
  } catch {
    // ignore
  }
}

export function takePendingTimerAction() {
  try {
    const action = sessionStorage.getItem(PENDING_ACTION_KEY)
    sessionStorage.removeItem(PENDING_ACTION_KEY)
    return normalizeTimerAction(action)
  } catch {
    return null
  }
}

/** @returns {Promise<'handled' | 'pending' | 'noop'>} */
export async function applyTimerAction(action, { timer, isLoggedIn }) {
  const normalized = normalizeTimerAction(action)
  if (!normalized) return 'noop'

  if (!isLoggedIn) {
    stashPendingTimerAction(normalized)
    return 'pending'
  }

  if (normalized === 'start-timer') {
    if (!timer.isRunning.value) await timer.startTimer()
  } else if (normalized === 'end-timer') {
    timer.openEndDialog()
  }

  clearTimerActionFromUrl()
  return 'handled'
}
