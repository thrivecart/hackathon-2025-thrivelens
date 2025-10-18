// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/styles.css'],
  modules: ['@nuxtjs/tailwindcss'],
  runtimeConfig: {
    openai: {
      apiKey: process.env.NUXT_OPENAI_API_KEY
    },
    public: {
      appName: 'Thrivelens'
    }
  }
})
