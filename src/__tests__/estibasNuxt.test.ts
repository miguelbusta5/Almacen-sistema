// Guarda de sincronía del módulo Estibas, que vive SOLO en nuxt-app (no hay
// página React de respaldo: se construyó directo sobre el stack vivo).
//
// Por qué se lee el archivo como TEXTO en vez de importarlo: `nuxt-app/` vive bajo
// su propio tsconfig, que referencia `./.nuxt/*` — un directorio que genera
// `nuxt prepare` y que está gitignorado. En CI las dependencias de nuxt-app no se
// instalan, así que cualquier import cruzado revienta el transform con
// TSCONFIG_ERROR. Leer con `fs` no involucra al transform.
//
// Lo que protege: la lógica está triplicada a propósito entre src/lib/estibas.ts
// (fuente de verdad y tests), nuxt-app/server/utils/estibasCalc.ts (Nitro) y
// nuxt-app/app/utils/estibas.ts (Vue). Si una copia se desvía, el cliente valida
// distinto que el servidor y el operario ve rechazos que no puede explicarse.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { PEDIDO_PATTERN, UBICACION_PATTERN, GESTORES_ESTIBAS, ROLES_ESTIBAS } from "@/lib/estibas";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const calcServidor = leer("nuxt-app/server/utils/estibasCalc.ts");
const utilsServidor = leer("nuxt-app/server/utils/estibas.ts");
const utilsCliente = leer("nuxt-app/app/utils/estibas.ts");
const mapRow = leer("nuxt-app/server/utils/mapRow.ts");
const layout = leer("nuxt-app/app/layouts/default.vue");
const nextConfig = leer("next.config.ts");

// ── Los patrones deben ser idénticos en las tres copias ──────────────
describe("estibas — patrones sincronizados", () => {
  it("el patrón de pedido es el mismo en las tres copias", () => {
    const fuente = PEDIDO_PATTERN.source;
    expect(calcServidor).toContain(fuente);
    expect(utilsCliente).toContain(fuente);
  });

  it("el patrón de ubicación canónica es el mismo en las tres copias", () => {
    const fuente = UBICACION_PATTERN.source;
    expect(calcServidor).toContain(fuente);
    expect(utilsCliente).toContain(fuente);
  });

  it("las listas de roles coinciden con src/lib/estibas.ts", () => {
    for (const rol of ROLES_ESTIBAS) {
      expect(calcServidor).toContain(`'${rol}'`);
      expect(utilsCliente).toContain(`'${rol}'`);
    }
    for (const rol of GESTORES_ESTIBAS) {
      expect(utilsCliente).toContain(`'${rol}'`);
    }
    // MONTACARGAS usa pero NO gestiona: si se colara en la lista de gestores del
    // cliente, la UI ofrecería borrar y exportar y el servidor devolvería 403.
    expect(utilsCliente).toMatch(/GESTORES_ESTIBAS\s*=\s*\[[^\]]*\]/);
    const gestoresCliente = utilsCliente.match(/GESTORES_ESTIBAS\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(gestoresCliente).not.toContain("MONTACARGAS");
  });
});

// ── El contrato de la API que consume el cliente ─────────────────────
describe("estibas — handlers Nitro presentes", () => {
  const handlers = [
    "nuxt-app/server/api/estibas/index.get.ts",
    "nuxt-app/server/api/estibas/index.post.ts",
    "nuxt-app/server/api/estibas/abierta.get.ts",
    "nuxt-app/server/api/estibas/conteos.get.ts",
    "nuxt-app/server/api/estibas/operarios.get.ts",
    "nuxt-app/server/api/estibas/export.get.ts",
    "nuxt-app/server/api/estibas/[id]/ubicacion.post.ts",
    "nuxt-app/server/api/estibas/[id]/index.patch.ts",
    "nuxt-app/server/api/estibas/[id]/index.delete.ts",
    "nuxt-app/server/api/productos-maestro/buscar.get.ts",
  ];

  it.each(handlers)("%s existe", (rel) => {
    expect(() => leer(rel)).not.toThrow();
  });

  it("todo handler de estibas exige sesión y permiso del módulo", () => {
    for (const rel of handlers.filter((h) => h.includes("/estibas/"))) {
      const src = leer(rel);
      expect(src, rel).toContain("requireAuth(event)");
      expect(src, rel).toMatch(/assert(Usuario|Gestor)Estibas/);
    }
  });

  it("solo gestores exportan, listan operarios y borran", () => {
    for (const rel of [
      "nuxt-app/server/api/estibas/export.get.ts",
      "nuxt-app/server/api/estibas/operarios.get.ts",
      "nuxt-app/server/api/estibas/[id]/index.delete.ts",
    ]) {
      expect(leer(rel), rel).toContain("assertGestorEstibas");
    }
  });
});

// ── Las dos reglas de negocio que no pueden perderse ─────────────────
describe("estibas — reloj sellado por el servidor", () => {
  const post = leer("nuxt-app/server/api/estibas/index.post.ts");
  const ubicacion = leer("nuxt-app/server/api/estibas/[id]/ubicacion.post.ts");

  it("horaInicio la pone el servidor al crear, no el cliente", () => {
    expect(post).toContain("horaInicio: now");
    // El zod de creación no debe aceptar horas: si el cliente pudiera mandarlas,
    // la medición de productividad dejaría de valer (es lo que pasaba con el
    // NOW() volátil del Excel).
    const schema = post.match(/createSchema\s*=\s*z\.object\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
    expect(schema).not.toContain("horaInicio");
    expect(schema).not.toContain("horaFinalizacion");
  });

  it("asignar la ubicación es lo que sella horaFinalizacion", () => {
    expect(ubicacion).toContain("horaFinalizacion: new Date()");
    expect(ubicacion).toContain("ubicacion,");
  });

  it("solo se permite una estiba abierta por operario", () => {
    expect(post).toContain("horaFinalizacion: null");
    expect(post).toContain("statusCode: 409");
    expect(post).toContain("ESTIBA_ABIERTA");
  });

  it("el 409 devuelve la estiba abierta para que la UI salte a ubicar", () => {
    expect(post).toMatch(/data:\s*\{\s*code:\s*'ESTIBA_ABIERTA',\s*estiba:\s*mapEstiba\(abierta\)/);
    expect(leer("nuxt-app/app/components/estibas/Module.vue")).toContain("e?.data?.data?.estiba");
  });
});

describe("estibas — unidades por caja cuando el maestro no las trae", () => {
  const post = leer("nuxt-app/server/api/estibas/index.post.ts");

  it("el maestro manda y el valor del cliente es el respaldo", () => {
    expect(post).toContain("producto.unidadesPorCaja ?? parsed.data.unidadesPorCaja");
  });

  it("se marca unidadesManuales cuando el dato no vino del catálogo", () => {
    expect(post).toContain("unidadesManuales = producto.unidadesPorCaja == null");
  });
});

describe("estibas — resolución del producto por PLU o EAN", () => {
  it("el servidor busca por los dos, priorizando según la forma del código", () => {
    expect(utilsServidor).toContain("pareceEan(codigo) ? [porEan, porPlu] : [porPlu, porEan]");
  });

  it("el EAN se busca con findFirst: no es único en el maestro", () => {
    expect(utilsServidor).toContain("findFirst({ where: { ean: codigo }");
  });

  it("la captura consulta el endpoint que acepta ambos", () => {
    expect(leer("nuxt-app/app/components/estibas/Captura.vue"))
      .toContain("/api/productos-maestro/buscar");
  });
});

// ── Registro del módulo en la navegación y el proxy ──────────────────
describe("estibas — módulo registrado", () => {
  it("mapEstiba deriva estado y duración", () => {
    expect(mapRow).toContain("export function mapEstiba");
    expect(mapRow).toContain("estado: estadoEstiba(r.horaFinalizacion)");
    expect(mapRow).toContain("duracionMinutos: calcularDuracionMinutos(");
  });

  it("el sidebar Nuxt tiene la entrada", () => {
    expect(layout).toContain("moduleKey: 'estibas'");
    expect(layout).toContain("/dashboard/estibas");
  });

  it("las tres copias de modulePermissions conocen el módulo", () => {
    expect(leer("src/lib/modulePermissions.ts")).toContain('"estibas"');
    expect(leer("nuxt-app/app/utils/modulePermissions.ts")).toContain("estibas:");
    expect(leer("nuxt-app/server/utils/modulePermissions.ts")).toContain("estibas:");
  });

  it("el proxy de Next enruta /dashboard/estibas y entra en SHARED_NUXT_URL", () => {
    expect(nextConfig).toContain("NUXT_PILOT_ESTIBAS_URL");
    expect(nextConfig).toContain('source: "/dashboard/estibas"');
    // Sin esto, si fuera la única variable definida no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y la página cargaría en blanco.
    const shared = nextConfig.match(/const SHARED_NUXT_URL =([^;]*);/)?.[1] ?? "";
    expect(shared).toContain("NUXT_PILOT_ESTIBAS_URL");
  });
});
