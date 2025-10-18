<template>
  <button 
    type="button"
    class="bg-transparent text-text border border-border p-2 rounded-button cursor-pointer transition-colors hover:bg-bg-soft flex items-center justify-center" 
    @click="toggle"
    :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <ClientOnly>
      <Icon :icon="theme === 'dark' ? 'ph:sun-bold' : 'ph:moon-bold'" class="w-5 h-5" />
    </ClientOnly>
  </button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'

const theme = ref<'light' | 'dark'>('dark')

function applyTheme() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme.value === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.remove('dark')
    root.classList.add('light')
  }
}

function toggle() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', theme.value)
  }
  applyTheme()
}

onMounted(() => {
  if (typeof localStorage === 'undefined') return
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (saved) theme.value = saved
  else if (typeof matchMedia !== 'undefined') {
    theme.value = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  applyTheme()
})
</script>
