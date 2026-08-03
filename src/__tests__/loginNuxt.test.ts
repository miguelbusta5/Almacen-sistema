// Guarda del port de Login a nuxt-app.
// Los archivos de nuxt-app se leen como TEXTO (mismo motivo que el resto de guardas
// Nuxt: viven bajo su propio tsconfig, que referencia ./.nuxt/* gitignorado).
//
// Login es el único módulo migrado que NO lee la sesión: la CREA. A diferencia de
// los demás pilotos, no puede reimplementar la validación de credenciales (bcrypt
// contra Prisma) del lado de Nitro — debe seguir llamando al mismo endpoint de
// Auth.js en la app Next (/api/auth/*), que el rewrite deja intacto (solo /login y
// /dashboard/* están proxeados). Estos tests fijan ese contrato.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const composable = leer("nuxt-app/app/composables/useCredentialsLogin.ts");
const pagina = leer("nuxt-app/app/pages/login.vue");
const nextConfig = leer("next.config.ts");
const middleware = leer("src/middleware.ts");

describe("port Nuxt — login: no duplica la validación de credenciales", () => {
  it("llama al endpoint real de Auth.js en vez de reimplementar bcrypt/Prisma", () => {
    expect(composable).toContain("/api/auth/csrf");
    expect(composable).toContain("/api/auth/callback/credentials");
    expect(composable).not.toMatch(/bcrypt|prisma/i);
  });

  it("usa fetch nativo, no el $fetch de Nuxt (que antepone baseURL '/dashboard/')", () => {
    expect(composable).toContain("fetch(");
    expect(composable).not.toContain("$fetch");
  });

  it("pide a Auth.js JSON en vez de un 302 (mismo truco que next-auth/react)", () => {
    expect(composable).toContain("X-Auth-Return-Redirect");
  });

  it("manda las cookies same-origin para que la sesión quede en el dominio real", () => {
    const matches = composable.match(/credentials: 'same-origin'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("port Nuxt — login: cableado de la ruta", () => {
  it("no usa el layout del dashboard (sidebar/topbar) antes de autenticarse", () => {
    expect(pagina).toContain("layout: false");
  });

  it("solo acepta callbackUrl relativo (evita open redirect a otro origen)", () => {
    expect(pagina).toMatch(/callbackUrl\.startsWith\('\/'\)/);
  });

  it("existe la página", () => {
    expect(() => leer("nuxt-app/app/pages/login.vue")).not.toThrow();
  });

  it("la variable entra en la cadena de SHARED_NUXT_URL", () => {
    // Si fuera la única definida y no estuviera aquí, no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y la página cargaría en blanco.
    expect(nextConfig).toMatch(/SHARED_NUXT_URL\s*=[^;]*NUXT_PILOT_LOGIN_URL/);
    expect(nextConfig).toMatch(/if \(NUXT_PILOT_LOGIN_URL\)/);
  });

  it("el rewrite de /login apunta a /dashboard/login (baseURL compartido de Nuxt)", () => {
    expect(nextConfig).toMatch(/source: "\/login", destination: `\$\{NUXT_PILOT_LOGIN_URL\}\/dashboard\/login`/);
  });

  it("/api/auth no está en ninguna regla de rewrite (Auth.js sigue siendo Next.js)", () => {
    expect(nextConfig).not.toMatch(/\/api\/auth/);
  });
});

describe("middleware — no gatea los assets/API compartidos de Nuxt", () => {
  // Bug real (2026-08-03): el middleware protegía TODO /dashboard/*, incluidos
  // /dashboard/_nuxt/* y /dashboard/api/* (compartidos por todos los módulos
  // migrados). Login es la única pantalla que los pide sin sesión — el middleware
  // los redirigía a /login devolviendo HTML donde el navegador esperaba JS
  // ("Failed to fetch dynamically imported module"). Los demás módulos nunca lo
  // sufrieron porque para llegar a ellos ya hacía falta sesión.
  it("exime /dashboard/_nuxt y /dashboard/api del chequeo de cookie de sesión", () => {
    const iExencion = middleware.indexOf('pathname.startsWith("/dashboard/_nuxt")');
    const iCheckSesion = middleware.indexOf("hasSession");
    expect(iExencion).toBeGreaterThan(-1);
    expect(middleware).toContain('pathname.startsWith("/dashboard/api")');
    expect(iExencion).toBeLessThan(iCheckSesion);
  });
});
