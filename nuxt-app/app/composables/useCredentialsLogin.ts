// Reimplementa a mano lo que hace `signIn("credentials", { redirect:false })` de
// next-auth/react (ver node_modules/next-auth/src/react.tsx), porque esa función
// solo existe para clientes React. La verificación de la contraseña contra la
// base de datos NUNCA se duplica aquí: seguimos llamando al mismo endpoint de
// Auth.js en la app Next (`/api/auth/*`), que no está proxeado por el rewrite
// (solo /dashboard/* y /login lo están) — misma sesión, mismo origen, misma cookie.
//
// Usa `fetch` nativo, no el fetch auto-importado de Nuxt: ese antepone el
// baseURL '/dashboard/' de nuxt.config.ts, y /api/auth vive en la raíz del dominio.

export interface CredentialsLoginResult {
  ok: boolean
  error?: string
  url?: string
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
  const data = (await res.json()) as { csrfToken?: string }
  return data.csrfToken ?? ''
}

export async function signInWithCredentials(
  email: string,
  password: string,
  callbackUrl: string,
): Promise<CredentialsLoginResult> {
  const csrfToken = await getCsrfToken()

  const res = await fetch('/api/auth/callback/credentials', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Le pide a Auth.js que devuelva JSON con `url` en vez de un 302 — mismo
      // truco que usa next-auth/react internamente.
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl }),
  })

  const data = (await res.json()) as { url?: string }
  if (!data.url) return { ok: false, error: 'CallbackRouteError' }

  const url = new URL(data.url, window.location.origin)
  const error = url.searchParams.get('error') ?? undefined

  return { ok: res.ok && !error, error, url: data.url }
}
