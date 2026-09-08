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
import { readFileSync, readdirSync } from "fs";
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
const registroVue = leer("nuxt-app/app/components/montacargas/RegistroAbierto.vue");

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
    // El ayudante entra al módulo pero no crea: las dos copias lo distinguen.
    expect(calcServidor).toContain("OPERARIO_ALMACENAMIENTO");
    expect(utilsCliente).toContain("OPERARIO_ALMACENAMIENTO");
  });
});

describe("montacargas — handlers Nitro presentes", () => {
  const handlers = [
    "nuxt-app/server/api/montacargas/index.get.ts",
    "nuxt-app/server/api/montacargas/index.post.ts",
    "nuxt-app/server/api/montacargas/abiertos.get.ts",
    "nuxt-app/server/api/montacargas/conteos.get.ts",
    "nuxt-app/server/api/montacargas/operarios.get.ts",
    "nuxt-app/server/api/montacargas/ayudantes.get.ts",
    "nuxt-app/server/api/montacargas/export.get.ts",
    "nuxt-app/server/api/montacargas/[id]/cantidades.patch.ts",
    "nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts",
    "nuxt-app/server/api/montacargas/[id]/traspasar.post.ts",
    "nuxt-app/server/api/montacargas/[id]/novedad.post.ts",
    "nuxt-app/server/api/montacargas/[id]/resolver-novedad.post.ts",
    "nuxt-app/server/api/montacargas/[id]/descartar.post.ts",
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
  it("listado, abiertos, conteos y export filtran por tipo", () => {
    for (const rel of [
      "nuxt-app/server/api/montacargas/index.get.ts",
      "nuxt-app/server/api/montacargas/abiertos.get.ts",
      "nuxt-app/server/api/montacargas/conteos.get.ts",
      "nuxt-app/server/api/montacargas/export.get.ts",
    ]) {
      expect(leer(rel), rel).toContain("esTipoMovimiento");
    }
  });
});

describe("montacargas — el reloj arranca al digitar el PLU", () => {
  const post = leer("nuxt-app/server/api/montacargas/index.post.ts");
  const ubicacion = leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts");

  it("crear solo pide PLU y origen: las cantidades llegan después", () => {
    const schema = post.match(/createSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/)?.[1] ?? "";
    expect(schema).toContain("codigo");
    expect(schema).toContain("ubicacionInicial");
    // Si el POST exigiera cantidades, el reloj no podría arrancar con el PLU.
    expect(schema).not.toContain("cajas");
    expect(schema).not.toContain("unidadesSueltas");
  });

  it("horaInicio y el primer tramo los sella el servidor", () => {
    expect(post).toContain("horaInicio: now");
    expect(post).toContain("tramoMontacargas.create");
    expect(post).toContain("orden: 1");
    const schema = post.match(/createSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/)?.[1] ?? "";
    expect(schema).not.toContain("horaInicio");
  });

  it("asignar la ubicación final cierra el tramo y para el reloj", () => {
    expect(ubicacion).toContain("cerrarTramoAbierto");
    expect(ubicacion).toContain("horaFinalizacion: now");
    expect(ubicacion).toContain("estado: 'CERRADO'");
    // Las cantidades se exigen al cerrar, no al abrir.
    expect(ubicacion).toContain("validarCantidades");
  });

  // En resurtido el operario baja varios PLUs de una pasada; en recepción y
  // movimientos se trabaja una estiba a la vez.
  it("solo resurtido admite varios registros abiertos", () => {
    expect(post).toContain("admiteVariosAbiertos");
    expect(post).toContain("MOVIMIENTO_ABIERTO");
    expect(moduleVue).toContain("admiteVariosAbiertos");
  });

  // Como el reloj arranca con el PLU, un dedazo deja un registro corriendo.
  it("hay salida para descartar un PLU mal digitado", () => {
    const descartar = leer("nuxt-app/server/api/montacargas/[id]/descartar.post.ts");
    expect(descartar).toContain("deletedAt: now");
    expect(descartar).toContain("cerrarTramoAbierto");
    expect(registroVue).toContain("descartar");
  });
});

describe("montacargas — traspaso a ayudantes", () => {
  const traspasar = leer("nuxt-app/server/api/montacargas/[id]/traspasar.post.ts");

  it("cierra el tramo del primero y abre el del segundo", () => {
    expect(traspasar).toContain("cerrarTramoAbierto");
    expect(traspasar).toContain("abrirTramo");
    expect(traspasar).toContain("orden + 1");
    expect(traspasar).toContain("responsableId: ayudanteId");
  });

  it("solo acepta operarios de almacenamiento activos", () => {
    expect(traspasar).toContain("OPERARIO_ALMACENAMIENTO");
    expect(traspasar).toContain("active");
  });

  // El ayudante recibe una cifra que debe cuadrar contra lo físico: traspasar
  // sin cantidades no le dejaría nada que confirmar.
  it("exige cantidades antes de pasar el PLU", () => {
    expect(traspasar).toContain("validarCantidades");
  });

  it("la lista de ayudantes muestra la carga pendiente", () => {
    expect(utilsServidor).toContain("listarAyudantes");
    expect(utilsServidor).toContain("pendientes");
    expect(leer("nuxt-app/app/components/montacargas/TraspasarModal.vue")).toContain("pendientes");
  });
});

describe("montacargas — novedades detienen el reloj", () => {
  const novedad = leer("nuxt-app/server/api/montacargas/[id]/novedad.post.ts");
  const resolver = leer("nuxt-app/server/api/montacargas/[id]/resolver-novedad.post.ts");
  const cantidades = leer("nuxt-app/server/api/montacargas/[id]/cantidades.patch.ts");

  it("abrir una novedad cierra el tramo: la verificación no se cronometra", () => {
    expect(novedad).toContain("cerrarTramoAbierto");
    expect(novedad).toContain("estado: 'NOVEDAD'");
  });

  it("resolver reanuda el reloj con un tramo nuevo", () => {
    expect(resolver).toContain("abrirTramo");
    expect(resolver).toContain("estado: 'EN_CURSO'");
    expect(resolver).toContain("resueltaAt");
  });

  // El ayudante no corrige: si no cuadra, marca la novedad. Y no resuelve su
  // propia novedad — eso lo confirma el montacarguista o supervisión.
  it("el ayudante no edita cantidades ni resuelve novedades", () => {
    expect(cantidades).toContain("esAyudante");
    expect(resolver).toContain("esAyudante");
  });

  it("no se puede cerrar un registro con novedad abierta", () => {
    expect(leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts"))
      .toContain("NOVEDAD");
  });

  it("la duración suma tramos, no la ventana completa", () => {
    expect(mapRow).toContain("minutosTrabajados(tramos)");
    expect(calcServidor).toContain("export function minutosTrabajados");
  });
});

describe("montacargas — reguero", () => {
  it("el total incluye las unidades sueltas", () => {
    expect(leer("nuxt-app/server/api/montacargas/[id]/cantidades.patch.ts"))
      .toContain("calcularCantidadTotal(d.cajas, d.unidadesPorCaja, unidadesSueltas)");
  });

  // Desmarcar el check tiene que limpiar la cantidad: dejarla la sumaría al
  // total sin que se vea en pantalla.
  it("la tarjeta limpia las unidades sueltas al desmarcar el reguero", () => {
    expect(registroVue).toMatch(/watch\(\(\) => form\.hayReguero[\s\S]{0,120}form\.unidadesSueltas = ''/);
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
  it("mapRow expone tramos, novedades y estado", () => {
    expect(mapRow).toContain("export function mapMovimientoMontacargas");
    expect(mapRow).toContain("novedadAbierta");
    expect(mapRow).toContain("tramos");
  });

  it("el sidebar Nuxt tiene las dos entradas", () => {
    expect(layout).toContain("moduleKey: 'control-montacargas'");
    expect(layout).toContain("moduleKey: 'resurtido'");
  });

  it("las tres copias de modulePermissions conocen los módulos y el ayudante", () => {
    for (const rel of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      const src = leer(rel);
      expect(src, rel).toContain("control-montacargas");
      expect(src, rel).toContain("resurtido");
      expect(src, rel).toContain("OPERARIO_ALMACENAMIENTO");
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
    expect(moduleVue).toContain("hayPestanas");
  });
});

// Nitro serializa los errores como { error: true, statusCode, statusMessage, ... }.
// Cada componente tenía su propia copia de apiErr que leía `data.error` primero,
// así que el operario veía un cuadro rojo con la palabra "true" en vez del
// motivo (visto en producción al pasar un PLU a un ayudante). Vivía duplicada en
// 24 archivos: si alguien vuelve a pegar una copia local, esto lo caza.
describe("apiErr — mensaje de error legible", () => {
  const util = leer("nuxt-app/app/utils/apiError.ts");

  it("el helper compartido existe y descarta el flag booleano", () => {
    expect(util).toContain("export function apiErr");
    // Solo acepta cadenas no vacías: un `error: true` cae al texto de respaldo.
    expect(util).toContain("typeof value === 'string'");
    expect(util).toContain("statusMessage");
  });

  it("no queda ninguna copia local que lo sombree", () => {
    const dir = path.join(raiz, "nuxt-app/app");
    const pendientes: string[] = [];
    const recorrer = (d: string) => {
      for (const entrada of readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entrada.name);
        if (entrada.isDirectory()) { recorrer(full); continue; }
        if (!/\.(vue|ts)$/.test(entrada.name)) continue;
        if (full.endsWith("apiError.ts")) continue;
        if (readFileSync(full, "utf8").includes("function apiErr")) {
          pendientes.push(path.relative(raiz, full));
        }
      }
    };
    recorrer(dir);
    expect(pendientes).toEqual([]);
  });

  it("nadie lee data.error como si fuera el mensaje", () => {
    expect(leer("nuxt-app/app/components/montacargas/Module.vue"))
      .not.toContain("e?.data?.error ||");
  });
});
