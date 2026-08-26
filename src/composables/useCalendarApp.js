import { computed, reactive, ref } from 'vue'
import { GitHubDataClient } from '../lib/github'
import {
  clearConfig,
  countByStatus,
  createId,
  debounce,
  emptyStore,
  getReview,
  loadConfig,
  nextStatus,
  parseDateKey,
  saveConfig,
  STATUS,
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

  const monthKey = computed(() => toMonthKey(viewMonth.value))
  const selectedKey = computed(() => toDateKey(selectedDate.value))

  const todayTasks = computed(() =>
    store.tasks.filter((t) => t.date === toDateKey(new Date()))
  )
  const monthTasks = computed(() =>
    store.tasks.filter((t) => t.date.startsWith(monthKey.value))
  )
  const keyPlans = computed(() =>
    store.keyPlans.filter((p) => p.month === monthKey.value && String(p.title || '').trim())
  )
  /** 本月統計：時程任務 + 本月重點計劃 */
  const monthItems = computed(() => {
    const plans = keyPlans.value.map((p) => ({ status: p.status }))
    return [...monthTasks.value, ...plans]
  })
  const todayStats = computed(() => countByStatus(todayTasks.value))
  const monthStats = computed(() => countByStatus(monthItems.value))
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

  function queueSave(message = 'Update calendar data') {
    syncError.value = ''
    saveQueue = saveQueue
      .then(async () => {
        if (!client.value) return
        saving.value = true
        await client.value.save(
          {
            version: 1,
            tasks: store.tasks,
            keyPlans: store.keyPlans,
            reviews: store.reviews
          },
          message
        )
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

  function persistNow(message) {
    scheduleSave.cancel()
    return queueSave(message)
  }

  function persistDebounced(message) {
    scheduleSave(message)
  }

  async function login(nextConfig) {
    loading.value = true
    syncError.value = ''
    try {
      const gh = new GitHubDataClient(nextConfig)
      await gh.validate()
      const data = await gh.load()
      Object.assign(store, emptyStore(), data)
      // 清掉舊版自動產生的空白重點計劃
      store.keyPlans = store.keyPlans.filter((p) => String(p.title || '').trim())
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

  /** 只重抓 GitHub 資料，不登出、不整頁刷新 */
  async function reloadData(options = {}) {
    const silent = options.silent === true
    if (!client.value) {
      throw new Error('尚未登入')
    }
    if (saving.value) return
    syncError.value = ''
    if (silent) {
      // 背景更新：只在有 debounce 待寫入時才先送出，避免每 60 秒空 commit
      scheduleSave.flush('Auto sync before refresh')
      await saveQueue
    } else {
      await persistNow('Sync before refresh')
    }
    const data = await client.value.load()
    store.version = data.version || 1
    store.tasks = Array.isArray(data.tasks) ? data.tasks : []
    store.keyPlans = (Array.isArray(data.keyPlans) ? data.keyPlans : []).filter(
      (p) => String(p.title || '').trim()
    )
    store.reviews =
      data.reviews && typeof data.reviews === 'object' ? { ...data.reviews } : {}
    if (!silent) {
      syncOk.value = `已重新讀取 ${new Date().toLocaleTimeString()}`
      setTimeout(() => {
        syncOk.value = ''
      }, 2500)
    }
  }

  function tasksOn(dateKey) {
    return store.tasks.filter((t) => t.date === dateKey)
  }

  function taskAt(dateKey, timeSlot) {
    return store.tasks.find((t) => t.date === dateKey && t.timeSlot === timeSlot) || null
  }

  function upsertTask({ date, timeSlot, title, status }) {
    const existing = taskAt(date, timeSlot)
    if (existing) {
      existing.title = title
      if (status) existing.status = status
    } else {
      store.tasks.push({
        id: createId(),
        title,
        date,
        timeSlot,
        status: status || STATUS.todo
      })
    }
  }

  function removeTask(id) {
    const idx = store.tasks.findIndex((t) => t.id === id)
    if (idx >= 0) store.tasks.splice(idx, 1)
  }

  function setTaskStatus(id, status) {
    const task = store.tasks.find((t) => t.id === id)
    if (!task) return
    task.status = status
  }

  function cycleTaskStatus(id) {
    const task = store.tasks.find((t) => t.id === id)
    if (!task) return
    task.status = nextStatus(task.status)
    persistNow(`Update task status: ${task.title || task.id}`)
  }

  function moveTask(id, date, timeSlot) {
    const task = store.tasks.find((t) => t.id === id)
    if (!task) return
    const conflict = taskAt(date, timeSlot)
    if (conflict && conflict.id !== id) {
      // 交換位置
      const oldDate = task.date
      const oldSlot = task.timeSlot
      task.date = date
      task.timeSlot = timeSlot
      conflict.date = oldDate
      conflict.timeSlot = oldSlot
    } else {
      task.date = date
      task.timeSlot = timeSlot
    }
    persistNow(`Move task: ${task.title || task.id}`)
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
    if (!task?.date) return
    const date = parseDateKey(task.date)
    selectedDate.value = date
    weekAnchor.value = date
    viewMonth.value = new Date(date.getFullYear(), date.getMonth(), 1)
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
    monthKey,
    selectedKey,
    todayStats,
    monthStats,
    monthRate,
    keyPlans,
    review,
    login,
    logout,
    bootstrap,
    reloadData,
    tasksOn,
    taskAt,
    upsertTask,
    removeTask,
    setTaskStatus,
    cycleTaskStatus,
    moveTask,
    updateKeyPlan,
    addKeyPlan,
    removeKeyPlan,
    cycleKeyPlanStatus,
    updateReview,
    jumpToTask,
    clearFocusTask,
    persistNow,
    persistDebounced
  }
}
