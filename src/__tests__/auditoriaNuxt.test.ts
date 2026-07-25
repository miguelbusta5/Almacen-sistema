// Guarda del port de Auditoría a nuxt-app.
// Los archivos de nuxt-app se leen como TEXTO: viven bajo su propio tsconfig, que
// referencia ./.nuxt/* (gitignorado, inexistente en CI), así que importarlos
// revienta el transform. Ver src/__tests__/exportacionesNuxt.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { canSeeModule } from "@/lib/modulePermissions";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const handler = leer("nuxt-app/server/api/activity/index.get.ts");
const utils = leer("nuxt-app/app/utils/auditoria.ts");
const modulo = leer("nuxt-app/app/components/auditoria/Module.vue");
const layout = leer("nuxt-app/app/layouts/default.vue");
const nextConfig = leer("next.config.ts");
const permSrv = leer("nuxt-app/server/utils/modulePermissions.ts");
const permCli = leer("nuxt-app/app/utils/modulePermissions.ts");

describe("auditoría — solo ADMIN", () => {
  // El endpoint siempre exigió ADMIN; el menú prometía el módulo también a GERENTE,
  // que entraba y recibía 403. Ahora las dos cosas dicen lo mismo.
  it("ADMIN ve el módulo, GERENTE no", () => {
    expect(canSeeModule("ADMIN", "auditoria")).toBe(true);
    expect(canSeeModule("GERENTE", "auditoria")).toBe(false);
  });

  it("las tres copias de la matriz coinciden", () => {
    const extraer = (src: string, re: RegExp) =>
      (src.match(re)?.[1] ?? "").split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);
    const next = extraer(leer("src/lib/modulePermissions.ts"), /auditoria: \[([^\]]*)\]/);
    expect(extraer(permSrv, /auditoria: \[([^\]]*)\]/)).toEqual(["ADMIN"]);
    expect(extraer(permCli, /auditoria: \[([^\]]*)\]/)).toEqual(["ADMIN"]);
    expect(next).toEqual(["ADMIN"]);
  });

  it("el handler Nitro exige ADMIN", () => {
    expect(handler).toContain("requireRole(event, ['ADMIN'])");
  });
});

describe("port Nuxt — auditoría", () => {
  it("sanea la paginación (skip: NaN revienta Prisma)", () => {
    expect(handler).toContain("sanearPaginacion");
    expect(leer("nuxt-app/server/utils/paginacion.ts")).toContain("Number.isFinite");
  });

  it("conserva el rango de fechas de día completo", () => {
    expect(handler).toContain("T00:00:00");
    expect(handler).toContain("T23:59:59.999");
  });

  it("el CSV lleva BOM y corta en 5000 filas", () => {
    // Sin el BOM, Excel abre el UTF-8 rompiendo las tildes.
    expect(handler).toContain("'\\uFEFF'".replace("\\uFEFF", "﻿"));
    expect(handler).toContain("take: 5000");
  });

  it("las opciones de filtro salen de los datos, no de una lista fija", () => {
    // La versión Next traducía 3 de los 14 módulos reales, y uno ("users") ni
    // siquiera existe en la tabla — el valor real es "usuarios".
    expect(handler).toContain("groupBy({ by: ['module']");
    expect(handler).toContain("groupBy({ by: ['action']");
    expect(utils).toContain("usuarios:");
    expect(utils).not.toMatch(/^\s*users:/m);
  });

  it("etiqueta las 10 acciones que existen en la tabla", () => {
    for (const a of ["CREATE", "UPDATE", "DELETE", "MOVE", "REJECT", "RESUBMIT",
                     "IMPORT", "COMPLETE_AREA2", "MARK_COMPLETE", "EDIT"]) {
      expect(utils).toContain(a);
    }
  });

  it("el skeleton va antes del gate de acceso", () => {
    const iSkel = modulo.indexOf('v-if="!sessionLoaded"');
    const iGate = modulo.indexOf('v-else-if="!puedeVer"');
    expect(iSkel).toBeGreaterThan(-1);
    expect(iGate).toBeGreaterThan(iSkel);
  });
});

describe("port Nuxt — cableado de la ruta", () => {
  it("el sidebar tiene key para resaltar el módulo", () => {
    expect(layout).toMatch(/href: '\/dashboard\/auditoria'[^}]*key: 'auditoria'/);
  });

  it("existe la página cuyo nombre de archivo es el route.name", () => {
    expect(() => leer("nuxt-app/app/pages/auditoria.vue")).not.toThrow();
  });

  it("la variable entra en la cadena de SHARED_NUXT_URL", () => {
    expect(nextConfig).toMatch(/SHARED_NUXT_URL\s*=[^;]*NUXT_PILOT_AUDITORIA_URL/);
    expect(nextConfig).toMatch(/if \(NUXT_PILOT_AUDITORIA_URL\)/);
  });
});

describe("mapa de ciudades — eliminado sin referencias colgando", () => {
  it.each([
    "src/lib/modulePermissions.ts",
    "nuxt-app/app/utils/modulePermissions.ts",
    "nuxt-app/server/utils/modulePermissions.ts",
    "src/components/common/Sidebar.tsx",
    "nuxt-app/app/layouts/default.vue",
    "src/config/homeActions.ts",
    "src/lib/moduleTheme.ts",
    "src/app/(dashboard)/dashboard/page.tsx",
  ])("%s ya no lo menciona", (f) => {
    expect(leer(f)).not.toContain("mapa-ciudades");
  });

  it("leaflet salió de package.json", () => {
    const pkg = JSON.parse(leer("package.json"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).filter((k) => k.includes("leaflet"))).toEqual([]);
  });
});
