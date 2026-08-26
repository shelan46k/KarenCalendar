/** @typedef {'done' | 'in_progress' | 'todo'} TaskStatus */

export const STATUS = {
  done: 'done',
  in_progress: 'in_progress',
  todo: 'todo'
}

export const STATUS_CYCLE = [STATUS.todo, STATUS.in_progress, STATUS.done]

export const STATUS_META = {
  done: { label: '已完成', icon: '✓', class: 'bg-status-done', color: '#4a9b7a' },
  in_progress: { label: '進行中', icon: '❚', class: 'bg-status-progress', color: '#c4a035' },
  todo: { label: '未開始', icon: '✕', class: 'bg-status-todo', color: '#c96b6b' }
}

/**
 * 選中高亮色（務必同步）：
 * 日曆選中日、全部行程篩選 chip、每日計劃「本週」、每日計劃進度條／百分比、圓環
 */
export const SELECT_COLOR = '#BBAEE3'
export const selectBgStyle = { backgroundColor: SELECT_COLOR }
export const selectBorderBgStyle = {
  backgroundColor: SELECT_COLOR,
  borderColor: SELECT_COLOR
}

/** 06:00 ~ 05:00（隔天）共 24 小時 */
export const TIME_SLOTS = [
  ...Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`),
  ...Array.from({ length: 6 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
]

const STORAGE_KEY = 'karen-calendar-config'

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.token || !parsed?.owner || !parsed?.repo) return null
    return {
      token: parsed.token,
      owner: parsed.owner,
      repo: parsed.repo,
      path: parsed.path || 'tasks.json'
    }
  } catch {
    return null
  }
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY)
}

export function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function pad(n) {
  return String(n).padStart(2, '0')
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function formatDisplayDate(date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

export function formatHeaderMonth(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${pad(date.getMonth() + 1)} ${months[date.getMonth()]} / ${date.getFullYear()}`
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayLabel(date) {
  return `星期${WEEKDAY_LABELS[date.getDay()]}`
}

/** 以週一為一週起點 */
export function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function weekDates(anchor) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const start = startOfWeek(first)
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day))
  )
}

export function emptyStore() {
  return {
    version: 1,
    tasks: [],
    keyPlans: [],
    reviews: {}
  }
}

/** 相容舊版純陣列 tasks.json */
export function normalizeStore(raw) {
  if (Array.isArray(raw)) {
    return {
      version: 1,
      tasks: raw,
      keyPlans: [],
      reviews: {}
    }
  }
  return {
    version: 1,
    tasks: Array.isArray(raw?.tasks) ? raw.tasks : [],
    keyPlans: Array.isArray(raw?.keyPlans) ? raw.keyPlans : [],
    reviews: raw?.reviews && typeof raw.reviews === 'object' ? raw.reviews : {}
  }
}

export function countByStatus(tasks) {
  const base = { done: 0, in_progress: 0, todo: 0, total: 0 }
  for (const t of tasks) {
    base.total += 1
    if (t.status in base) base[t.status] += 1
  }
  return base
}

export function completionRate(tasks) {
  if (!tasks.length) return 0
  const done = tasks.filter((t) => t.status === STATUS.done).length
  return (done / tasks.length) * 100
}

export function formatRate(rate) {
  return `${rate.toFixed(1)}%`
}

export function nextStatus(status) {
  const idx = STATUS_CYCLE.indexOf(status)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

export function ensureKeyPlans(store, monthKey, count = 10) {
  const existing = store.keyPlans.filter((p) => p.month === monthKey)
  if (existing.length >= count) return existing.slice(0, count)

  const created = [...existing]
  while (created.length < count) {
    created.push({
      id: createId(),
      month: monthKey,
      title: '',
      status: STATUS.todo
    })
  }
  store.keyPlans = [
    ...store.keyPlans.filter((p) => p.month !== monthKey),
    ...created
  ]
  return created
}

export function getReview(store, monthKey) {
  return (
    store.reviews[monthKey] || {
      achievements: '',
      reflections: ''
    }
  )
}

export function debounce(fn, wait = 1500) {
  let timer = null
  const debounced = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }
  debounced.flush = (...args) => {
    if (timer == null) return
    clearTimeout(timer)
    timer = null
    fn(...args)
  }
  debounced.cancel = () => {
    clearTimeout(timer)
    timer = null
  }
  debounced.pending = () => timer != null
  return debounced
}

export function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

export function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
