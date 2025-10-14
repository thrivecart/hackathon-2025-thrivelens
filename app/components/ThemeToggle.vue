<template>
  <button class="btn secondary" @click="toggle">{{ label }}</button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const theme = ref<'light' | 'dark'>('dark')

function applyTheme() {
  const root = document.documentElement
  if (theme.value === 'light') root.classList.add('light')
  else root.classList.remove('light')
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
