<template>
  <NuxtRouteAnnouncer />
  <div class="mx-auto px-container h-screen flex flex-col gap-4 relative">
    <header class="flex justify-between items-center sticky top-0 z-20 bg-bg pt-2">
      <div class="flex gap-2 items-baseline">
        <div class="bg-bg border border-border px-2 py-1 rounded-full text-muted text-xs">UX</div>
        <div class="font-bold text-lg">Thrivelens</div>
      </div>
      <ThemeToggle />
    </header>
    <main class="flex-1 min-h-0 flex flex-col">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup lang="ts">
</script>
