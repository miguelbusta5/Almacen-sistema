// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: { port: 3001 },
  css: ['~/assets/tokens.css'],
  app: {
    // La app solo se sirve vía el rewrite de Next.js bajo /dashboard/transporte
    // (nunca se navega directo al dominio de Vercel de nuxt-app). Sin este baseURL,
    // los assets (/_nuxt/*) y las llamadas a $fetch('/api/...') se resuelven contra
    // la raíz del dominio y escapan del rewrite, cayendo en las rutas viejas de
    // Next.js. $fetch global de Nuxt usa este baseURL automáticamente (ver
    // dollarFetchTemplate en nuxt/dist/index.mjs), así que no hace falta tocar
    // los call sites de $fetch.
    baseURL: '/dashboard/transporte/',
    head: {
      title: 'Guardados · Grupo Ambiente',
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap',
        },
      ],
    },
  },
})
