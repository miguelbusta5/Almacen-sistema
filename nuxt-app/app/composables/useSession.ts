export interface MeInfo {
  id: string
  name: string
  email: string
  role: string
  can: { create: boolean; edit: boolean; delete: boolean }
}

// Sesión compartida entre todas las páginas/módulos (una sola llamada a /api/me).
// `demo` es el estado global de "sin sesión válida" — cada página además tiene su
// propio fallback de datos de ejemplo si su propia carga de datos falla.
export function useSessionState() {
  const me = useState<MeInfo | null>('me', () => null)
  const sessionLoaded = useState('sessionLoaded', () => false)
  // true solo cuando /api/me respondió explícitamente authenticated:false (sesión
  // caducada/inválida). Un fallo de red deja esto en false: no queremos expulsar
  // al login por un error transitorio, pero sí distinguirlo del caso "sin sesión",
  // en el que antes la barra lateral se quedaba muda con solo "Inicio".
  const sessionInvalid = useState('sessionInvalid', () => false)
  return { me, sessionLoaded, sessionInvalid }
}

export async function ensureSession() {
  const { me, sessionLoaded, sessionInvalid } = useSessionState()
  if (sessionLoaded.value) return
  try {
    const res = await $fetch<{ authenticated: boolean; user?: MeInfo }>('/api/me')
    me.value = res.authenticated ? (res.user ?? null) : null
    sessionInvalid.value = !res.authenticated
  } catch {
    me.value = null
  } finally {
    sessionLoaded.value = true
  }
}
