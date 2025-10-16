<template>
  <div class="flex flex-col flex-1 min-h-0">
    <div ref="scrollEl" class="flex-1 min-h-0 overflow-auto flex flex-col gap-3 py-2 pb-6">
      <div v-for="(m, i) in messages" :key="i" class="flex gap-2.5 max-w-chat" :class="m.role === 'assistant' ? 'self-start' : 'self-end flex-row-reverse'">
        <div class="w-7 h-7 rounded-full inline-flex items-center justify-center text-xs border border-border bg-bg-soft text-muted">{{ m.role === 'assistant' ? 'T' : 'You' }}</div>
        <div class="px-3 py-2.5 rounded-message border border-border" :class="m.role === 'assistant' ? 'bg-bg-soft' : ''" :style="m.role === 'user' ? 'background: rgba(62,123,246,0.15); border-color: rgba(62,123,246,0.35);' : ''">
          <div class="text-xs text-muted mb-1.5">{{ m.role === 'assistant' ? 'Thrivebot' : 'You' }}</div>
          <div class="whitespace-pre-wrap break-words">
            <template v-if="m.assets && m.assets.length">
              <div v-for="(asset, j) in m.assets" :key="j">
                <div v-if="asset.screenshotUrl" class="my-3">
                  <button type="button" @click="openLightbox(asset.screenshotUrl)" class="group block rounded-lg border border-border overflow-hidden bg-bg-soft w-64 h-64 md:w-80 md:h-80">
                    <img :src="asset.screenshotUrl" alt="Website screenshot" class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" @load="scrollToBottom" />
                  </button>
                  <div class="text-xs text-muted mt-1 capitalize">{{ asset.uxAnalysis?.device ? (asset.uxAnalysis.device + ' screenshot') : 'Screenshot' }}</div>
                </div>
                <div v-if="asset.uxAnalysis" class="my-4 p-4 border border-border rounded-lg" style="background: var(--bg)">
                  <div v-if="(asset.uxAnalysis.overallScore || asset.uxAnalysis.score)" class="mb-3 px-3 py-2 bg-sky-50 border border-sky-500 rounded text-sky-900 text-sm dark:bg-sky-900 dark:border-sky-400 dark:text-sky-100">
                    <strong>UX Score: {{ asset.uxAnalysis.overallScore || asset.uxAnalysis.score }}/100</strong>
                  </div>
                  <div v-if="asset.uxAnalysis.summary" class="mb-4 p-3 rounded leading-relaxed" style="background: var(--bg-soft)">{{ asset.uxAnalysis.summary }}</div>
                  <div v-if="asset.uxAnalysis.recommendations && asset.uxAnalysis.recommendations.length" class="mt-4">
                    <h4 class="m-0 mb-3 text-text text-lg">Recommendations ({{ asset.uxAnalysis.device || 'page' }}):</h4>
                    <div v-for="(rec, idx) in asset.uxAnalysis.recommendations" :key="idx" class="my-3 p-3 rounded border-l-4"
                         :class="{
                           'border-l-red-500 bg-red-50 dark:bg-red-950 dark:border-l-red-400': rec.priority === 'high',
                           'border-l-amber-500 bg-amber-50 dark:bg-amber-950 dark:border-l-amber-400': rec.priority === 'medium',
                           'border-l-green-500 bg-green-50 dark:bg-green-950 dark:border-l-green-400': rec.priority === 'low',
                           'border-l-gray-500': !rec.priority || (rec.priority !== 'high' && rec.priority !== 'medium' && rec.priority !== 'low')
                         }"
                         :style="!rec.priority || (rec.priority !== 'high' && rec.priority !== 'medium' && rec.priority !== 'low') ? 'background: var(--bg-soft)' : ''">
                      <div class="flex justify-between items-center mb-2">
                        <strong>{{ rec.title }}</strong>
                        <span class="text-xs px-2 py-0.5 rounded-xl uppercase font-semibold"
                              :class="{
                                'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200': rec.priority === 'high',
                                'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200': rec.priority === 'medium',
                                'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200': rec.priority === 'low'
                              }">{{ rec.priority }}</span>
                      </div>
                      <p class="my-2 leading-relaxed text-text">{{ rec.description }}</p>
                      <div v-if="rec.expectedImpact || rec.impact" class="mt-2 text-sm text-muted">💡 {{ rec.expectedImpact || rec.impact }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            {{ m.content}}
          </div>
        </div>
      </div>
      <div v-if="loading" class="flex gap-2.5 self-start max-w-chat">
        <div class="w-7 h-7 rounded-full inline-flex items-center justify-center text-xs border border-border bg-bg-soft text-muted">T</div>
        <div class="px-3 py-2.5 rounded-message border border-border bg-bg-soft">
          <div class="text-xs text-muted mb-1.5">Thrivebot</div>
          <div class="flex items-center gap-1" aria-live="polite" aria-label="Thinking">
            <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:0ms"></span>
            <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:150ms"></span>
            <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:300ms"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox overlay -->
    <div v-if="lightboxUrl" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" @click="closeLightbox" role="dialog" aria-modal="true">
      <div class="relative" @click.stop>
        <button class="absolute -top-3 -right-3 bg-white/90 text-gray-900 rounded-full w-8 h-8 shadow hover:bg-white" @click="closeLightbox" aria-label="Close">✕</button>
        <img :src="lightboxUrl" class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-xl" alt="Screenshot preview" />
      </div>
    </div>

    <div class="sticky bottom-0 left-0 right-0 pt-2" style="background: linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 40%)">
      <div class="bg-bg-soft border border-border rounded-composer py-2 px-5 flex gap-2 items-end">
        <textarea v-model="prompt" class="flex-1 resize-none bg-transparent text-text border-0 outline-none disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Enter your prompt here" rows="1" style="min-height: 40px; max-height: 160px; overflow: auto;" @keydown.enter.exact.prevent="run" :disabled="loading"></textarea>
        <div class="flex gap-3 items-center">
          <button class="bg-accent text-gray-900 border border-transparent px-3.5 py-2.5 rounded-button font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed" @click="run" :disabled="loading">{{ loading ? 'Processing...' : 'Send' }}</button>
        </div>
      </div>
      <div class="text-xs text-center text-muted mt-1.5 py-3">Thrivebot can make mistake.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'

interface MessageAsset {
  screenshotUrl?: string
  uxAnalysis?: {
    overallScore?: number | null
    score?: number | null
    device?: string | null
    summary?: string
    recommendations?: Array<{
      title: string
      description: string
      priority: string
      expectedImpact?: string
      impact?: string
      resources?: string[]
      links?: string[]
    }>
  } | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  assets?: MessageAsset[]
}

const prompt = ref('')
const loading = ref(false)
const messages = ref<Message[]>([
  {
    role: 'assistant',
    content: 'How can I help you?'
  }
])
const scrollEl = ref<HTMLElement | null>(null)
const lightboxUrl = ref<string | null>(null)
function openLightbox(url: string) { lightboxUrl.value = url }
function closeLightbox() { lightboxUrl.value = null }

function scrollToBottom() {
  nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch(messages, scrollToBottom, { deep: true })
watch(loading, () => nextTick(scrollToBottom))

let escHandler: ((e: KeyboardEvent) => void) | null = null
onMounted(() => {
  escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLightbox() }
  window.addEventListener('keydown', escHandler)
})
onBeforeUnmount(() => {
  if (escHandler) window.removeEventListener('keydown', escHandler)
})

function addUserMessage(content: string) {
  messages.value.push({ role: 'user', content })
}

async function run() {
  const q = prompt.value.trim()
  if (!q || loading.value) return

  addUserMessage(q)
  prompt.value = ''
  loading.value = true
  scrollToBottom()

  try {
    // Convert messages to conversation history format
    const history = messages.value
        .filter(m => m.role !== 'system')
        .slice(-12)
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))

    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: q,
        history
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    let content = ''
    const assets: MessageAsset[] = []

    if (Array.isArray(result.messages)) {
      const final = result.messages.find((msg: any) => msg.type === 'final') || result.messages[result.messages.length - 1]
      if (final) {
        content = final.content || ''
      }
      for (const msg of result.messages) {
        if (msg && (msg.screenshotUrl || msg.uxAnalysis)) {
          let ux = msg.uxAnalysis
          try {
            if (ux && typeof ux === 'string') ux = JSON.parse(ux)
            if (ux && typeof ux.recommendations === 'string') ux.recommendations = JSON.parse(ux.recommendations)
          } catch {}
          // Map "links" to "resources" inside recommendations for uniform rendering
          try {
            if (ux && Array.isArray(ux.recommendations)) {
              ux.recommendations = ux.recommendations.map((r: any) => {
                if (r && Array.isArray(r.links) && (!r.resources || r.resources.length === 0)) {
                  return { ...r, resources: r.links }
                }
                return r
              })
            }
          } catch {}
          assets.push({ screenshotUrl: msg.screenshotUrl, uxAnalysis: ux })
        }
      }
    } else if (result.message || result.content) {
      content = result.message || result.content
      const ux = (result as any).uxAnalysis
      let normUx = ux
      try {
        if (normUx && typeof normUx === 'string') normUx = JSON.parse(normUx)
        if (normUx && typeof normUx.recommendations === 'string') normUx.recommendations = JSON.parse(normUx.recommendations)
        if (normUx && Array.isArray(normUx.recommendations)) {
          normUx.recommendations = normUx.recommendations.map((r: any) => {
            if (r && Array.isArray(r.links) && (!r.resources || r.resources.length === 0)) {
              return { ...r, resources: r.links }
            }
            return r
          })
        }
      } catch {}
      if ((result as any).screenshotUrl || normUx) assets.push({ screenshotUrl: (result as any).screenshotUrl, uxAnalysis: normUx })
    } else {
      throw new Error('Invalid response format')
    }

    messages.value.push({ role: 'assistant', content, assets })

    loading.value = false
    scrollToBottom()

  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Error: ${e?.message || 'Something went wrong.'}` })
    loading.value = false
  }
}
</script>
