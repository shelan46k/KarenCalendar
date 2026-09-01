import { computed, reactive, ref } from 'vue'
import { GitHubDataClient } from '../lib/github'
import {
  clearConfig,
  clampDuration,
  countByStatus,
  createId,
  debounce,
  emptyStore,
  getReview,
  isPlanTask,
  loadConfig,
  nextStatus,
  normalizeStore,
  normalizeTask,
  normalizeTaskKind,
  normalizeTimerCategory,
  normalizeHexColor,
  parseDateKey,
  parseLocalDateTime,
  saveConfig,
  STATUS,
  TASK_KIND,
  taskCoversSlot,
  taskColumnDate,
  taskDuration,
  taskStartMoment,
  toDateKey,
  toMonthKey
} from '../lib/utils'

export function useCalendarApp() {
  const config = ref(loadConfig())
  const client = ref(null)
  const store = reactive(emptyStore())
  const loading = ref(false)
  const saving = ref(false)
  const syncError = ref('')
  const syncOk = ref('')
  const selectedDate = ref(new Date())
  const viewMonth = ref(new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), 1))
  const weekAnchor = ref(new Date())
  const focusTaskId = ref(null)
  /** 每日計劃區篩選：'all' | 'plan' | 'schedule' */
  const weekViewFilter = ref('all')

  const monthKey = computed(() => toMonthKey(viewMonth.value))
  const selectedKey = computed(() => toDateKey(selectedDate.value))

  const todayTasks = computed(() =>
    store.tasks.filter((t) => t.date === toDateKey(new Date()) && isPlanTask(t))
  )
  const monthTasks = computed(() =>
    store.tasks.filter((t) => t.date.startsWith(monthKey.value) && isPlanTask(t))
  )
  const keyPlans = computed(() =>
    store.keyPlans.filter((p) => p.month === monthKey.value && String(p.title || '').trim())
  )
  const todos = computed(() =>
    store.todos.filter((t) => String(t.title || '').trim())
  )
  /** 本月統計：時程計劃 + 本月重點計劃（不含日程） */
  const monthItems = computed(() => {
    const plans = keyPlans.value.map((p) => ({ status: p.status }))
    return [...monthTasks.value, ...plans]
  })
  const todayStats = computed(() => countByStatus(todayTasks.value))
  const monthStats = computed(() => countByStatus(monthItems.value))
  const todayRate = computed(() => {
    const items = todayTasks.value
    if (!items.length) return 0
    const done = items.filter((t) => t.status === STATUS.done).length
    return (done / items.length) * 100
  })
  const monthRate = computed(() => {
    const items = monthItems.value
    if (!items.length) return 0
    const done = items.filter((t) => t.status === STATUS.done).length
    return (done / items.length) * 100
  })
  const review = computed(() => getReview(store, monthKey.value))

  let saveQueue = Promise.resolve()
  const scheduleSave = debounce((message) => {
    queueSave(message)
  }, 1500)

  function snapshot() {
    return {
      version: 1,
      tasks: store.tasks,
      todos: store.todos,
      keyPlans: store.keyPlans,
      reviews: store.reviews,
      timerCategories: store.timerCategories
    }
  }

  function queueSave(message = 'Update calendar data') {
    syncError.value = ''
    saving.value = true
    saveQueue = saveQueue
      .catch(() => {
        /* 前次失敗時仍允許後續寫入 */
      })
      .then(async () => {
        if (!client.value) return
        await client.value.save(snapshot(), message)
        syncOk.value = `已同步 ${new Date().toLocaleTimeString()}`
        setTimeout(() => {
          syncOk.value = ''
        }, 2500)
      })
      .catch((err) => {
        syncError.value = err.message || String(err)
      })
      .finally(() => {
        saving.value = false
      })
    return saveQueue
  }

  /** 計時結束：先鎖定再寫入，避免與背景更新競爭 */
  async function saveTimerSchedule({ title, startAt, endAt, categoryId, color }) {
    scheduleSave.cancel()
    saving.value = true
    syncError.value = ''
    saveQueue = saveQueue
      .catch(() => {})
      .then(async () => {
        upsertTask({
          title,
          kind: TASK_KIND.schedule,
          startAt,
          endAt,
          source: 'task-timer',
          categoryId,
          color
        })
        if (!client.value) {
          throw new Error('尚未登入')
        }
        await client.value.save(snapshot(), `Task timer: ${title}`)
        syncOk.value = `已同步 ${new Date().toLocaleTimeString()}`
        setTimeout(() => {
          syncOk.value = ''
        }, 2500)
      })
      .catch((err) => {
        syncError.value = err.message || String(err)
        throw err
      })
      .finally(() => {
        saving.value = false
      })
    return saveQueue
  }

  function persistNow(message) {
    scheduleSave.cancel()
    return queueSave(message)
  }

  function persistDebounced(message) {
    scheduleSave(message)
  }

  function applyLoaded(data) {
    const normalized = normalizeStore(data)
    store.version = normalized.version
    store.tasks = normalized.tasks
    store.todos = normalized.todos
    store.keyPlans = normalized.keyPlans.filter((p) => String(p.title || '').trim())
    store.reviews = normalized.reviews
    store.timerCategories = normalized.timerCategories || []
  }

  async function login(nextConfig) {
    loading.value = true
    syncError.value = ''
    try {
      const gh = new GitHubDataClient(nextConfig)
      await gh.validate()
      const data = await gh.load()
      Object.assign(store, emptyStore())
      applyLoaded(data)
      client.value = gh
      config.value = nextConfig
      saveConfig(nextConfig)
    } finally {
      loading.value = false
    }
  }

  function logout() {
    clearConfig()
    config.value = null
    client.value = null
    Object.assign(store, emptyStore())
  }

  async function bootstrap() {
    if (!config.value) return
    await login(config.value)
  }

  async function reloadData(options = {}) {
    const silent = options.silent === true
    if (!client.value) {
      throw new Error('尚未登入')
    }
    if (saving.value) return
    syncError.value = ''
    if (silent) {
      scheduleSave.flush('Auto sync before refresh')
      await saveQueue
    } else {
      await persistNow('Sync before refresh')
    }
    const data = await client.value.load()
    applyLoaded(data)
    if (!silent) {
      syncOk.value = `已重新讀取 ${new Date().toLocaleTimeString()}`
      setTimeout(() => {
        syncOk.value = ''
      }, 2500)
    }
  }

  function tasksOn(dateKey) {
    return store.tasks.filter((t) => taskColumnDate(t) === dateKey)
  }

  function tasksAt(dateKey, timeSlot) {
    return store.tasks.filter((t) => taskCoversSlot(t, dateKey, timeSlot))
  }

  function tasksStartingAt(dateKey, timeSlot) {
    return store.tasks.filter((t) => t.date === dateKey && t.timeSlot === timeSlot)
  }

  function taskAt(dateKey, timeSlot) {
    return tasksAt(dateKey, timeSlot)[0] || null
  }

  function upsertTask({
    id,
    date,
    timeSlot,
    title,
    status,
    kind,
    duration,
    startAt,
    endAt,
    source,
    categoryId,
    color
  }) {
    const draft = normalizeTask({
      id,
      date,
      timeSlot,
      title,
      status,
      kind,
      duration,
      startAt,
      endAt,
      source,
      categoryId,
      color
    })

    if (id) {
      const existing = store.tasks.find((t) => t.id === id)
      if (existing) {
        existing.title = title
        existing.date = draft.date
        existing.timeSlot = draft.timeSlot
        existing.duration = draft.duration
        existing.startAt = draft.startAt
        existing.endAt = draft.endAt
        existing.kind = draft.kind
        if (draft.source) existing.source = draft.source
        if (draft.categoryId) existing.categoryId = draft.categoryId
        else delete existing.categoryId
        if (draft.color) existing.color = draft.color
        else delete existing.color
        if (draft.kind === TASK_KIND.schedule) {
          delete existing.status
        } else {
          existing.status = draft.status
        }
        return
      }
    }
    const item = {
      id: id || createId(),
      title,
      date: draft.date,
      timeSlot: draft.timeSlot,
      duration: draft.duration,
      startAt: draft.startAt,
      endAt: draft.endAt,
      kind: draft.kind
    }
    if (draft.source) item.source = draft.source
    if (draft.categoryId) item.categoryId = draft.categoryId
    if (draft.color) item.color = draft.color
    if (draft.kind === TASK_KIND.plan) item.status = draft.status
    store.tasks.push(item)
  }

  function removeTask(id) {
    const idx = store.tasks.findIndex((t) => t.id === id)
    if (idx >= 0) store.tasks.splice(idx, 1)
  }

  function setTaskStatus(id, status) {
    const task = store.tasks.find((t) => t.id === id)
    if (!task || !isPlanTask(task)) return
    task.status = status
  }

  function cycleTaskStatus(id) {
    const task = store.tasks.find((t) => t.id === id)
    if (!task || !isPlanTask(task)) return
    task.status = nextStatus(task.status)
    persistNow(`Update task status: ${task.title || task.id}`)
  }

  function moveTask(id, date, timeSlot, kind) {
    const task = store.tasks.find((t) => t.id === id)
    if (!task) return
    const nextKind = kind ? normalizeTaskKind(kind) : normalizeTaskKind(task.kind)
    const draft = normalizeTask({
      ...task,
      date,
      timeSlot,
      kind: nextKind,
      duration: taskDuration(task),
      startAt: undefined,
      endAt: undefined
    })
    task.date = draft.date
    task.timeSlot = draft.timeSlot
    task.duration = draft.duration
    task.startAt = draft.startAt
    task.endAt = draft.endAt
    task.kind = draft.kind
    if (draft.kind === TASK_KIND.schedule) {
      delete task.status
    } else if (!task.status) {
      task.status = STATUS.todo
    }
    persistNow(`Move task: ${task.title || task.id}`)
  }

  function addTodo({ title }) {
    const trimmed = String(title || '').trim()
    if (!trimmed) return null
    const item = { id: createId(), title: trimmed }
    store.todos.push(item)
    persistNow('Add todo')
    return item
  }

  function updateTodo(id, patch) {
    const item = store.todos.find((t) => t.id === id)
    if (!item) return
    Object.assign(item, patch)
  }

  function removeTodo(id) {
    const idx = store.todos.findIndex((t) => t.id === id)
    if (idx < 0) return
    store.todos.splice(idx, 1)
    persistNow('Delete todo')
  }

  function reorderTodo(fromIndex, toIndex) {
    const list = store.todos
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return
    if (fromIndex === toIndex) return
    const [item] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, item)
    persistNow('Reorder todos')
  }

  /** 時段項目拖回待辦：建立待辦並移除原項目 */
  function placeTaskAsTodo(taskId) {
    const idx = store.tasks.findIndex((t) => t.id === taskId)
    if (idx < 0) return null
    const task = store.tasks[idx]
    const title = String(task.title || '').trim()
    if (!title) return null
    store.todos.push({ id: createId(), title })
    store.tasks.splice(idx, 1)
    persistNow(`Move task to todo: ${title}`)
    return true
  }

  /** 待辦拖到時段：建立計劃／日程並移除待辦 */
  function placeTodo(todoId, date, timeSlot, kind, startAt, endAt) {
    const idx = store.todos.findIndex((t) => t.id === todoId)
    if (idx < 0) return null
    const todo = store.todos[idx]
    const title = String(todo.title || '').trim()
    if (!title) return null
    upsertTask({
      date,
      timeSlot,
      title,
      kind,
      status: STATUS.todo,
      startAt,
      endAt
    })
    store.todos.splice(idx, 1)
    persistNow(`Place todo as ${normalizeTaskKind(kind)}: ${title}`)
    return true
  }

  function addKeyPlan({ title, status = STATUS.todo }) {
    const trimmed = String(title || '').trim()
    if (!trimmed) return null
    const plan = {
      id: createId(),
      month: monthKey.value,
      title: trimmed,
      status
    }
    store.keyPlans.push(plan)
    persistNow('Add key plan')
    return plan
  }

  function updateKeyPlan(id, patch) {
    const plan = store.keyPlans.find((p) => p.id === id)
    if (!plan) return
    Object.assign(plan, patch)
  }

  function removeKeyPlan(id) {
    const idx = store.keyPlans.findIndex((p) => p.id === id)
    if (idx < 0) return
    store.keyPlans.splice(idx, 1)
    persistNow('Delete key plan')
  }

  function cycleKeyPlanStatus(id) {
    const plan = store.keyPlans.find((p) => p.id === id)
    if (!plan) return
    plan.status = nextStatus(plan.status)
    persistNow('Update key plan status')
  }

  function jumpToTask(task) {
    if (!task?.date && !task?.startAt) return
    const start = taskStartMoment(task)
    const date = start || parseDateKey(task.date)
    selectedDate.value = date
    weekAnchor.value = date
    viewMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
    if (!isPlanTask(task)) {
      weekViewFilter.value = 'schedule'
    }
    focusTaskId.value = task.id
  }

  function clearFocusTask() {
    focusTaskId.value = null
  }

  function updateReview(field, value) {
    if (!store.reviews[monthKey.value]) {
      store.reviews[monthKey.value] = { achievements: '', reflections: '' }
    }
    store.reviews[monthKey.value][field] = value
    persistDebounced('Update monthly review')
  }

  /** 計時結束等：跳到該日程所在週並顯示日程 */
  function goToScheduleDate(startAt) {
    const d = parseLocalDateTime(startAt) || new Date()
    weekAnchor.value = d
    selectedDate.value = d
    viewMonth.value = new Date(d.getFullYear(), d.getMonth(), 1)
    weekViewFilter.value = 'schedule'
  }

  function addTimerCategory({ name, color }) {
    const cat = normalizeTimerCategory({ id: createId(), name, color })
    if (!cat) return null
    store.timerCategories.push(cat)
    persistDebounced('Add timer category')
    return cat
  }

  function updateTimerCategory(id, patch) {
    const item = store.timerCategories.find((c) => c.id === id)
    if (!item) return
    if (patch.name != null) {
      const name = String(patch.name).trim()
      if (name) item.name = name
    }
    if (patch.color != null) {
      const hex = normalizeHexColor(patch.color)
      if (hex) item.color = hex
    }
    persistDebounced('Update timer category')
  }

  function removeTimerCategory(id) {
    const idx = store.timerCategories.findIndex((c) => c.id === id)
    if (idx < 0) return
    store.timerCategories.splice(idx, 1)
    persistDebounced('Remove timer category')
  }

  return {
    config,
    loading,
    saving,
    syncError,
    syncOk,
    store,
    selectedDate,
    viewMonth,
    weekAnchor,
    focusTaskId,
    weekViewFilter,
    monthKey,
    selectedKey,
    todayStats,
    todayRate,
    monthStats,
    monthRate,
    keyPlans,
    todos,
    review,
    login,
    logout,
    bootstrap,
    reloadData,
    tasksOn,
    tasksAt,
    tasksStartingAt,
    taskAt,
    upsertTask,
    removeTask,
    setTaskStatus,
    cycleTaskStatus,
    moveTask,
    addTodo,
    updateTodo,
    removeTodo,
    reorderTodo,
    placeTodo,
    placeTaskAsTodo,
    updateKeyPlan,
    addKeyPlan,
    removeKeyPlan,
    cycleKeyPlanStatus,
    updateReview,
    jumpToTask,
    clearFocusTask,
    goToScheduleDate,
    saveTimerSchedule,
    addTimerCategory,
    updateTimerCategory,
    removeTimerCategory,
    persistNow,
    persistDebounced
  }
}
