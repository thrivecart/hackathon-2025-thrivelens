<template>
  <div 
    v-if="isOpen"
    class="sidebar-backdrop"
    @click="$emit('close')"
    aria-hidden="true"
  ></div>
  
  <aside
    :class="['session-sidebar', { 'sidebar-open': isOpen }]"
    role="navigation"
    aria-label="Sessions"
  >
    <div class="sidebar-header">
      <h2 class="sidebar-title">Chat History</h2>
      <button
        class="new-chat-btn"
        @click="$emit('new-session')"
        aria-label="Start new chat"
      >
        <Icon icon="line-md:plus" class="w-5 h-5" />
        <span>New Chat</span>
      </button>
    </div>

    <div class="sessions-list">
      <div v-if="loading" class="loading-state">
        <div class="flex items-center gap-2 text-muted">
          <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:0ms"></span>
          <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:150ms"></span>
          <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:300ms"></span>
        </div>
      </div>

      <div v-else-if="sessions.length === 0" class="empty-state">
        <Icon icon="line-md:chat-round" class="w-12 h-12 text-muted opacity-50" />
        <p class="text-muted text-sm mt-2">No conversations yet</p>
      </div>

      <button
        v-for="session in sessions"
        :key="session.sessionId"
        class="session-item"
        :class="{ active: session.sessionId === currentSessionId }"
        @click="$emit('session-selected', session.sessionId)"
        @keydown.enter="$emit('session-selected', session.sessionId)"
        tabindex="0"
      >
        <Icon icon="line-md:chat-round" class="session-icon" />
        <div class="session-content">
          <div class="session-title">{{ truncate(session.firstUserMessage, 50) }}</div>
          <div class="session-time">{{ formatTime(session.lastActivity) }}</div>
        </div>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'

interface Session {
  sessionId: string
  firstUserMessage: string
  lastActivity: string
}

const props = defineProps<{
  isOpen: boolean
  currentSessionId: string
}>()

const sessions = ref<Session[]>([])
const loading = ref(false)

async function fetchSessions() {
  loading.value = true
  try {
    const response = await fetch('/api/sessions')
    const data = await response.json()
    sessions.value = data.sessions || []
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    sessions.value = []
  } finally {
    loading.value = false
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Fetch sessions on mount
onMounted(() => {
  fetchSessions()
})

// Refetch when currentSessionId changes (new session created)
watch(() => props.currentSessionId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    fetchSessions()
  }
})

// Keyboard support: Escape to close
const emit = defineEmits<{
  'session-selected': [sessionId: string]
  'new-session': []
  'close': []
}>()

let escHandler: ((e: KeyboardEvent) => void) | null = null
onMounted(() => {
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen) {
      emit('close')
    }
  }
  window.addEventListener('keydown', escHandler)
})
onBeforeUnmount(() => {
  if (escHandler) window.removeEventListener('keydown', escHandler)
})
</script>

<style scoped>
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 40;
  backdrop-filter: blur(2px);
}

.session-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  background: var(--bg-soft);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 250ms ease;
}

.session-sidebar.sidebar-open {
  transform: translateX(0);
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.new-chat-btn:hover {
  opacity: 0.9;
}

.new-chat-btn:active {
  opacity: 0.8;
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.session-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.25rem;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
  color: var(--text);
}

.session-item:hover {
  background: var(--bg);
}

.session-item.active {
  background: var(--bg);
  border-left-color: var(--accent);
}

.session-item:focus {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.session-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
  color: var(--muted);
}

.session-content {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.125rem;
}

/* Backdrop visible on both mobile and desktop when sidebar is open */
</style>
