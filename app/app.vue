<template>
  <div>
    <NuxtRouteAnnouncer />
    <div class="container stack" style="min-height: 100vh; gap: 16px;">
      <header class="row" style="justify-content: space-between; position: sticky; top: 0; z-index: 20; background: var(--bg); padding-top: 8px;">
        <div class="row" style="gap:8px; align-items: baseline;">
          <div class="badge">MVP</div>
          <div class="heading">Thrivebot</div>
        </div>
        <ThemeToggle />
      </header>
      <main style="flex: 1; display: flex; flex-direction: column;">
        <NuxtPage />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
