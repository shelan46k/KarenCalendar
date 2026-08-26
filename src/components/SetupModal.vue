<script setup>
import { reactive, ref } from 'vue'

defineProps({
  error: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])

const form = reactive({
  token: '',
  owner: '',
  repo: '',
  path: 'tasks.json'
})
const localError = ref('')
const showToken = ref(false)

function onSubmit() {
  localError.value = ''
  if (!form.token.trim() || !form.owner.trim() || !form.repo.trim()) {
    localError.value = '請完整填寫必填欄位。'
    return
  }
  emit('submit', {
    token: form.token.trim(),
    owner: form.owner.trim(),
    repo: form.repo.trim(),
    path: form.path.trim() || 'tasks.json'
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
    <div class="w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-soft md:p-8">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-ink">解鎖 Karen Calendar</h2>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <label class="block">
          <span class="mb-1 block text-sm font-medium">Token</span>
          <div class="flex gap-2">
            <input
              v-model="form.token"
              :type="showToken ? 'text' : 'password'"
              class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
              autocomplete="off"
            />
            <button
              type="button"
              class="rounded-xl border border-line px-3 text-sm text-mute hover:bg-soft"
              @click="showToken = !showToken"
            >
              {{ showToken ? '隱藏' : '顯示' }}
            </button>
          </div>
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium">使用者名稱</span>
          <input
            v-model="form.owner"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
            autocomplete="username"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium">儲存庫名稱</span>
          <input
            v-model="form.repo"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium">資料檔案路徑</span>
          <input
            v-model="form.path"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
            placeholder="tasks.json"
          />
        </label>

        <p v-if="localError || error" class="rounded-xl bg-red-50 px-3 py-2 text-sm text-status-todo">
          {{ localError || error }}
        </p>

        <button
          type="submit"
          class="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          :disabled="loading"
        >
          {{ loading ? '驗證中…' : '進入' }}
        </button>
      </form>
    </div>
  </div>
</template>
