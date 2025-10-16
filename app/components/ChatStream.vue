<template>
  <div class="flex flex-col flex-1 min-h-0">
    <div class="flex-1 overflow-auto flex flex-col gap-3 py-2 pb-6 overscroll-none" ref="scrollEl">
      <div v-for="(m, i) in messages" :key="i" class="flex gap-2.5 max-w-chat" :class="m.role === 'assistant' ? 'self-start' : 'self-end flex-row-reverse'">
        <div class="w-7 h-7 rounded-full inline-flex items-center justify-center text-xs border border-border bg-bg-soft text-muted">{{ m.role === 'assistant' ? 'T' : 'You' }}</div>
        <div class="px-3 py-2.5 rounded-message border border-border" :class="m.role === 'assistant' ? 'bg-bg-soft' : ''"
             :style="m.role === 'user' ? 'background: rgba(62,123,246,0.15); border-color: rgba(62,123,246,0.35);' : ''">
          <div class="text-xs text-muted mb-1.5">{{ m.role === 'assistant' ? 'Thrivebot' : 'You' }}</div>
          <div class="whitespace-pre-wrap break-words">
            <!-- Show streaming progress if it exists -->
            <div v-if="m.streamMessages" class="my-2">
              <div
                  v-for="(streamMsg, idx) in m.streamMessages"
                  :key="idx"
                  class="flex items-start my-1 px-2 py-1 rounded text-sm"
                  :class="{
                  'opacity-80': streamMsg.type === 'status',
                  'bg-yellow-50 border-l-4 border-yellow-400': streamMsg.status === 'working',
                  'bg-blue-50 border-l-4 border-blue-600': streamMsg.status === 'success',
                  'bg-red-50 border-l-4 border-red-500': streamMsg.status === 'error',
                  'mt-2 px-3 py-2 rounded-lg border border-border font-medium bg-bg': streamMsg.type === 'final'
                }"
                  :style="(streamMsg.type === 'status' || streamMsg.type === 'progress') && !streamMsg.status ? 'background: var(--bg-soft)' : ''"
              >
                <div class="mr-2 flex-shrink-0">
                  <span v-if="streamMsg.status === 'thinking'">🤔</span>
                  <span v-else-if="streamMsg.status === 'working'">⚙️</span>
                  <span v-else-if="streamMsg.status === 'success'">✅</span>
                  <span v-else-if="streamMsg.status === 'error'">❌</span>
                  <span v-else-if="streamMsg.type === 'final'">💬</span>
                </div>
                <div class="flex-1 leading-snug">
                  {{ streamMsg.content }}
                  <!-- Show screenshot if present -->
                  <div v-if="streamMsg.screenshotUrl" class="my-4 rounded-lg overflow-hidden border border-border" style="background: var(--bg-soft)">
                    <img
                        :src="streamMsg.screenshotUrl"
                        alt="Website screenshot"
                        class="w-full max-w-2xl h-auto block cursor-pointer transition-transform duration-200 hover:scale-105"
                        @load="scrollToBottom"
                    />
                  </div>
                  <!-- Show UX analysis if present -->
                  <div v-if="streamMsg.uxAnalysis" class="my-4 p-4 border border-border rounded-lg" style="background: var(--bg)">
                    <div v-if="streamMsg.uxAnalysis.score" class="mb-3 px-3 py-2 bg-sky-50 border border-sky-500 rounded text-sky-900 text-sm dark:bg-sky-900 dark:border-sky-400 dark:text-sky-100">
                      <strong>UX Score: {{ streamMsg.uxAnalysis.score }}/100</strong>
                    </div>
                    <div v-if="streamMsg.uxAnalysis.summary" class="mb-4 p-3 rounded leading-relaxed" style="background: var(--bg-soft)">
                      {{ streamMsg.uxAnalysis.summary }}
                    </div>
                    <div v-if="streamMsg.uxAnalysis.recommendations && streamMsg.uxAnalysis.recommendations.length" class="mt-4">
                      <h4 class="m-0 mb-3 text-text text-lg">Recommendations:</h4>
                      <div v-for="(rec, idx) in streamMsg.uxAnalysis.recommendations" :key="idx"
                           class="my-3 p-3 rounded border-l-4"
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
            <!-- Show regular content -->
            <div v-else>
              {{ m.content }}
              <!-- Show screenshot in regular message if present -->
              <div v-if="m.screenshotUrl" class="my-4 rounded-lg overflow-hidden border border-border" style="background: var(--bg-soft)">
                <img
                    :src="m.screenshotUrl"
                    alt="Website screenshot"
                    class="w-full max-w-2xl h-auto block cursor-pointer transition-transform duration-200 hover:scale-105"
                    @load="scrollToBottom"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="sticky bottom-0 left-0 right-0 pt-2" style="background: linear-gradient(180deg, rgba(0,0,0,0) 0%, var(--bg) 40%)">
      <div class="bg-bg-soft border border-border rounded-composer p-2 flex gap-2 items-end">
        <textarea
            v-model="prompt"
            class="flex-1 resize-none bg-transparent text-text border-0 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="Message Thrivebot…"
            rows="1"
            style="min-height: 40px; max-height: 160px; overflow: auto;"
            @keydown.enter.exact.prevent="run"
            :disabled="loading"
        ></textarea>
        <div class="flex gap-3 items-center">
          <button class="bg-accent text-gray-900 border border-transparent px-3.5 py-2.5 rounded-button font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed" @click="run" :disabled="loading">
            {{ loading ? 'Processing...' : 'Send' }}
          </button>
        </div>
      </div>
      <div class="text-xs text-center text-muted mt-1.5">
        AI-powered business insights with real-time data fetching
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

interface StreamMessage {
  type: string
  content: string
  status?: string
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
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  streamMessages?: StreamMessage[]
  screenshotUrl?: string
  uxAnalysis?: any
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

function addAssistantMessage(content: string, streamMessages?: StreamMessage[]) {
  messages.value.push({
    role: 'assistant',
    content,
    streamMessages
  })
}

function addUserMessage(content: string) {
  messages.value.push({ role: 'user', content })
}

async function run() {
  const q = prompt.value.trim()
  if (!q || loading.value) return

  addUserMessage(q)
  prompt.value = ''
  loading.value = true

  // Create live message that will update in real-time
  const liveMessage: Message = {
    role: 'assistant',
    content: '',
    streamMessages: []
  }
  messages.value.push(liveMessage)

  try {
    // Convert messages to conversation history format
    const history = messages.value
        .filter(m => m.role !== 'system')
        .slice(-12, -1) // Keep last messages but exclude the live message we just added
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))

    // Use POST request to chat-stream endpoint
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

    // Process the messages from the POST response
    if (result.messages && Array.isArray(result.messages)) {
      liveMessage.streamMessages = result.messages

      // Set the main content from the final message
      const finalMessage = result.messages.find((msg: StreamMessage) => msg.type === 'final')
      if (finalMessage) {
        liveMessage.content = finalMessage.content
      }
    } else {
      throw new Error('Invalid response format')
    }

    loading.value = false
    scrollToBottom()

  } catch (e: any) {
    // Handle errors
    if (!liveMessage.streamMessages) {
      liveMessage.streamMessages = []
    }
    liveMessage.streamMessages.push({
      type: 'error',
      content: e?.message || 'Something went wrong.',
      status: 'error'
    })
    liveMessage.content = `Error: ${e?.message || 'Something went wrong.'}`
    loading.value = false
  }
}

// Quick action functions
async function quickTop() {
  prompt.value = 'What are my top 3 products by revenue?'
  await run()
}
async function quickRevenue() {
  prompt.value = 'Show revenue for the last 7 days'
  await run()
}
async function quickCustomers() {
  prompt.value = 'Who are my top customers?'
  await run()
}
</script>
