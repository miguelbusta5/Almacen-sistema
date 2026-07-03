import type { H3Event } from 'h3'
import { getCookie, createError } from 'h3'
import { decode } from '@auth/core/jwt'
import { can, type Action } from './permissions'

// Reconstruye la sesión leyendo y verificando la cookie JWT de Auth.js v5
// (misma que emite la app Next.js). Espejo de src/lib/authz.ts.
export interface SessionUser { id: string; email: string; name: string; role: string }

// Nombres de cookie posibles (v5 = authjs.*, legado = next-auth.*; Secure en prod).
const COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!secret) return null

  for (const salt of COOKIE_NAMES) {
    const token = getCookie(event, salt)
    if (!token) continue
    try {
      const payload = await decode({ token, secret, salt })
      if (payload?.id && payload?.role) {
        return {
          id: String(payload.id),
          email: String(payload.email ?? ''),
          name: String(payload.name ?? ''),
          role: String(payload.role),
        }
      }
    } catch {
      // token con otro salt/secret — probar el siguiente
    }
  }
  return null
}

export async function requireAuth(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  return user
}

export async function requireCan(event: H3Event, action: Action): Promise<SessionUser> {
  const user = await requireAuth(event)
  if (!can(user.role, action)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos para realizar esta acción' })
  }
  return user
}
