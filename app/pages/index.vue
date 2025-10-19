<template>
  <div ref="scrollContainer" class="flex-1 w-full overflow-y-auto">
    <ChatStream 
      :scroll-container="scrollContainer"
      :load-session-id="currentSessionId"
      @session-updated="handleSessionUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  currentSessionId?: string
}>()

const emit = defineEmits<{
  'session-updated': [sessionId: string]
  'close-sidebar': []
}>()

const scrollContainer = ref<HTMLElement | null>(null)

function handleSessionUpdated(sessionId: string) {
  emit('session-updated', sessionId)
}
</script>
