import { useSessionState } from '~/composables/useSession'

/**
 * Sesion caducada: llevar al login en vez de decir "No autorizado".
 *
 * La app Nuxt vive detras del rewrite de Next.js, asi que nadie vuelve a mirar
 * la cookie mientras la persona sigue dentro del modulo. Cuando vencia, cada
 * pantalla mostraba el 401 crudo del servidor ("No autorizado") y el operario se
 * quedaba encerrado sin saber que tenia que volver a entrar (le paso a Bryan en
 * Capacidad picking con un informe a medias).
 *
 * Marcar `sessionInvalid` basta: el layout ya redirige al login conservando la
 * ruta. Lo que cada pantalla tenga guardado en localStorage no se toca.
 */
export default defineNuxtPlugin(() => {
  const { sessionInvalid } = useSessionState()
  const original = globalThis.$fetch
  globalThis.$fetch = original.create({
    onResponseError({ response }) {
      if (response.status === 401) sessionInvalid.value = true
    },
  }) as typeof original
})
