// Guarda de sincronía de Control Montacargas y Resurtido, que viven SOLO en
// nuxt-app (no hay página React de respaldo: se construyeron directo sobre el
// stack vivo).
//
// Por qué se lee el archivo como TEXTO en vez de importarlo: `nuxt-app/` vive bajo
// su propio tsconfig, que referencia `./.nuxt/*` — un directorio que genera
// `nuxt prepare` y que está gitignorado. En CI las dependencias de nuxt-app no se
// instalan, así que cualquier import cruzado revienta el transform con
// TSCONFIG_ERROR. Leer con `fs` no involucra al transform.
//
// Lo que protege: la lógica está triplicada a propósito entre
// src/lib/montacargas.ts (fuente de verdad y tests),
// nuxt-app/server/utils/montacargasCalc.ts (Nitro) y
// nuxt-app/app/utils/montacargas.ts (Vue). Si una copia se desvía, el cliente
// valida distinto que el servidor y el operario ve rechazos inexplicables.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { UBICACION_PATTERN, GESTORES_MONTACARGAS, ROLES_MONTACARGAS } from "@/lib/montacargas";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const calcServidor = leer("nuxt-app/server/utils/montacargasCalc.ts");
const utilsServidor = leer("nuxt-app/server/utils/montacargas.ts");
const utilsCliente = leer("nuxt-app/app/utils/montacargas.ts");
const mapRow = leer("nuxt-app/server/utils/mapRow.ts");
const layout = leer("nuxt-app/app/layouts/default.vue");
const nextConfig = leer("next.config.ts");
const moduleVue = leer("nuxt-app/app/components/montacargas/Module.vue");
const capturaVue = leer("nuxt-app/app/components/montacargas/Captura.vue");

describe("montacargas — patrones y roles sincronizados", () => {
  it("el patrón de ubicación canónica es el mismo en las tres copias", () => {
    const fuente = UBICACION_PATTERN.source;
    expect(calcServidor).toContain(fuente);
    expect(utilsCliente).toContain(fuente);
  });

  it("las listas de roles coinciden con src/lib/montacargas.ts", () => {
    for (const rol of ROLES_MONTACARGAS) {
      expect(calcServidor).toContain(`'${rol}'`);
      expect(utilsCliente).toContain(`'${rol}'`);
    }
    for (const rol of GESTORES_MONTACARGAS) {
      expect(utilsCliente).toContain(`'${rol}'`);
    }
    // MONTACARGAS usa pero NO gestiona: si se colara en la lista de gestores del
    // cliente, la UI ofrecería borrar y exportar y el servidor devolvería 403.
    const gestoresCliente = utilsCliente.match(/GESTORES_MONTACARGAS\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(gestoresCliente).not.toContain("MONTACARGAS'");
  });
});

describe("montacargas — handlers Nitro presentes", () => {
  const handlers = [
    "nuxt-app/server/api/montacargas/index.get.ts",
    "nuxt-app/server/api/montacargas/index.post.ts",
    "nuxt-app/server/api/montacargas/abierto.get.ts",
    "nuxt-app/server/api/montacargas/conteos.get.ts",
    "nuxt-app/server/api/montacargas/operarios.get.ts",
    "nuxt-app/server/api/montacargas/export.get.ts",
    "nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts",
    "nuxt-app/server/api/montacargas/[id]/index.patch.ts",
    "nuxt-app/server/api/montacargas/[id]/index.delete.ts",
    "nuxt-app/server/api/productos-maestro/buscar.get.ts",
  ];

  it.each(handlers)("%s existe", (rel) => {
    expect(() => leer(rel)).not.toThrow();
  });

  it("todo handler de montacargas exige sesión y permiso del módulo", () => {
    for (const rel of handlers.filter((h) => h.includes("/montacargas/"))) {
      const src = leer(rel);
      expect(src, rel).toContain("requireAuth(event)");
      expect(src, rel).toMatch(/assert(Usuario|Gestor)Montacargas/);
    }
  });

  it("solo gestores exportan, listan operarios y borran", () => {
    for (const rel of [
      "nuxt-app/server/api/montacargas/export.get.ts",
      "nuxt-app/server/api/montacargas/operarios.get.ts",
      "nuxt-app/server/api/montacargas/[id]/index.delete.ts",
    ]) {
      expect(leer(rel), rel).toContain("assertGestorMontacargas");
    }
  });

  // Sin el filtro por tipo, Resurtido mostraría los movimientos de depósito y
  // al revés: los tres flujos comparten tabla.
  it("listado, abierto, conteos y export filtran por tipo", () => {
    for (const rel of [
      "nuxt-app/server/api/montacargas/index.get.ts",
      "nuxt-app/server/api/montacargas/abierto.get.ts",
      "nuxt-app/server/api/montacargas/conteos.get.ts",
      "nuxt-app/server/api/montacargas/export.get.ts",
    ]) {
      expect(leer(rel), rel).toContain("esTipoMovimiento");
    }
  });
});

describe("montacargas — reloj sellado por el servidor", () => {
  const post = leer("nuxt-app/server/api/montacargas/index.post.ts");
  const ubicacion = leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts");

  it("horaInicio la pone el servidor al crear, no el cliente", () => {
    expect(post).toContain("horaInicio: now");
    // El zod de creación no debe aceptar horas: si el cliente pudiera mandarlas,
    // la medición de productividad dejaría de valer (es lo que pasaba con el
    // NOW() volátil del Excel).
    const schema = post.match(/createSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/)?.[1] ?? "";
    expect(schema).not.toContain("horaInicio");
    expect(schema).not.toContain("horaFinalizacion");
  });

  it("asignar la ubicación final es lo que sella horaFinalizacion", () => {
    expect(ubicacion).toContain("horaFinalizacion: new Date()");
    expect(ubicacion).toContain("ubicacionFinal,");
  });

  it("solo se permite un registro abierto por operario y por tipo", () => {
    expect(post).toContain("horaFinalizacion: null");
    expect(post).toContain("statusCode: 409");
    expect(post).toContain("MOVIMIENTO_ABIERTO");
    // El where del "abierto" tiene que incluir el tipo, o un registro abierto de
    // recepción bloquearía crear un movimiento de depósito.
    expect(post).toMatch(/creadoPorId: actor\.id, tipo, horaFinalizacion: null/);
  });

  it("el 409 devuelve el registro abierto para que la UI salte a ubicar", () => {
    expect(post).toContain("movimiento: mapMovimientoMontacargas(abierto)");
    expect(moduleVue).toContain("e?.data?.data?.movimiento");
  });
});

describe("montacargas — reguero", () => {
  const post = leer("nuxt-app/server/api/montacargas/index.post.ts");

  it("el total incluye las unidades sueltas", () => {
    expect(post).toContain("calcularCantidadTotal(parsed.data.cajas, unidadesPorCaja, unidadesSueltas)");
  });

  // Desmarcar el check tiene que limpiar la cantidad: dejarla la sumaría al
  // total sin que se vea en pantalla.
  it("la captura limpia las unidades sueltas al desmarcar el reguero", () => {
    expect(capturaVue).toMatch(/watch\(\(\) => form\.hayReguero[\s\S]{0,120}form\.unidadesSueltas = ''/);
  });
});

describe("montacargas — unidades por caja cuando el maestro no las trae", () => {
  const post = leer("nuxt-app/server/api/montacargas/index.post.ts");

  it("el maestro manda y el valor del cliente es el respaldo", () => {
    expect(post).toContain("producto.unidadesPorCaja ?? parsed.data.unidadesPorCaja");
  });

  it("se marca unidadesManuales cuando el dato no vino del catálogo", () => {
    expect(post).toContain("unidadesManuales = producto.unidadesPorCaja == null");
  });
});

describe("montacargas — resolución del producto por PLU o EAN", () => {
  it("el servidor busca por los dos, priorizando según la forma del código", () => {
    expect(utilsServidor).toContain("pareceEan(codigo) ? [porEan, porPlu] : [porPlu, porEan]");
  });

  it("el EAN se busca con findFirst: no es único en el maestro", () => {
    expect(utilsServidor).toContain("findFirst({ where: { ean: codigo }");
  });

  it("la captura consulta el endpoint que acepta ambos", () => {
    expect(capturaVue).toContain("/api/productos-maestro/buscar");
  });
});

describe("montacargas — módulos registrados", () => {
  it("mapRow deriva estado y duración", () => {
    expect(mapRow).toContain("export function mapMovimientoMontacargas");
    expect(mapRow).toContain("estado: estadoMovimiento(r.horaFinalizacion)");
    expect(mapRow).toContain("duracionMinutos: calcularDuracionMinutos(");
  });

  it("el sidebar Nuxt tiene las dos entradas", () => {
    expect(layout).toContain("moduleKey: 'control-montacargas'");
    expect(layout).toContain("moduleKey: 'resurtido'");
    expect(layout).toContain("/dashboard/control-montacargas");
    expect(layout).toContain("/dashboard/resurtido");
  });

  it("las tres copias de modulePermissions conocen los dos módulos", () => {
    for (const rel of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      const src = leer(rel);
      expect(src, rel).toContain("control-montacargas");
      expect(src, rel).toContain("resurtido");
      // El módulo viejo no debe quedar en ninguna copia.
      expect(src, rel).not.toContain("estibas");
    }
  });

  it("el proxy de Next enruta ambos y entra en SHARED_NUXT_URL", () => {
    expect(nextConfig).toContain("NUXT_PILOT_MONTACARGAS_URL");
    expect(nextConfig).toContain('"control-montacargas", "resurtido"');
    // Sin esto, si fuera la única variable definida no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y las páginas cargarían en blanco.
    const shared = nextConfig.match(/const SHARED_NUXT_URL =([^;]*);/)?.[1] ?? "";
    expect(shared).toContain("NUXT_PILOT_MONTACARGAS_URL");
  });

  it("Resurtido usa el mismo Module con un solo flujo", () => {
    const resurtido = leer("nuxt-app/app/pages/resurtido.vue");
    expect(resurtido).toContain("MontacargasModule");
    expect(resurtido).toContain("FLUJOS.RESURTIDO");
    // Con un solo flujo no se dibuja la barra de pestañas.
    expect(moduleVue).toContain("hayPestanas");
  });
});
