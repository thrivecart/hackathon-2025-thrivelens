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
                <div class="stream-content">
                  {{ streamMsg.content }}
                  <!-- Show screenshot if present -->
                  <div v-if="streamMsg.screenshotUrl" class="screenshot-container">
                    <img 
                      :src="streamMsg.screenshotUrl" 
                      alt="Website screenshot"
                      class="website-screenshot"
                      @load="scrollToBottom"
                    />
                  </div>
                  <!-- Show UX analysis if present -->
                  <div v-if="streamMsg.uxAnalysis" class="ux-analysis">
                    <div v-if="streamMsg.uxAnalysis.score" class="ux-score">
                      <strong>UX Score: {{ streamMsg.uxAnalysis.score }}/100</strong>
                    </div>
                    <div v-if="streamMsg.uxAnalysis.summary" class="ux-summary">
                      {{ streamMsg.uxAnalysis.summary }}
                    </div>
                    <div v-if="streamMsg.uxAnalysis.recommendations && streamMsg.uxAnalysis.recommendations.length" class="recommendations">
                      <h4>Recommendations:</h4>
                      <div v-for="(rec, idx) in streamMsg.uxAnalysis.recommendations" :key="idx" class="recommendation" :class="rec.priority">
                        <div class="rec-header">
                          <strong>{{ rec.title }}</strong>
                          <span class="priority-badge" :class="rec.priority">{{ rec.priority }}</span>
                        </div>
                        <p>{{ rec.description }}</p>
                        <div v-if="rec.impact" class="impact">💡 {{ rec.impact }}</div>
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
              <div v-if="m.screenshotUrl" class="screenshot-container">
                <img 
                  :src="m.screenshotUrl" 
                  alt="Website screenshot"
                  class="website-screenshot"
                  @load="scrollToBottom"
                />
              </div>
            </div>
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

/* UX Audit Styles */
.screenshot-container {
  margin: 16px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-muted);
}

.website-screenshot {
  width: 100%;
  max-width: 600px;
  height: auto;
  display: block;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.website-screenshot:hover {
  transform: scale(1.02);
}

.ux-analysis {
  margin: 16px 0;
  padding: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.ux-score {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 6px;
  color: #0c4a6e;
  font-size: 0.95em;
}

.ux-summary {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-muted);
  border-radius: 6px;
  line-height: 1.5;
}

.recommendations {
  margin-top: 16px;
}

.recommendations h4 {
  margin: 0 0 12px 0;
  color: var(--text);
  font-size: 1.1em;
}

.recommendation {
  margin: 12px 0;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid #6b7280;
  background: var(--bg-muted);
}

.recommendation.high {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.recommendation.medium {
  border-left-color: #f59e0b;
  background: #fffbeb;
}

.recommendation.low {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.priority-badge {
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  font-weight: 600;
}

.priority-badge.high {
  background: #fecaca;
  color: #991b1b;
}

.priority-badge.medium {
  background: #fed7aa;
  color: #9a3412;
}

.priority-badge.low {
  background: #bbf7d0;
  color: #166534;
}

.recommendation p {
  margin: 8px 0;
  line-height: 1.5;
  color: var(--text-muted);
}

.impact {
  margin-top: 8px;
  font-size: 0.9em;
  font-style: italic;
  color: var(--muted);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .ux-score {
    background: #0c4a6e;
    border-color: #0ea5e9;
    color: #e0f2fe;
  }
  
  .recommendation.high {
    background: #450a0a;
    border-left-color: #ef4444;
  }
  
  .recommendation.medium {
    background: #451a03;
    border-left-color: #f59e0b;
  }
  
  .recommendation.low {
    background: #052e16;
    border-left-color: #10b981;
  }
  
  .priority-badge.high {
    background: #991b1b;
    color: #fecaca;
  }
  
  .priority-badge.medium {
    background: #9a3412;
    color: #fed7aa;
  }
  
  .priority-badge.low {
    background: #166534;
    color: #bbf7d0;
  }
}
</style>