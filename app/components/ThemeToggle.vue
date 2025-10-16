<template>
  <button class="bg-transparent text-text border border-border px-3.5 py-2.5 rounded-button font-semibold cursor-pointer transition-colors hover:bg-bg-soft" @click="toggle">{{ label }}</button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const theme = ref<'light' | 'dark'>('dark')

function applyTheme() {
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
  localStorage.setItem('theme', theme.value)
  applyTheme()
}

onMounted(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
  if (saved) theme.value = saved
  else theme.value = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  applyTheme()
})

const label = computed(() => theme.value === 'dark' ? 'Light mode' : 'Dark mode')
</script>
