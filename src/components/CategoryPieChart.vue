<script setup>
import { computed } from 'vue'

const props = defineProps({
  slices: { type: Array, default: () => [] }
})

const total = computed(() => props.slices.reduce((s, x) => s + x.ms, 0))

/** 加寬 viewBox，左右留給單行拉線標籤 */
const VIEW_W = 580
const VIEW_H = 350
const CX = 290
const CY = 175
const R = 86
const ELBOW = R + 18
const LABEL_R = 168
const TEXT_GAP = 8
/** 單行標籤最小垂直間距 */
const MIN_LABEL_GAP = 26
const Y_MIN = 20
const Y_MAX = VIEW_H - 16

function shortenLabel(label) {
  const chars = Array.from(String(label || ''))
  if (chars.length <= 10) return label
  return `${chars.slice(0, 9).join('')}…`
}

/** 同側標籤由上而下推開，再由下往上收回，避免重疊 */
function spreadLabels(items) {
  if (items.length < 2) return
  items.sort((a, b) => a.labelY - b.labelY)

  for (let i = 1; i < items.length; i++) {
    const minY = items[i - 1].labelY + MIN_LABEL_GAP
    if (items[i].labelY < minY) items[i].labelY = minY
  }

  if (items[items.length - 1].labelY > Y_MAX) {
    items[items.length - 1].labelY = Y_MAX
  }
  for (let i = items.length - 2; i >= 0; i--) {
    const maxY = items[i + 1].labelY - MIN_LABEL_GAP
    if (items[i].labelY > maxY) items[i].labelY = maxY
  }

  if (items[0].labelY < Y_MIN) {
    items[0].labelY = Y_MIN
    for (let i = 1; i < items.length; i++) {
      const minY = items[i - 1].labelY + MIN_LABEL_GAP
      if (items[i].labelY < minY) items[i].labelY = minY
    }
  }
}

const arcs = computed(() => {
  const list = props.slices.filter((s) => s.ms > 0)
  if (!list.length) return []

  let angle = -Math.PI / 2
  const built = list.map((slice) => {
    const portion = total.value > 0 ? slice.ms / total.value : 0
    const sweep = portion * Math.PI * 2
    const start = angle
    const end = angle + sweep
    const mid = start + sweep / 2
    angle = end
    const large = sweep > Math.PI ? 1 : 0
    const x1 = CX + R * Math.cos(start)
    const y1 = CY + R * Math.sin(start)
    const x2 = CX + R * Math.cos(end)
    const y2 = CY + R * Math.sin(end)
    const path =
      portion >= 0.999
        ? `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R} Z`
        : `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`

    const edgeX = CX + R * Math.cos(mid)
    const edgeY = CY + R * Math.sin(mid)
    const radialX = CX + ELBOW * Math.cos(mid)
    const radialY = CY + ELBOW * Math.sin(mid)
    const onRight = Math.cos(mid) >= 0
    const labelX = onRight ? CX + LABEL_R : CX - LABEL_R
    const labelY = Math.min(Y_MAX, Math.max(Y_MIN, radialY))
    const percentText = `${slice.percent.toFixed(1)}%`
    const shortLabel = shortenLabel(slice.label)

    return {
      ...slice,
      path,
      edgeX,
      edgeY,
      radialX,
      radialY,
      onRight,
      labelX,
      labelY,
      textAnchor: onRight ? 'start' : 'end',
      /** 單行：百分比 + 類別 */
      calloutText: `${percentText} ${shortLabel}`,
      showCallout: portion >= 0.02
    }
  })

  const left = built.filter((a) => a.showCallout && !a.onRight)
  const right = built.filter((a) => a.showCallout && a.onRight)
  spreadLabels(left)
  spreadLabels(right)

  for (const arc of built) {
    if (!arc.showCallout) {
      arc.linePoints = ''
      arc.textX = arc.labelX
      continue
    }
    const stubX = arc.onRight ? arc.labelX - 10 : arc.labelX + 10
    arc.linePoints = `${arc.edgeX},${arc.edgeY} ${arc.radialX},${arc.radialY} ${stubX},${arc.labelY} ${arc.labelX},${arc.labelY}`
    arc.textX = arc.onRight ? arc.labelX + TEXT_GAP : arc.labelX - TEXT_GAP
  }

  return built
})
</script>

<template>
  <div class="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
    <div class="mx-auto w-full min-w-0 max-w-[600px] shrink-0 overflow-visible lg:mx-0 lg:max-w-[56%]">
      <svg
        v-if="arcs.length"
        :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
        class="h-auto w-full overflow-visible"
        role="img"
        aria-label="時間占比圓餅圖"
      >
        <path
          v-for="arc in arcs"
          :key="`slice-${arc.id}`"
          :d="arc.path"
          :fill="arc.color"
          stroke="#fff"
          stroke-width="1.5"
        />
        <template v-for="arc in arcs" :key="`callout-${arc.id}`">
          <template v-if="arc.showCallout">
            <polyline
              fill="none"
              stroke="#64748b"
              stroke-width="1.2"
              :points="arc.linePoints"
            />
            <circle :cx="arc.labelX" :cy="arc.labelY" r="2.2" :fill="arc.color" />
            <text
              :x="arc.textX"
              :y="arc.labelY + 5"
              :text-anchor="arc.textAnchor"
              fill="#2d2640"
              font-size="15"
              font-weight="600"
            >
              {{ arc.calloutText }}
            </text>
          </template>
        </template>
      </svg>
      <div
        v-else
        class="flex h-64 w-full items-center justify-center rounded-full border border-dashed border-line text-sm text-mute"
      >
        尚無資料
      </div>
    </div>
    <ul class="min-w-0 flex-1 space-y-2.5">
      <li
        v-for="slice in slices"
        :key="slice.id"
        class="flex items-center gap-2 text-[15px]"
      >
        <span
          class="h-3.5 w-3.5 shrink-0 rounded-sm"
          :style="{ backgroundColor: slice.color }"
        />
        <span class="min-w-0 flex-1 truncate font-medium text-ink">{{ slice.label }}</span>
        <span class="shrink-0 text-sm text-mute whitespace-nowrap">
          {{ slice.durationLabel }} · {{ slice.percent.toFixed(1) }}%
        </span>
      </li>
    </ul>
  </div>
</template>
