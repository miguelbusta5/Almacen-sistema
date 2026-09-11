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

// Once modulos seguidos sin ningun corte son una pared: hay que leerlos todos
// para encontrar uno.
describe("menu lateral — bloques con nombre", () => {
  const layout = leer("nuxt-app/app/layouts/default.vue");

  it("los grupos tienen titulo", () => {
    expect(layout).toContain("interface NavGroup { titulo: string | null; items: NavItem[] }");
    expect(layout).toContain("Centro de distribución");
    expect(layout).toContain("Pedidos y exportación");
    expect(layout).toContain('v-if="group.titulo" class="nav-titulo"');
  });

  // Un grupo cuyos items no pueda ver el rol no debe pintar ni su titulo.
  it("un grupo sin items visibles no se pinta", () => {
    expect(layout).toContain("filter((g) => g.items.length > 0)");
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
