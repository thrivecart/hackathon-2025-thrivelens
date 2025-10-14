<template>
  <div class="chat-shell">
    <div class="chat-scroll" ref="scrollEl">
      <div v-for="(m, i) in messages" :key="i" class="message" :class="m.role">
        <div class="avatar">{{ m.role === 'assistant' ? 'T' : 'You' }}</div>
        <div class="bubble" :class="m.role">
          <div class="small" style="margin-bottom:6px; color: var(--muted)">{{ m.role === 'assistant' ? 'Thrivebot' : 'You' }}</div>
          <div class="message-content">{{ m.content }}</div>
        </div>
      </div>
    </div>

    <div class="composer">
      <div class="composer-inner">
        <textarea v-model="prompt" class="textarea" placeholder="Message Thrivebot…" rows="1" @keydown.enter.exact.prevent="run"></textarea>
        <div class="row">
          <button class="btn" @click="run" :disabled="loading">{{ loading ? 'Thinking…' : 'Send' }}</button>
        </div>
      </div>
      <div class="small" style="text-align:center; color: var(--muted); margin-top: 6px;">Based on available data. Keep replies short and actionable.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

const prompt = ref('')
const loading = ref(false)
const messages = ref<Array<{ role: 'user' | 'assistant', content: string }>>([
  { role: 'assistant', content: 'How can I help? Try “Top 3 products last month?”' }
])
const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    const el = scrollEl.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
watch(messages, scrollToBottom, { deep: true })

function addAssistant(content: string) {
  messages.value.push({ role: 'assistant', content })
}
function addUser(content: string) {
  messages.value.push({ role: 'user', content })
}

async function run() {
  const q = prompt.value.trim()
  if (!q || loading.value) return
  addUser(q)
  prompt.value = ''
  loading.value = true

  try {
    // Convert messages to conversation history format
    const history = messages.value
      .filter(m => m.role !== 'system') // Exclude system messages
      .slice(-10) // Keep last 10 messages to avoid token limits
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    
    const res = await $fetch('/api/chat-mcp', {
      method: 'POST',
      body: { 
        query: q,
        history: history  // Send conversation history
      }
    }) as { reply: string }
    addAssistant(res.reply)
  } catch (e: any) {
    addAssistant(`Error: ${e?.data?.message || e.message || 'Something went wrong.'}`)
  } finally {
    loading.value = false
  }
}

async function quickTop() { prompt.value = 'What were my top 3 products last month?'; await run() }
async function quickRevenue() { prompt.value = 'Show revenue for the last 7 days'; await run() }
async function quickRefunds() { prompt.value = 'What is my refund rate for the last 30 days?'; await run() }
</script>
