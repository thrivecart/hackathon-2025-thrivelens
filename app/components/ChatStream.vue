<template>
  <div class="flex flex-col flex-1 min-h-0">
    <div ref="scrollEl" class="flex-1 min-h-0 overflow-auto flex flex-col gap-3 py-2 pb-6">
      <div v-for="(m, i) in messages" :key="i" class="flex gap-2.5 max-w-chat" :class="m.role === 'assistant' ? 'self-start' : 'self-end flex-row-reverse'">
        <div class="w-7 h-7 rounded-full inline-flex items-center justify-center text-xs border border-border bg-bg-soft text-muted">{{ m.role === 'assistant' ? 'T' : 'You' }}</div>
        <div class="px-3 py-2.5 rounded-message border border-border" :class="m.role === 'assistant' ? 'bg-bg-soft' : ''" :style="m.role === 'user' ? 'background: rgba(62,123,246,0.15); border-color: rgba(62,123,246,0.35);' : ''">
          <div class="text-xs text-muted mb-1.5">{{ m.role === 'assistant' ? 'Thrivebot' : 'You' }}</div>
          <div class="whitespace-pre-wrap break-words">
            {{ m.content }}
            <div v-if="m.screenshotUrl" class="my-4 rounded-lg overflow-hidden border border-border" style="background: var(--bg-soft)">
              <img :src="m.screenshotUrl" alt="Website screenshot" class="w-full max-w-2xl h-auto block cursor-pointer transition-transform duration-200 hover:scale-105" @load="scrollToBottom" />
            </div>
            <div v-if="m.uxAnalysis" class="my-4 p-4 border border-border rounded-lg" style="background: var(--bg)">
              <div v-if="m.uxAnalysis.score" class="mb-3 px-3 py-2 bg-sky-50 border border-sky-500 rounded text-sky-900 text-sm dark:bg-sky-900 dark:border-sky-400 dark:text-sky-100">
                <strong>UX Score: {{ m.uxAnalysis.score }}/100</strong>
              </div>
              <div v-if="m.uxAnalysis.summary" class="mb-4 p-3 rounded leading-relaxed" style="background: var(--bg-soft)">{{ m.uxAnalysis.summary }}</div>
              <div v-if="m.uxAnalysis.recommendations && m.uxAnalysis.recommendations.length" class="mt-4">
                <h4 class="m-0 mb-3 text-text text-lg">Recommendations:</h4>
                <div v-for="(rec, idx) in m.uxAnalysis.recommendations" :key="idx" class="my-3 p-3 rounded border-l-4"
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
                  <div v-if="rec.impact" class="mt-2 text-sm italic text-muted">💡 {{ rec.impact }}</div>
                </div>
              </div>
            </div>
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
    <div class="sticky bottom-0 left-0 right-0 pt-2" style="background: linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 40%)">
      <div class="bg-bg-soft border border-border rounded-composer p-2 flex gap-2 items-end">
        <textarea v-model="prompt" class="flex-1 resize-none bg-transparent text-text border-0 outline-none disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Message Thrivebot…" rows="1" style="min-height: 40px; max-height: 160px; overflow: auto;" @keydown.enter.exact.prevent="run" :disabled="loading"></textarea>
        <div class="flex gap-3 items-center">
          <button class="bg-accent text-gray-900 border border-transparent px-3.5 py-2.5 rounded-button font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed" @click="run" :disabled="loading">{{ loading ? 'Processing...' : 'Send' }}</button>
        </div>
      </div>
      <div class="text-xs text-center text-muted mt-1.5">AI-powered business insights with real-time data fetching</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

interface Message {
  role: 'user' | 'assistant'
  content: string
  screenshotUrl?: string
  uxAnalysis?: {
    score: number | null
    summary: string
    recommendations: Array<{
      title: string
      description: string
      priority: string
      impact: string
    }>
    strengths: string[]
    weaknesses: string[]
  } | null
}

const prompt = ref('')
const loading = ref(false)
const messages = ref<Message[]>([
  {
    role: 'assistant',
    content: 'How can I help with your ThriveCart business? Try "What are my products with prices?" or "Who is my top customer?"'
  }
])
const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch(messages, scrollToBottom, { deep: true })
watch(loading, () => nextTick(scrollToBottom))

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
    let screenshotUrl: string | undefined
    let uxAnalysis: Message['uxAnalysis'] = null

    if (Array.isArray(result.messages)) {
      const final = result.messages.find((msg: any) => msg.type === 'final') || result.messages[result.messages.length - 1]
      if (final) {
        content = final.content || ''
        screenshotUrl = final.screenshotUrl
        uxAnalysis = final.uxAnalysis || null
      }
    } else if (result.message || result.content) {
      content = result.message || result.content
      screenshotUrl = result.screenshotUrl
      uxAnalysis = result.uxAnalysis || null
    } else {
      throw new Error('Invalid response format')
    }

    messages.value.push({ role: 'assistant', content, screenshotUrl, uxAnalysis })

    loading.value = false
    scrollToBottom()

  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Error: ${e?.message || 'Something went wrong.'}` })
    loading.value = false
  }
}
</script>
