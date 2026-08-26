/** @typedef {'done' | 'in_progress' | 'todo'} TaskStatus */
/** @typedef {'plan' | 'schedule'} TaskKind */

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

/** 每日格內項目：計劃（可追蹤狀態）／日程（純紀錄） */
export const TASK_KIND = {
  plan: 'plan',
  schedule: 'schedule'
}

export const TASK_KIND_META = {
  plan: { label: '計劃' },
  schedule: { label: '日程' }
}

export function normalizeTaskKind(kind) {
  return kind === TASK_KIND.schedule ? TASK_KIND.schedule : TASK_KIND.plan
}

export function isPlanTask(task) {
  return normalizeTaskKind(task?.kind) === TASK_KIND.plan
}

/** 佔用幾個連續時段（至少 1） */
export function taskDuration(task) {
  const d = Number(task?.duration)
  if (!Number.isFinite(d) || d < 1) return 1
  return Math.min(Math.floor(d), TIME_SLOTS.length)
}

export function slotIndex(slot) {
  return TIME_SLOTS.indexOf(slot)
}

export function clampDuration(startSlot, duration) {
  const i = slotIndex(startSlot)
  if (i < 0) return 1
  const d = Number(duration)
  const hours = Number.isFinite(d) && d >= 1 ? Math.floor(d) : 1
  return Math.max(1, Math.min(hours, TIME_SLOTS.length - i))
}

export function maxDurationFrom(startSlot) {
  const i = slotIndex(startSlot)
  if (i < 0) return 1
  return TIME_SLOTS.length - i
}

/** 結束時刻（最後一個佔用時段的下一整點） */
export function taskEndLabel(task) {
  const start = task?.timeSlot
  const i = slotIndex(start)
  if (i < 0) return start || ''
  const d = clampDuration(start, taskDuration(task))
  const endIdx = i + d
  if (endIdx < TIME_SLOTS.length) return TIME_SLOTS[endIdx]
  const last = TIME_SLOTS[TIME_SLOTS.length - 1]
  const h = (Number(last.slice(0, 2)) + 1) % 24
  return `${pad(h)}:00`
}

export function formatTimeRange(task) {
  const start = task?.timeSlot || ''
  const d = clampDuration(start, taskDuration(task))
  if (d <= 1) return start
  return `${start}–${taskEndLabel(task)}`
}

export function taskCoversSlot(task, dateKey, timeSlot) {
  if (!task || task.date !== dateKey) return false
  const i = slotIndex(task.timeSlot)
  const j = slotIndex(timeSlot)
  if (i < 0 || j < 0) return false
  const d = clampDuration(task.timeSlot, taskDuration(task))
  return j >= i && j < i + d
}

/**
 * 同一天重疊項目並排分欄（Google 日曆風格）
 * @returns {Map<string, { lane: number, lanes: number }>}
 */
export function layoutDayOverlaps(tasks) {
  const items = tasks
    .map((t) => {
      const start = slotIndex(t.timeSlot)
      if (start < 0) return null
      const dur = clampDuration(t.timeSlot, taskDuration(t))
      return { id: t.id, start, end: start + dur }
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const laneEnds = []
  const laneOf = new Map()

  for (const item of items) {
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(item.end)
    } else {
      laneEnds[lane] = item.end
    }
    laneOf.set(item.id, lane)
  }

  const result = new Map()
  for (const item of items) {
    const peers = items.filter((o) => o.start < item.end && o.end > item.start)
    const maxLane = Math.max(...peers.map((o) => laneOf.get(o.id)))
    result.set(item.id, { lane: laneOf.get(item.id), lanes: maxLane + 1 })
  }
  return result
}

/**
 * 選中高亮色（務必同步）：
 * 日曆選中日、全部計劃篩選 chip、每日計劃「本週」、每日計劃進度條／百分比、圓環
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
    todos: [],
    keyPlans: [],
    reviews: {}
  }
}

/** 相容舊版純陣列 tasks.json */
export function normalizeStore(raw) {
  if (Array.isArray(raw)) {
    return {
      version: 1,
      tasks: raw.map(normalizeTask),
      todos: [],
      keyPlans: [],
      reviews: {}
    }
  }
  return {
    version: 1,
    tasks: (Array.isArray(raw?.tasks) ? raw.tasks : []).map(normalizeTask),
    todos: Array.isArray(raw?.todos) ? raw.todos : [],
    keyPlans: Array.isArray(raw?.keyPlans) ? raw.keyPlans : [],
    reviews: raw?.reviews && typeof raw.reviews === 'object' ? raw.reviews : {}
  }
}

export function normalizeTask(task) {
  if (!task || typeof task !== 'object') return task
  const kind = normalizeTaskKind(task.kind)
  const timeSlot = task.timeSlot || TIME_SLOTS[0]
  return {
    ...task,
    kind,
    timeSlot,
    duration: clampDuration(timeSlot, taskDuration(task)),
    status: kind === TASK_KIND.schedule ? undefined : task.status || STATUS.todo
  }
}

export function countByStatus(tasks) {
  const base = { done: 0, in_progress: 0, todo: 0, total: 0 }
  for (const t of tasks) {
    if (!isPlanTask(t)) continue
    base.total += 1
    if (t.status in base) base[t.status] += 1
  }
  return base
}

export function completionRate(tasks) {
  const plans = tasks.filter(isPlanTask)
  if (!plans.length) return 0
  const done = plans.filter((t) => t.status === STATUS.done).length
  return (done / plans.length) * 100
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
