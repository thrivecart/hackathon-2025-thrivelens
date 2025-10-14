<template>
  <div class="chat-shell">
    <div class="chat-scroll" ref="scrollEl">
      <div v-for="(m, i) in messages" :key="i" class="message" :class="m.role">
        <div class="avatar">{{ m.role === 'assistant' ? 'T' : 'You' }}</div>
        <div class="bubble" :class="m.role">
          <div class="small" style="margin-bottom:6px; color: var(--muted)">{{ m.role === 'assistant' ? 'Thrivebot' : 'You' }}</div>
          <div class="message-content">
            <!-- Show streaming progress if it exists -->
            <div v-if="m.streamMessages" class="stream-container">
              <div 
                v-for="(streamMsg, idx) in m.streamMessages" 
                :key="idx" 
                class="stream-message"
                :class="[streamMsg.type, streamMsg.status]"
              >
                <div class="stream-icon">
                  <span v-if="streamMsg.status === 'thinking'">🤔</span>
                  <span v-else-if="streamMsg.status === 'working'">⚙️</span>
                  <span v-else-if="streamMsg.status === 'success'">✅</span>
                  <span v-else-if="streamMsg.status === 'error'">❌</span>
                  <span v-else-if="streamMsg.type === 'final'">💬</span>
                </div>
                <div class="stream-content">{{ streamMsg.content }}</div>
              </div>
            </div>
            <!-- Show regular content -->
            <div v-else>{{ m.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="composer">
      <div class="composer-inner">
        <textarea 
          v-model="prompt" 
          class="textarea" 
          placeholder="Message Thrivebot…" 
          rows="1" 
          @keydown.enter.exact.prevent="run"
          :disabled="loading"
        ></textarea>
        <div class="row">
          <button class="btn" @click="run" :disabled="loading">
            {{ loading ? 'Processing...' : 'Send' }}
          </button>
        </div>
      </div>
      <div class="small" style="text-align:center; color: var(--muted); margin-top: 6px;">
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
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  streamMessages?: StreamMessage[]
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

<style scoped>
.stream-container {
  margin: 8px 0;
}

.stream-message {
  display: flex;
  align-items: flex-start;
  margin: 4px 0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
}

.stream-message.status {
  background: var(--bg-muted);
  opacity: 0.8;
}

.stream-message.progress {
  background: var(--bg-muted);
}

.stream-message.progress.working {
  background: #fff3cd;
  border-left: 3px solid #ffc107;
}

.stream-message.progress.success {
  background: #d1edff;
  border-left: 3px solid #0066cc;
}

.stream-message.progress.error {
  background: #f8d7da;
  border-left: 3px solid #dc3545;
}

.stream-message.final {
  background: var(--bg);
  font-weight: 500;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.stream-icon {
  margin-right: 8px;
  flex-shrink: 0;
}

.stream-content {
  flex: 1;
  line-height: 1.4;
}

.composer textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.composer button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>