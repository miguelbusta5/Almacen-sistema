import { defineEventHandler, setHeader } from 'h3'

/**
 * GET /api/version - que version esta desplegada.
 *
 * Sin sesion a proposito: solo devuelve un identificador de despliegue y lo
 * consulta cada pestaña abierta para saber si tiene que actualizarse.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  return { buildId: useRuntimeConfig().buildId }
})
