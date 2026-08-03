<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, Wifi, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from '@lucide/vue'
import { signInWithCredentials } from '~/composables/useCredentialsLogin'

// Página sin sidebar/topbar: no usa el layout `default` (auth previa).
definePageMeta({ layout: false })

const route = useRoute()
const passwordChanged = route.query.passwordChanged === '1'

// Además de exigir ruta relativa (evita open redirect a otro origen), rechaza
// cualquier destino que apunte de vuelta al login: un callbackUrl así solo
// puede venir de un enlace/pestaña vieja atrapada en el bug real (2026-08-03,
// ver src/middleware.ts) donde el middleware armaba /login?callbackUrl=
// %2Fdashboard%2Flogin — esa ruta no es una página real y 404 tras iniciar
// sesión. Sin este filtro, un usuario con esa pestaña abierta queda atrapado
// otra vez aunque el bug de fondo ya esté resuelto.
function esCallbackValido(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('/login') && url !== '/dashboard/login'
}
const callbackUrl = esCallbackValido(route.query.callbackUrl) ? route.query.callbackUrl : '/dashboard'

// Binding dinámico a propósito: un `src` estático hace que Vite lo trate como
// un import de asset y lo busque en el `public/` de nuxt-app (donde no existe;
// el logo vive en el `public/` de la app Next, servido en el mismo dominio en
// producción porque /logo.png no está entre las rutas proxeadas).
const logoSrc = '/logo.png'

const email = ref('')
const password = ref('')
const showPass = ref(false)
const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  loading.value = true
  error.value = ''
  const result = await signInWithCredentials(email.value.trim().toLowerCase(), password.value, callbackUrl)
  if (!result.ok) {
    error.value = 'Email o contraseña incorrectos.'
    loading.value = false
    return
  }
  window.location.href = result.url ?? callbackUrl
}
</script>

<template>
  <div class="login-page">
    <main class="login-card fade-in">
      <section class="brand-panel">
        <img :src="logoSrc" alt="Grupo Ambiente" class="logo" />

        <div>
          <div class="status-chip"><Wifi :size="14" /> Datos en vivo</div>
          <h1>Control Logistico CEDI</h1>
          <p class="tagline">
            Portal interno para controlar inventario, facturas contado, transporte,
            preoperacional y exportaciones con trazabilidad por rol.
          </p>
        </div>

        <div class="modules-row">
          <div v-for="label in ['Inventario', 'Transporte', 'CEDI']" :key="label" class="module-chip">
            <div class="module-kicker">Modulo</div>
            <div class="module-label">{{ label }}</div>
          </div>
        </div>
      </section>

      <section class="form-panel">
        <div class="form-head">
          <div class="shield"><ShieldCheck :size="22" /></div>
          <h2>Iniciar sesion</h2>
          <p>Ingresa con tu cuenta corporativa para continuar.</p>
        </div>

        <div v-if="passwordChanged" class="banner banner-success">
          <CheckCircle2 :size="15" />Contraseña actualizada. Inicia sesión con tu nueva contraseña.
        </div>

        <form class="form" @submit.prevent="handleSubmit">
          <label class="field-label">
            Correo electronico
            <input v-model="email" type="email" placeholder="tu@email.com" required autocomplete="email" class="field" />
          </label>

          <label class="field-label">
            Contrasena
            <span class="pass-wrap">
              <input
                v-model="password"
                :type="showPass ? 'text' : 'password'"
                placeholder="********"
                required
                autocomplete="current-password"
                class="field pass-field"
              />
              <button
                type="button"
                class="pass-toggle"
                :aria-label="showPass ? 'Ocultar contrasena' : 'Mostrar contrasena'"
                @click="showPass = !showPass"
              >
                <EyeOff v-if="showPass" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </span>
          </label>

          <div v-if="error" class="banner banner-error">{{ error }}</div>

          <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
            <template v-if="loading"><Loader2 :size="15" class="spin-anim" />Verificando...</template>
            <template v-else>Continuar <ArrowRight :size="16" /></template>
          </button>
        </form>

        <p class="footnote">Sin acceso? Contacta al administrador.</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: clamp(16px, 4vw, 32px);
}

.login-card {
  width: 100%;
  max-width: 920px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
@media (max-width: 760px) { .login-card { grid-template-columns: 1fr; } }

.brand-panel {
  min-height: 520px;
  padding: clamp(28px, 5vw, 44px);
  background:
    radial-gradient(600px 360px at 80% 110%, var(--brand-tint), transparent 70%),
    linear-gradient(160deg, var(--surface-2) 0%, var(--surface) 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-right: 1px solid var(--border);
}
@media (max-width: 760px) { .brand-panel { border-right: none; border-bottom: 1px solid var(--border); min-height: auto; } }

.logo { height: 24px; width: auto; object-fit: contain; }

.status-chip {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--brand-ring);
  background: var(--brand-tint);
  border-radius: var(--r-pill);
  padding: 6px 12px;
  color: var(--brand-deep);
  font-size: 12px; font-weight: 700;
  margin-bottom: 18px;
}

.brand-panel h1 {
  font-size: clamp(28px, 5vw, 44px);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.tagline { color: var(--muted); font-size: 15px; line-height: 1.65; max-width: 560px; margin-top: 16px; }

.modules-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.module-chip { border: 1px solid var(--border); background: var(--surface); border-radius: var(--r-md); padding: 12px; box-shadow: var(--shadow-xs); }
.module-kicker { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
.module-label { color: var(--ink); font-size: 13px; font-weight: 700; margin-top: 5px; }

.form-panel { padding: clamp(24px, 5vw, 40px); display: flex; flex-direction: column; justify-content: center; }

.form-head { margin-bottom: 26px; }
.shield {
  width: 42px; height: 42px; border-radius: var(--r-md);
  display: grid; place-items: center;
  background: var(--brand-tint); color: var(--brand-deep);
  border: 1px solid var(--brand-ring);
  margin-bottom: 16px;
}
.form-head h2 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: var(--ink); }
.form-head p { font-size: 14px; color: var(--muted); margin-top: 6px; }

.banner {
  border-radius: var(--r-sm); padding: 10px 12px; font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
}
.banner-success { background: var(--success-tint); border: 1px solid color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
.banner-error { background: var(--error-tint); border: 1px solid color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); margin-bottom: 0; }

.form { display: flex; flex-direction: column; gap: 16px; }
.field-label { display: grid; gap: 6px; font-size: 12px; font-weight: 700; color: var(--ink-2); }
.field { height: 44px; }

.pass-wrap { position: relative; display: block; }
.pass-field { padding-right: 44px; width: 100%; }
.pass-toggle {
  position: absolute; right: 11px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: var(--muted); padding: 4px; display: flex;
}

.submit-btn { width: 100%; height: 44px; justify-content: center; margin-top: 4px; }

.footnote { margin-top: 24px; text-align: center; font-size: 12px; color: var(--faint); font-family: var(--mono); }
</style>
