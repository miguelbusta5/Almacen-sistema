import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardia de drift: nuxt-app no se puede importar desde un test de node sin
// arrastrar medio framework, así que se leen los archivos.
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const calcServidor = leer("nuxt-app/server/utils/recepcionCalc.ts");
const calcCliente = leer("nuxt-app/app/utils/recepcion.ts");
const fuente = leer("src/lib/recepcionContenedores.ts");

// La lógica vive en tres copias porque Nitro y Vue resuelven alias distintos y
// no pueden importar de src/lib. Si divergen, el servidor valida una cosa y la
// pantalla otra.
describe("recepcion — las tres copias de la logica pura", () => {
  const funciones = [
    "puedeUsarRecepcion",
    "puedeGestionarRecepcion",
    "esDescargador",
    "validarApertura",
    "validarCierre",
    "validarLineaNovedad",
    "exigeFoto",
    "segundosRecepcion",
    "normalizarPedido",
    "esTipoContenedor",
    "validarCorreccionRecepcion",
  ];

  it.each(funciones)("%s existe en las tres", (fn) => {
    for (const src of [fuente, calcServidor, calcCliente]) {
      expect(src).toContain(`export function ${fn}`);
    }
  });

  it("los roles son los mismos en las tres", () => {
    for (const src of [fuente, calcServidor, calcCliente]) {
      // El montacarguista descarga pero no lleva la planilla.
      expect(src).toContain('export const ROLES_DESCARGADORES = ["MONTACARGAS", "OPERARIO_ALMACENAMIENTO"]');
      expect(src).not.toMatch(/ROLES_RECEPCION = \[\s*"MONTACARGAS"/);
    }
  });
});

describe("recepcion — el ciclo de la planilla", () => {
  const post = leer("nuxt-app/server/api/recepcion-contenedores/index.post.ts");
  const cerrar = leer("nuxt-app/server/api/recepcion-contenedores/[id]/cerrar.post.ts");
  const novedad = leer("nuxt-app/server/api/recepcion-contenedores/[id]/novedad.post.ts");

  // El reloj lo sella el servidor: el del teléfono del operario puede estar en
  // cualquier hora.
  it("el reloj arranca en el servidor al abrir", () => {
    expect(post).toContain("horaInicio: now");
    expect(post).toContain("const now = new Date()");
  });

  // El operario está en un contenedor, no en dos.
  it("no deja dos planillas abiertas a la vez", () => {
    expect(post).toContain("estado: 'EN_CURSO'");
    expect(post).toContain("statusCode: 409");
    // El 409 devuelve la planilla abierta para llevar al operario allí.
    expect(post).toContain("data: { recepcion: mapRecepcion(abierta) }");
  });

  it("cerrar para el reloj y guarda el resultado de la descarga", () => {
    expect(cerrar).toContain("horaFinalizacion: now");
    expect(cerrar).toContain("estibasUsadas");
    expect(cerrar).toContain("referenciasNuevas");
    expect(cerrar).toContain("validarCierre");
  });

  // Los reportes se levantan con el contenedor ya abajo y no cuentan tiempo.
  it("no se puede reportar una novedad antes de cerrar", () => {
    expect(novedad).toContain("record.estado !== 'CERRADO'");
    expect(novedad).toContain("statusCode: 409");
  });

  // Si el maestro cambia mañana, el reporte tiene que seguir diciendo lo que se
  // vio hoy: por eso se copia en vez de leerse por join.
  it("la descripcion se copia del maestro a la novedad", () => {
    expect(novedad).toContain("descripcionDePlu");
    expect(novedad).toContain("descripcion: descripcion!");
  });

  it("la foto es obligatoria en averias y maltratada", () => {
    expect(novedad).toContain("validarLineaNovedad");
    expect(calcServidor).toContain('export const NOVEDADES_CON_FOTO = ["AVERIA", "MALTRATADA"]');
  });
});

describe("recepcion — el modulo esta registrado en todas partes", () => {
  it("las tres copias de modulePermissions lo conocen", () => {
    for (const rel of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      const src = leer(rel);
      expect(src).toContain("recepcion-contenedores");
      // Sin MONTACARGAS: descargan, pero no llevan la planilla.
      const linea = src.split(/\r?\n/).find((l) => l.includes("'recepcion-contenedores':") || l.includes('"recepcion-contenedores":')) ?? "";
      expect(linea).toContain("OPERARIO_ALMACENAMIENTO");
      expect(linea).not.toContain("MONTACARGAS");
    }
  });

  // Sin la regla de rewrite la ruta da 404 en produccion: no hay pagina React
  // de respaldo, el modulo se construyo directo en Nuxt.
  it("el proxy de Next enruta el modulo", () => {
    // Da igual como este formateada la lista: lo que se exige es que el modulo
    // este dentro del bloque que emite los rewrites del CEDI.
    const cfg = leer("next.config.ts");
    expect(cfg).toMatch(/for \(const modulo of \[[\s\S]*?"recepcion-contenedores"[\s\S]*?\]\)/);
  });

  it("aparece en la navegacion de los dos stacks", () => {
    expect(leer("nuxt-app/app/layouts/default.vue")).toContain("/dashboard/recepcion-contenedores");
    expect(leer("src/components/common/Sidebar.tsx")).toContain("/dashboard/recepcion-contenedores");
  });

  it("existe la pagina de Nuxt", () => {
    expect(leer("nuxt-app/app/pages/recepcion-contenedores.vue")).toContain("RecepcionModule");
  });
});

// Menu por AREAS en una barra arriba (25-09): libera el ancho de la barra
// lateral para el contenido; en el celular las areas son secciones del cajon.
describe("menu — barra superior por areas", () => {
  const layout = leer("nuxt-app/app/layouts/default.vue");

  it("las seis areas y donde va cada modulo", () => {
    expect(layout).toContain("interface NavGroup { titulo: string; icon: unknown; items: NavItem[] }");
    for (const a of ["'Almacenamiento'", "'Inventarios'", "'Gourmet'", "'Muebles'", "'Transporte'", "'Gestión'"]) expect(layout).toContain(`titulo: ${a}`);
    const area = (t: string) => layout.slice(layout.indexOf(`titulo: '${t}'`), layout.indexOf("],", layout.indexOf(`titulo: '${t}'`)));
    expect(area("Almacenamiento")).toContain("/dashboard/exportaciones-eeuu");
    expect(area("Transporte")).toContain("/dashboard/tienda");
    expect(area("Gourmet")).toContain("INTEGRACION");
    expect(area("Muebles")).toContain("INTEGRACION");
  });

  it("desplegable por area; con un solo modulo entra directo", () => {
    expect(layout).toContain('v-if="g.items.length === 1"');
    expect(layout).toContain("abrir(`area:${g.titulo}`)");
    expect(layout).toContain(':aria-expanded=');
  });

  // Un area cuyos items no pueda ver el rol no aparece.
  it("un area sin items visibles no se pinta", () => {
    expect(layout).toContain("filter((g) => g.items.length > 0)");
  });

  it("la barra lateral solo existe como cajon en pantallas chicas", () => {
    expect(layout).toContain("@media (min-width: 1081px) { .sidebar, .nav-overlay { display: none; } }");
  });
});

// sanearPaginacion no devuelve `skip`: leerlo de ahi daba undefined y la
// pagina 2 del listado repetia la 1.
describe("recepcion — paginacion del listado", () => {
  it("calcula el salto a partir de la pagina", () => {
    const get = leer("nuxt-app/server/api/recepcion-contenedores/index.get.ts");
    expect(get).toContain("skip: (page - 1) * pageSize");
    expect(get).not.toMatch(/\{ page, pageSize, skip \}/);
  });
});

describe("recepcion — tipo de contenedor y corrección", () => {
  const sql = leer("prisma/migrate-recepcion-tipo-contenedor.sql");
  const patch = leer("nuxt-app/server/api/recepcion-contenedores/[id]/index.patch.ts");
  const post = leer("nuxt-app/server/api/recepcion-contenedores/index.post.ts");

  it("el SQL es aditivo, idempotente y sin backfill", () => {
    expect(sql).toContain("IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoContenedorRecepcion')");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS tipo_contenedor \"TipoContenedorRecepcion\";");
    expect(sql).not.toMatch(/NOT NULL|UPDATE recepciones_contenedor/);
  });

  it("los dos schema.prisma tienen la columna opcional", () => {
    for (const f of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(f)).toContain('tipoContenedor TipoContenedorRecepcion? @map("tipo_contenedor")');
    }
  });

  it("abrir exige el tipo; la lista lo devuelve", () => {
    expect(post).toContain("tipoContenedor: z.enum(['CARGA_SUELTA', 'PIES_20', 'PIES_40']");
    expect(post).toContain("tipoContenedor: d.tipoContenedor,");
    expect(leer("nuxt-app/server/utils/mapRow.ts")).toContain("tipoContenedor: r.tipoContenedor ?? null,");
  });

  it("corregir: dueño o supervisión, con motivo, sin tocar borradas, con auditoría", () => {
    expect(patch).toContain("validarCorreccionRecepcion(d)");
    expect(patch).toContain("esDuenoOGestor(actor, current)");
    expect(patch).toContain("current.deletedAt");
    expect(patch).toContain("motivoCorreccion: motivo");
    expect(patch).toContain("actualizadoPorId: actor.id");
    expect(patch).toContain("prisma.activityLog.create");
    // Las horas son la métrica: esta ruta no las toca.
    expect(patch).not.toMatch(/horaInicio|horaFinalizacion/);
  });

  it("la pantalla pide el tipo, lo muestra y deja corregir", () => {
    const cap = leer("nuxt-app/app/components/recepcion/Captura.vue");
    const tabla = leer("nuxt-app/app/components/recepcion/Tabla.vue");
    const modal = leer("nuxt-app/app/components/recepcion/EditarModal.vue");
    expect(cap).toContain("tipoContenedor: null as TipoContenedorRecepcion | null");
    expect(cap).toContain('v-for="t in TIPOS_CONTENEDOR"');
    expect(tabla).toContain("<th>Contenedor</th>");
    expect(tabla).toContain("Sin tipo");
    expect(tabla).toContain("props.canManage || item.creadoPorId === props.userId");
    expect(modal).toContain("method: 'PATCH'");
    expect(modal).toContain("Motivo de la corrección (obligatorio)");
  });
});
