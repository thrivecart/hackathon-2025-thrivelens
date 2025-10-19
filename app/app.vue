<template>
  <NuxtRouteAnnouncer />
  <SessionSidebar
    :is-open="isSidebarOpen"
    :current-session-id="currentSessionId"
    @session-selected="handleSessionSelected"
    @new-session="handleNewSession"
    @close="isSidebarOpen = false"
  />
  <div class="h-screen flex flex-col relative">
    <header class="flex justify-between items-center sticky top-0 z-20 bg-bg/80 pt-4 pb-4 px-container">
      <div class="flex gap-2 items-center">
        <button
          @click="isSidebarOpen = !isSidebarOpen"
          class="hamburger-btn"
          aria-label="Toggle sidebar"
          :aria-expanded="isSidebarOpen"
        >
          <Icon icon="line-md:menu" class="w-6 h-6" />
        </button>
        <img src="/images/logo.png" alt="ThriveLens Logo" class="w-10 h-10" />
        <div class="font-bold text-lg">Thrive<span class="text-accent">Lens</span></div>
      </div>
      <ThemeToggle />
    </header>
    <main class="flex-1 min-h-0 flex flex-col">
      <NuxtPage
        :current-session-id="currentSessionId"
        @session-updated="handleSessionUpdated"
        @close-sidebar="isSidebarOpen = false"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const isSidebarOpen = ref(false)
const currentSessionId = ref('')

function handleSessionSelected(sessionId: string) {
  currentSessionId.value = sessionId
  isSidebarOpen.value = false
}

function handleNewSession() {
  currentSessionId.value = ''
  isSidebarOpen.value = false
}

function handleSessionUpdated(sessionId: string) {
  currentSessionId.value = sessionId
}
</script>

<style scoped>
.hamburger-btn {
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hamburger-btn:hover {
  background: var(--bg-soft);
}

.hamburger-btn:active {
  opacity: 0.7;
}
</style>
