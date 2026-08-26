import { computed, reactive, ref, watch } from 'vue'
import { GitHubDataClient } from '../lib/github'
import {
  clearConfig,
  countByStatus,
  createId,
  debounce,
  emptyStore,
  ensureKeyPlans,
  getReview,
  loadConfig,
  nextStatus,
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

  const monthKey = computed(() => toMonthKey(viewMonth.value))
  const selectedKey = computed(() => toDateKey(selectedDate.value))

  const todayTasks = computed(() =>
    store.tasks.filter((t) => t.date === toDateKey(new Date()))
  )
  const monthTasks = computed(() =>
    store.tasks.filter((t) => t.date.startsWith(monthKey.value))
  )
  const todayStats = computed(() => countByStatus(todayTasks.value))
  const monthStats = computed(() => countByStatus(monthTasks.value))
  const keyPlans = computed(() =>
    store.keyPlans.filter((p) => p.month === monthKey.value).slice(0, 10)
  )
  const review = computed(() => getReview(store, monthKey.value))

  watch(
    monthKey,
    (key) => {
      ensureKeyPlans(store, key)
    },
    { immediate: true }
  )

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
      ensureKeyPlans(store, toMonthKey(viewMonth.value))
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

  function updateKeyPlan(id, patch) {
    const plan = store.keyPlans.find((p) => p.id === id)
    if (!plan) return
    Object.assign(plan, patch)
  }

  function cycleKeyPlanStatus(id) {
    const plan = store.keyPlans.find((p) => p.id === id)
    if (!plan) return
    plan.status = nextStatus(plan.status)
    persistNow('Update key plan status')
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
    monthKey,
    selectedKey,
    todayStats,
    monthStats,
    keyPlans,
    review,
    login,
    logout,
    bootstrap,
    tasksOn,
    taskAt,
    upsertTask,
    removeTask,
    setTaskStatus,
    cycleTaskStatus,
    moveTask,
    updateKeyPlan,
    cycleKeyPlanStatus,
    updateReview,
    persistNow,
    persistDebounced
  }
}
