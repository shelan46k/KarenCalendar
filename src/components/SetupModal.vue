<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
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
    localError.value = '請填寫 Token、使用者名稱與 Repo 名稱。'
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
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Secure Setup</p>
        <h2 class="mt-2 text-2xl font-bold text-ink">解鎖 Karen Calendar</h2>
        <p class="mt-2 text-sm leading-relaxed text-mute">
          Token 只會存在你瀏覽器的 localStorage，不會寫進程式碼或 GitHub Pages 原始檔。
          請使用對「資料私有 Repo」具備 Contents 讀寫權限的 Fine-grained PAT。
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <label class="block">
          <span class="mb-1 block text-sm font-medium">GitHub Personal Access Token</span>
          <div class="flex gap-2">
            <input
              v-model="form.token"
              :type="showToken ? 'text' : 'password'"
              class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
              placeholder="github_pat_... 或 ghp_..."
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
          <span class="mb-1 block text-sm font-medium">GitHub 使用者名稱 (Owner)</span>
          <input
            v-model="form.owner"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
            placeholder="your-username"
            autocomplete="username"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-sm font-medium">資料庫私有儲存庫名稱</span>
          <input
            v-model="form.repo"
            type="text"
            class="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
            placeholder="my-calendar-data"
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
          {{ loading ? '驗證中…' : '驗證並進入' }}
        </button>
      </form>

      <ol class="mt-6 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-mute">
        <li>另建一個 Private Repo 存放 tasks.json（與前端程式碼分開）。</li>
        <li>到 GitHub Settings → Developer settings → Personal access tokens 建立 Token。</li>
        <li>Fine-grained token 請勾選該 Repo 的 Contents: Read and write。</li>
        <li>完整步驟請見專案 README「從零開始的 GitHub 設定」。</li>
      </ol>
    </div>
  </div>
</template>
