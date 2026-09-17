import { createError, defineEventHandler, setResponseHeader } from 'h3'

/**
 * Un archivo de /_nuxt que no existe responde 404 SIN cache.
 *
 * Los archivos que si existen los sirve el CDN de Vercel y nunca llegan aqui.
 * Lo que llega es un nombre que este despliegue no tiene, y sin esto la app
 * respondia la pagina (HTML, 200). El 17-09, durante un despliegue, una pestaña
 * pidio el script de la version NUEVA a la version VIEJA: el CDN guardo ese HTML
 * como si fuera el script (cache "immutable" de un año) y la app quedo en blanco
 * para todos hasta volver a desplegar.
 */
export default defineEventHandler((event) => {
  const ruta = event.path.split('?')[0] ?? ''
  if (!ruta.startsWith('/dashboard/_nuxt/') && !ruta.startsWith('/_nuxt/')) return
  setResponseHeader(event, 'Cache-Control', 'no-store, max-age=0')
  throw createError({ statusCode: 404, statusMessage: 'Archivo no encontrado' })
})
