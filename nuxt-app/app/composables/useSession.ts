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
  return { me, sessionLoaded }
}

export async function ensureSession() {
  const { me, sessionLoaded } = useSessionState()
  if (sessionLoaded.value) return
  try {
    const res = await $fetch<{ authenticated: boolean; user?: MeInfo }>('/api/me')
    me.value = res.authenticated ? (res.user ?? null) : null
  } catch {
    me.value = null
  } finally {
    sessionLoaded.value = true
  }
}
