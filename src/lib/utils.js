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

/** 每日格 00:00–23:59，共 1440 分鐘 */
export const DAY_VIEW_MINUTES = 24 * 60

/** 佔用幾個連續時段（至少 1） */
export function taskDuration(task) {
  const d = Number(task?.duration)
  if (!Number.isFinite(d) || d < 1) return 1
  return Math.min(Math.floor(d), TIME_SLOTS.length)
}

/** 解析本地時間字串 YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss（不含時區） */
export function parseLocalDateTime(value) {
  if (!value || typeof value !== 'string') return null
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0), 0)
}

export function formatLocalDateTime(date, withSeconds = false) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const base = `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base
}

/** 行事曆欄日期（與日曆 0 點對齊） */
export function calendarDateKeyFromMoment(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return toDateKey(d)
}

export function dayViewStart(dateKey) {
  const d = parseDateKey(dateKey)
  d.setHours(0, 0, 0, 0)
  return d
}

export function taskStartMoment(task) {
  if (task?.startAt) {
    const parsed = parseLocalDateTime(task.startAt)
    if (parsed) return parsed
  }
  if (task?.date && task?.timeSlot) {
    return momentFromColumnDateAndClock(task.date, task.timeSlot)
  }
  return null
}

export function taskEndMoment(task) {
  if (task?.endAt) {
    const parsed = parseLocalDateTime(task.endAt)
    if (parsed) return parsed
  }
  const start = taskStartMoment(task)
  if (!start) return null
  const hours = clampDuration(task.timeSlot, taskDuration(task))
  const end = new Date(start)
  end.setHours(end.getHours() + hours, 0, 0, 0)
  return end
}

/** 項目在指定日期欄上的分鐘區間（相對該欄 00:00） */
export function taskTimelineOnDate(task, dateKey) {
  const start = taskStartMoment(task)
  const end = taskEndMoment(task)
  if (!start || !end || end <= start) return null

  const dayStart = dayViewStart(dateKey)
  const dayEnd = addDays(dayStart, 1)

  if (end <= dayStart || start >= dayEnd) return null

  const clipStart = start > dayStart ? start : dayStart
  const clipEnd = end < dayEnd ? end : dayEnd
  const startMin = (clipStart - dayStart) / 60000
  const endMin = (clipEnd - dayStart) / 60000
  if (endMin <= startMin) return null
  return { startMin, endMin }
}

/** 項目是否與指定日期欄重疊（跨日時可在多日各顯示一格） */
export function taskOverlapsDate(task, dateKey) {
  return taskTimelineOnDate(task, dateKey) != null
}

/** 項目是否與日期區間 [fromKey, toKey] 重疊（含起迄日） */
export function taskOverlapsDateRange(task, fromKey, toKey) {
  const start = taskStartMoment(task)
  const end = taskEndMoment(task)
  if (!start || !end || !fromKey || !toKey) return false
  let from = fromKey
  let to = toKey
  if (from > to) {
    const tmp = from
    from = to
    to = tmp
  }
  const rangeStart = parseDateKey(from)
  rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = parseDateKey(to)
  rangeEnd.setHours(23, 59, 59, 999)
  return start.getTime() <= rangeEnd.getTime() && end.getTime() >= rangeStart.getTime()
}

export function taskColumnDate(task) {
  const start = taskStartMoment(task)
  if (start) return calendarDateKeyFromMoment(start)
  return task?.date || ''
}

export function buildStartAtFromSlot(date, timeSlot) {
  return formatLocalDateTime(momentFromColumnDateAndClock(date, timeSlot), true)
}

export function buildEndAtFromSlot(date, timeSlot, duration) {
  const start = parseLocalDateTime(buildStartAtFromSlot(date, timeSlot))
  const end = new Date(start)
  end.setHours(end.getHours() + clampDuration(timeSlot, duration), 0, 0, 0)
  return formatLocalDateTime(end, true)
}

export function buildRangeFromClock(date, startTime, endTime) {
  const start = momentFromColumnDateAndClock(date, startTime)
  let end = momentFromColumnDateAndClock(date, endTime)
  if (end <= start) {
    end = new Date(end)
    end.setDate(end.getDate() + 1)
  }
  return {
    startAt: formatLocalDateTime(start, true),
    endAt: formatLocalDateTime(end, true)
  }
}

/** `datetime-local` 輸入值（YYYY-MM-DDTHH:mm） */
export function toDatetimeLocalValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function parseDatetimeLocalValue(value) {
  if (!value || typeof value !== 'string') return null
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  const [, datePart, h, mi, s] = m
  return parseLocalDateTime(`${datePart}T${h}:${mi}:${s || '00'}`)
}

export function defaultEndDatetimeLocal(startLocal, hours = 1) {
  const start = parseDatetimeLocalValue(startLocal)
  if (!start) return ''
  return toDatetimeLocalValue(new Date(start.getTime() + hours * 3600000))
}

export function buildRangeFromDatetimeLocal(startLocal, endLocal) {
  const start = parseDatetimeLocalValue(startLocal)
  let end = parseDatetimeLocalValue(endLocal)
  if (!start || !end) return null
  if (end <= start) {
    end = new Date(end)
    end.setDate(end.getDate() + 1)
  }
  if (end <= start) return null
  return {
    startAt: formatLocalDateTime(start, true),
    endAt: formatLocalDateTime(end, true)
  }
}

function durationHoursFromMoments(start, end) {
  const ms = end - start
  return Math.max(1, Math.ceil(ms / 3600000))
}

function slotFromMoment(date) {
  return `${pad(date.getHours())}:00`
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
  const start = taskStartMoment(task)
  const end = taskEndMoment(task)
  if (start && end) {
    const sh = pad(start.getHours())
    const sm = pad(start.getMinutes())
    const ss = pad(start.getSeconds())
    const eh = pad(end.getHours())
    const em = pad(end.getMinutes())
    const es = pad(end.getSeconds())
    const showSec = start.getSeconds() !== 0 || end.getSeconds() !== 0
    const s = showSec ? `${sh}:${sm}:${ss}` : `${sh}:${sm}`
    const e = showSec ? `${eh}:${em}:${es}` : `${eh}:${em}`
    if (s === e) return s
    if (toDateKey(start) !== toDateKey(end)) {
      const sd = `${start.getMonth() + 1}/${start.getDate()}`
      const ed = `${end.getMonth() + 1}/${end.getDate()}`
      return `${sd} ${s} – ${ed} ${e}`
    }
    return `${s}–${e}`
  }
  const slot = task?.timeSlot || ''
  const d = clampDuration(slot, taskDuration(task))
  if (d <= 1) return slot
  return `${slot}–${taskEndLabel(task)}`
}

export function taskCoversSlot(task, dateKey, timeSlot) {
  const range = taskTimelineOnDate(task, dateKey)
  if (!range) return false
  const j = slotIndex(timeSlot)
  if (j < 0) return false
  const slotStart = j * 60
  const slotEnd = slotStart + 60
  return range.startMin < slotEnd && range.endMin > slotStart
}

/**
 * 同一天重疊項目並排分欄（Google 日曆風格）
 * @returns {Map<string, { lane: number, lanes: number }>}
 */
export function layoutDayOverlaps(tasks, dateKey) {
  const items = tasks
    .map((t) => {
      const range = taskTimelineOnDate(t, dateKey)
      if (!range) return null
      return { id: t.id, start: range.startMin, end: range.endMin }
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

/** 00:00 ~ 23:00 共 24 小時 */
export const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

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

/** 週曆欄日期 + 時鐘／時段 → 實際時刻（當日 0 點起算） */
export function momentFromColumnDateAndClock(dateKey, timeOrSlot) {
  const raw = String(timeOrSlot || '09:00')
  const parts = raw.split(':').map(Number)
  const h = parts[0] ?? 9
  const m = parts[1] ?? 0
  const s = parts[2] ?? 0
  const d = parseDateKey(dateKey)
  d.setHours(h, m, s, 0)
  return d
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
    reviews: {},
    timerCategories: []
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
      reviews: {},
      timerCategories: []
    }
  }
  return {
    version: 1,
    tasks: (Array.isArray(raw?.tasks) ? raw.tasks : []).map(normalizeTask),
    todos: Array.isArray(raw?.todos) ? raw.todos : [],
    keyPlans: Array.isArray(raw?.keyPlans) ? raw.keyPlans : [],
    reviews: raw?.reviews && typeof raw.reviews === 'object' ? raw.reviews : {},
    timerCategories: (Array.isArray(raw?.timerCategories) ? raw.timerCategories : [])
      .map(normalizeTimerCategory)
      .filter(Boolean)
  }
}

export function normalizeHexColor(value) {
  const s = String(value || '').trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`
  return null
}

export function normalizeTimerCategory(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim()
  const color = normalizeHexColor(raw.color)
  if (!name || !color) return null
  return {
    id: raw.id || createId(),
    name,
    color
  }
}

export function resolveTaskColor(task, categories = []) {
  const direct = normalizeHexColor(task?.color)
  if (direct) return direct
  const cat = categories.find((c) => c.id === task?.categoryId)
  return cat?.color || null
}

/** 自訂補充文字外框（分類後方的備註） */
export function wrapTaskNote(text) {
  const inner = unwrapTaskNote(text)
  if (!inner) return ''
  return `「${inner}」`
}

export function unwrapTaskNote(text) {
  const t = String(text || '').trim()
  const m = t.match(/^「(.+)」$/) || t.match(/^【(.+)】$/) || t.match(/^\[(.+)\]$/)
  return m ? m[1].trim() : t
}

/** 組合儲存標題：分類在前，備註以「」包住 */
export function composeTaskTitle(categoryName, note) {
  const cat = String(categoryName || '').trim()
  const noteInner = unwrapTaskNote(note)
  const notePart = noteInner ? wrapTaskNote(noteInner) : ''
  if (cat && notePart) return `${cat}${notePart}`
  if (cat) return cat
  if (notePart) return notePart
  return ''
}

/** 編輯表單：還原分類與備註欄位 */
export function parseTaskTitleForEdit(task, categories = []) {
  const title = String(task?.title || '').trim()
  const cat = categories.find((c) => c.id === task?.categoryId)
  if (!cat) {
    return { categoryId: null, note: unwrapTaskNote(title) }
  }
  if (title === cat.name) {
    return { categoryId: cat.id, note: '' }
  }
  if (title.startsWith(cat.name)) {
    return { categoryId: cat.id, note: unwrapTaskNote(title.slice(cat.name.length)) }
  }
  return { categoryId: cat.id, note: unwrapTaskNote(title) }
}

/** 日程格子 inline 樣式（依分類色） */
export function scheduleStyleFromColor(color) {
  const hex = normalizeHexColor(color)
  if (!hex) return undefined
  return {
    backgroundColor: `color-mix(in srgb, ${hex} 38%, white)`,
    borderColor: `color-mix(in srgb, ${hex} 65%, white)`
  }
}

export function normalizeTask(task) {
  if (!task || typeof task !== 'object') return task
  const kind = normalizeTaskKind(task.kind)

  let startAt = task.startAt
  let endAt = task.endAt
  let date = task.date
  let timeSlot = task.timeSlot
  let duration = task.duration

  if (startAt && endAt) {
    const start = parseLocalDateTime(startAt)
    let end = parseLocalDateTime(endAt)
    if (start && end) {
      if (end <= start) {
        end = new Date(start.getTime() + 1000)
      }
      startAt = formatLocalDateTime(start, true)
      endAt = formatLocalDateTime(end, true)
      date = calendarDateKeyFromMoment(start)
      timeSlot = slotFromMoment(start)
      duration = clampDuration(timeSlot, durationHoursFromMoments(start, end))
    } else {
      startAt = undefined
      endAt = undefined
    }
  }

  if (!startAt || !endAt) {
    timeSlot = timeSlot || TIME_SLOTS[0]
    date = date || toDateKey(new Date())
    duration = clampDuration(timeSlot, taskDuration({ ...task, duration }))
    startAt = buildStartAtFromSlot(date, timeSlot)
    endAt = buildEndAtFromSlot(date, timeSlot, duration)
  }

  return {
    ...task,
    kind,
    date,
    timeSlot,
    duration,
    startAt,
    endAt,
    ...(task.categoryId ? { categoryId: task.categoryId } : {}),
    ...(normalizeHexColor(task.color) ? { color: normalizeHexColor(task.color) } : {}),
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
