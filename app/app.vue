<template>
  <NuxtRouteAnnouncer />
  <div class="h-screen flex flex-col relative">
    <header class="flex justify-between items-center sticky top-0 z-20 bg-bg/80 pt-4 pb-4 px-container">
      <div class="flex gap-2 items-center">
        <img src="/images/logo.png" alt="ThriveLens Logo" class="w-10 h-10" />
        <div class="font-bold text-lg">Thrive<span class="text-accent">Lens</span></div>
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
