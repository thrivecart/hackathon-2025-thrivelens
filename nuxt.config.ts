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
    thrivecart: {
      apiKey: process.env.NUXT_THRIVECART_API_KEY,
      baseUrl: process.env.NUXT_THRIVECART_BASE_URL || 'https://thrivecart.com',
      mode: process.env.NUXT_THRIVECART_MODE || 'live'
    },
    public: {
      appName: 'Thrivelens'
    }
  }
})
