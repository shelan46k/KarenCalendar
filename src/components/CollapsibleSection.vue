<script setup>
import { computed, ref, watch } from 'vue'
import SectionIcon from './SectionIcon.vue'

const props = defineProps({
  id: { type: String, required: true },
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: true }
})

const storageKey = computed(() => `karen-section-open:${props.id}`)

function readStored() {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (raw === null) return props.defaultOpen
    return raw === '1'
  } catch {
    return props.defaultOpen
  }
}

const open = ref(readStored())

watch(open, (v) => {
  try {
    localStorage.setItem(storageKey.value, v ? '1' : '0')
  } catch {
    // ignore
  }
})

function toggle() {
  open.value = !open.value
}
</script>

<template>
  <section class="card-section">
    <button
      type="button"
      class="flex w-full items-start gap-2 text-left"
      :aria-expanded="open"
      @click="toggle"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <SectionIcon
            v-if="icon"
            :name="icon"
            class-name="h-4 w-4 shrink-0 text-brand"
          />
          <h3 class="m-0 text-sm font-semibold text-ink">{{ title }}</h3>
        </div>
        <div v-if="!open" class="mt-1 text-xs leading-relaxed text-mute">
          <slot name="summary" />
        </div>
      </div>
      <span
        class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-line text-xs text-mute transition"
        :class="open ? 'rotate-180' : ''"
      >
        ▾
      </span>
    </button>

    <div v-show="open" class="mt-3">
      <slot />
    </div>
  </section>
</template>
