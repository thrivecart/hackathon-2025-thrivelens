<template>
  <div ref="scrollContainer" class="flex-1 w-full overflow-y-auto">
    <ChatStream :scroll-container="scrollContainer" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const scrollContainer = ref<HTMLElement | null>(null)
</script>
