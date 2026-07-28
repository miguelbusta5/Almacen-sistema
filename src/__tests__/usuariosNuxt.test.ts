// Guarda del port de Usuarios a nuxt-app.
// Los archivos de nuxt-app se leen como TEXTO: viven bajo su propio tsconfig, que
// referencia ./.nuxt/* (gitignorado, inexistente en CI), así que importarlos
// revienta el transform. Ver src/__tests__/exportacionesNuxt.test.ts.
//
// Este módulo es el más sensible de los migrados: crea cuentas, cambia roles y
// resetea contraseñas. Un fallo de gate aquí no rompe nada visible — simplemente
// deja que alguien que no es ADMIN toque las cuentas.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { canSeeModule } from "@/lib/modulePermissions";
import { USER_ROLE_VALUES } from "@/lib/roles";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const utilsSrv = leer("nuxt-app/server/utils/usuarios.ts");
const utilsCli = leer("nuxt-app/app/utils/usuarios.ts");
const modulo = leer("nuxt-app/app/components/usuarios/Module.vue");
const layout = leer("nuxt-app/app/layouts/default.vue");
const nextConfig = leer("next.config.ts");

const ENDPOINTS_ADMIN = [
  "nuxt-app/server/api/users/index.post.ts",
  "nuxt-app/server/api/users/[id]/index.put.ts",
  "nuxt-app/server/api/users/vehiculos/index.get.ts",
  "nuxt-app/server/api/users/vehiculos/index.post.ts",
  "nuxt-app/server/api/users/transportistas-disponibles/index.get.ts",
  "nuxt-app/server/api/users/transportistas-operativos/index.get.ts",
  "nuxt-app/server/api/users/transportistas-operativos/index.post.ts",
  "nuxt-app/server/api/users/transportistas-operativos/index.patch.ts",
];

describe("usuarios — solo ADMIN", () => {
  it("ADMIN ve el módulo, GERENTE no", () => {
    expect(canSeeModule("ADMIN", "usuarios")).toBe(true);
    expect(canSeeModule("GERENTE", "usuarios")).toBe(false);
  });

  it("las tres copias de la matriz coinciden", () => {
    const extraer = (src: string) =>
      (src.match(/usuarios: \[([^\]]*)\]/)?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/['"]/g, ""))
        .filter(Boolean);
    for (const f of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      expect(extraer(leer(f))).toEqual(["ADMIN"]);
    }
  });

  it.each(ENDPOINTS_ADMIN)("%s exige ADMIN", (f) => {
    expect(leer(f)).toContain("requireRole(event, ['ADMIN'])");
  });

  it("GET /api/users mantiene los dos modos: dropdown por rol y lista completa ADMIN", () => {
    // El modo `?role=` lo usan supervisores para poblar selects; sin él, migrar
    // este endpoint rompería módulos que ni siquiera están migrados.
    const get = leer("nuxt-app/server/api/users/index.get.ts");
    for (const r of ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA", "SUPERVISOR_INVENTARIO"]) {
      expect(get).toContain(r);
    }
    expect(get).toMatch(/actor\.role !== 'ADMIN'/);
  });
});

describe("port Nuxt — usuarios: contraseñas y datos sensibles", () => {
  it("el select público nunca incluye password", () => {
    expect(utilsSrv).toContain("USER_PUBLIC_SELECT");
    const bloque = utilsSrv.match(/USER_PUBLIC_SELECT = \{([\s\S]*?)\}/)?.[1] ?? "";
    expect(bloque).not.toContain("password");
  });

  it.each([
    "nuxt-app/server/api/users/index.get.ts",
    "nuxt-app/server/api/users/index.post.ts",
    "nuxt-app/server/api/users/[id]/index.put.ts",
  ])("%s no devuelve password en su select", (f) => {
    const src = leer(f);
    for (const m of src.matchAll(/select: \{([^}]*)\}/g)) {
      expect(m[1]).not.toContain("password");
    }
  });

  it("hashea con el mismo coste que la app Next", () => {
    // Distinto coste no invalida hashes existentes, pero desalinea las dos apps.
    expect(utilsSrv).toContain("BCRYPT_ROUNDS = 12");
    expect(leer("src/app/api/users/route.ts")).toContain("bcrypt.hash(parsed.data.password, 12)");
  });

  it("toda contraseña puesta por ADMIN es temporal", () => {
    expect(leer("nuxt-app/server/api/users/index.post.ts")).toContain("mustChangePassword: true");
    expect(leer("nuxt-app/server/api/users/[id]/index.put.ts")).toContain("data.mustChangePassword = true");
  });

  it("normaliza el email a minúsculas antes del unique", () => {
    // Sin esto entran dos cuentas "iguales" que luego chocan en el login.
    expect(leer("nuxt-app/server/api/users/index.post.ts")).toContain("toLowerCase().trim()");
  });

  it("un ADMIN no puede desactivarse ni degradarse a sí mismo", () => {
    // Es lo único que evita quedarse sin ningún administrador.
    expect(leer("nuxt-app/server/api/users/[id]/index.put.ts")).toMatch(
      /id === actor\.id && \(d\.active === false \|\| \(d\.role && d\.role !== 'ADMIN'\)\)/,
    );
  });
});

describe("port Nuxt — usuarios: roles", () => {
  const extraer = (src: string, re: RegExp) =>
    (src.match(re)?.[1] ?? "").split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);

  it("las tres listas de roles son idénticas y en el mismo orden", () => {
    // Si al cliente le falta uno, ese rol deja de poder asignarse desde la UI;
    // si le falta al servidor, el zod lo rechaza con un 400 opaco.
    const esperado = [...USER_ROLE_VALUES];
    expect(extraer(utilsSrv, /USER_ROLE_VALUES\s*=\s*\[([\s\S]*?)\]/)).toEqual(esperado);
    expect(extraer(utilsCli, /USER_ROLES\s*=\s*\[([\s\S]*?)\]/)).toEqual(esperado);
  });

  it("solo el rol TRANSPORTISTA se vincula a un conductor", () => {
    const post = leer("nuxt-app/server/api/users/index.post.ts");
    expect(post).toContain("Selecciona el transportista a vincular");
    expect(post).toContain("Solo el rol Transportista puede vincularse a un conductor");
    // Y el conductor tiene que estar libre y con vehículo.
    expect(post).toContain("userId: null");
    expect(post).toContain("vehiculoId: { not: null }");
  });
});

describe("port Nuxt — usuarios: cableado de la ruta", () => {
  it("el skeleton va antes del gate de acceso", () => {
    // Con el orden invertido, un ADMIN ve parpadear "Sin acceso" en cada navegación
    // mientras /api/me responde.
    const iSkel = modulo.indexOf('v-if="!sessionLoaded"');
    const iGate = modulo.indexOf('v-else-if="!puedeVer"');
    expect(iSkel).toBeGreaterThan(-1);
    expect(iGate).toBeGreaterThan(iSkel);
  });

  it("el sidebar tiene key para resaltar el módulo", () => {
    expect(layout).toMatch(/href: '\/dashboard\/usuarios'[^}]*key: 'usuarios'/);
  });

  it("existe la página cuyo nombre de archivo es el route.name", () => {
    expect(() => leer("nuxt-app/app/pages/usuarios.vue")).not.toThrow();
  });

  it("la variable entra en la cadena de SHARED_NUXT_URL", () => {
    // Si fuera la única definida y no estuviera aquí, no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y la página cargaría en blanco.
    expect(nextConfig).toMatch(/SHARED_NUXT_URL\s*=[^;]*NUXT_PILOT_USUARIOS_URL/);
    expect(nextConfig).toMatch(/if \(NUXT_PILOT_USUARIOS_URL\)/);
  });

  it("el import del maestro de productos sigue apuntando a la app Next", () => {
    // productos-maestro no está migrado: con $fetch, el baseURL '/dashboard/' lo
    // mandaría a Nitro, donde esa ruta no existe.
    const flota = leer("nuxt-app/app/components/usuarios/FlotaPanel.vue");
    expect(flota).toContain("/api/productos-maestro/importar");
    expect(flota).not.toMatch(/\$fetch\([^)]*productos-maestro/);
  });
});
