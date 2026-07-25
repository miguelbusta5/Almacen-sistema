// Guarda de sincronía del port de Solicitudes Transporte a nuxt-app.
//
// Los archivos de nuxt-app se leen como TEXTO, no se importan: viven bajo su propio
// tsconfig, que referencia ./.nuxt/* — un directorio que genera `nuxt prepare` y que
// está gitignorado, así que en CI no existe y cualquier import cruzado revienta el
// transform con TSCONFIG_ERROR. Ver src/__tests__/exportacionesNuxt.test.ts.
//
// Lo que protegen: la lógica está triplicada a propósito (Next, cliente Nuxt, Nitro)
// y las tres copias escriben en la MISMA tabla.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  calcularPrioridadSolicitudTransporte,
  calcularSemaforoSolicitudTransporte,
  estadoDesdeStella,
  parseDateOnly,
  puedeGestionarSolicitudTransporte,
  validarFlete,
  validarPlinesSolicitudTransporte,
} from "@/lib/solicitudesTransporte";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

// Varios de estos archivos llevan comentarios que MENCIONAN justo lo que no debe
// aparecer en el código (p.ej. "no reutilizar todayBogota"). Las aserciones negativas
// se hacen contra el código sin comentarios.
const sinComentarios = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const calc = leer("nuxt-app/server/utils/solicitudesTransporteCalc.ts");
const schemas = leer("nuxt-app/server/utils/solicitudesTransporteSchemas.ts");
const srv = leer("nuxt-app/server/utils/solicitudesTransporte.ts");
const patch = leer("nuxt-app/server/api/solicitudes-transporte/[id]/index.patch.ts");
const rechazar = leer("nuxt-app/server/api/solicitudes-transporte/[id]/rechazar.post.ts");
const reenviar = leer("nuxt-app/server/api/solicitudes-transporte/[id]/reenviar.post.ts");
const listado = leer("nuxt-app/server/api/solicitudes-transporte/index.get.ts");
const utilsCliente = leer("nuxt-app/app/utils/solicitudesTransporte.ts");
const formModal = leer("nuxt-app/app/components/solicitudes-transporte/FormModal.vue");
const modulePermSrv = leer("nuxt-app/server/utils/modulePermissions.ts");
const modulePermCli = leer("nuxt-app/app/utils/modulePermissions.ts");
const layout = leer("nuxt-app/app/layouts/default.vue");
const nextConfig = leer("next.config.ts");

// ── Comportamiento (fuente de verdad: src/lib, que el port copia literal) ──
describe("solicitudes transporte — cálculo de prioridad y semáforo", () => {
  const d = (s: string) => new Date(`${s}T00:00:00`);

  it("prioridad por días entre solicitud y promesa", () => {
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), d("2026-06-04"))).toBe("ALTO");
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), d("2026-06-06"))).toBe("MEDIO");
    expect(calcularPrioridadSolicitudTransporte(d("2026-06-01"), d("2026-06-07"))).toBe("BAJO");
    expect(calcularPrioridadSolicitudTransporte(null, d("2026-06-07"))).toBeNull();
  });

  it("el semáforo corta en vencido / por vencer / en fecha", () => {
    const hoy = d("2026-06-10");
    const s = (promesa: string | null) => calcularSemaforoSolicitudTransporte({
      stellaEstado: "PENDIENTE", fechaPromesaEntrega: promesa ? d(promesa) : null, hoy,
    });
    expect(s("2026-06-09")).toBe("VENCIDO");
    expect(s("2026-06-10")).toBe("ALERTA");
    expect(s("2026-06-12")).toBe("ALERTA");
    expect(s("2026-06-13")).toBe("NORMAL");
    expect(s(null)).toBe("SIN_FECHA");
  });

  it("stella EFECTUADO/CANCELADO manda sobre la fecha", () => {
    const hoy = d("2026-06-10");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "EFECTUADO", fechaPromesaEntrega: d("2020-01-01"), hoy })).toBe("EFECTUADO");
    expect(calcularSemaforoSolicitudTransporte({ stellaEstado: "CANCELADO", fechaPromesaEntrega: d("2020-01-01"), hoy })).toBe("CANCELADO");
  });

  it("estadoDesdeStella mapea los 4 valores", () => {
    expect(estadoDesdeStella("PROGRAMADO")).toBe("PROGRAMADA");
    expect(estadoDesdeStella("EFECTUADO")).toBe("EFECTUADA");
    expect(estadoDesdeStella("CANCELADO")).toBe("CANCELADA");
    expect(estadoDesdeStella("PENDIENTE")).toBe("PENDIENTE");
  });

  it("parseDateOnly exige el formato exacto", () => {
    expect(parseDateOnly("2026-13-45")).not.toBeNull(); // JS normaliza, pero el regex pasa
    expect(parseDateOnly("01/06/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });

  it("validarFlete acepta 0 pero no ausencia", () => {
    expect(validarFlete(true, 0)).toBeNull();
    expect(validarFlete(true, null)).toBe("Debes ingresar el valor del flete");
    expect(validarFlete(false, null)).toBeNull();
    expect(validarFlete(undefined, 10)).toBe("Debes indicar si se cobro flete");
  });

  it("validarPlines exige plu, descripcion y unidades enteras", () => {
    expect(validarPlinesSolicitudTransporte([])).toBe("Agrega al menos un PLU");
    expect(validarPlinesSolicitudTransporte([{ plu: "", descripcion: "x", unidades: 1 }])).toBe("Cada linea debe tener PLU");
    expect(validarPlinesSolicitudTransporte([{ plu: "1", descripcion: "", unidades: 1 }])).toBe("Cada linea debe tener descripcion");
    expect(validarPlinesSolicitudTransporte([{ plu: "1", descripcion: "x", unidades: 0 }])).toBe("Cada linea debe tener unidades validas");
    expect(validarPlinesSolicitudTransporte([{ plu: "1", descripcion: "x", unidades: 2 }])).toBeNull();
  });

  it("los gestores son ADMIN, GERENTE y SUPERVISOR_TRANSPORTE", () => {
    for (const r of ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"]) {
      expect(puedeGestionarSolicitudTransporte(r)).toBe(true);
    }
    expect(puedeGestionarSolicitudTransporte("TIENDA")).toBe(false);
  });
});

// ── Sincronía del port ────────────────────────────────────────────────
describe("port Nuxt — la convención de fechas no se reescribió", () => {
  it("parseDateOnly construye la fecha SIN sufijo Z", () => {
    // Con Z se escribiría un día distinto al que escribe la app Next sobre la misma
    // tabla, y la app Next (que sigue leyendo estas mismas tablas) contaría mal.
    expect(calc).toContain("T00:00:00`)");
    expect(calc).not.toMatch(/\$\{value\}T00:00:00\.000Z/);
  });

  it("no se cuela el todayBogota de exportaciones", () => {
    const codigo = sinComentarios(calc);
    expect(codigo).not.toContain("todayBogota");
    expect(codigo).not.toMatch(/from ['"]dayjs['"]/);
  });

  it("mesSolicitud conserva timeZone UTC", () => {
    expect(calc).toContain("timeZone: 'UTC'");
  });
});

describe("port Nuxt — el PATCH conserva sus tres gates y el reemplazo de plines", () => {
  it("clasifica gestión vs edición con GESTION_KEYS", () => {
    expect(patch).toContain("GESTION_KEYS");
    expect(patch).toContain("isGestion");
    expect(patch).toContain("isSolicitanteEdit");
  });

  it("mantiene los tres mensajes de error de negocio", () => {
    expect(patch).toContain("Solo transporte puede gestionar la solicitud");
    expect(patch).toContain("Solo puedes editar solicitudes pendientes o rechazadas propias");
    expect(patch).toContain("La solicitud ya esta en gestion de transporte");
  });

  it("el deleteMany de plines vive DENTRO del nested write", () => {
    // Suelto (prisma.pluSolicitudTransporte.deleteMany({})) vaciaría la tabla entera.
    expect(patch).toMatch(/plines:\s*\{\s*\n?\s*deleteMany:\s*\{\}/);
    expect(sinComentarios(patch)).not.toContain("pluSolicitudTransporte.deleteMany");
  });

  it("una edición del solicitante sobre RECHAZADA pasa a REENVIADA", () => {
    expect(patch).toMatch(/current\.estado === 'RECHAZADA' && isSolicitanteEdit/);
    expect(patch).toContain("motivoRechazo: null");
  });
});

describe("port Nuxt — los 4 defectos corregidos", () => {
  it("1· rechazar y reenviar devuelven los PLUs", () => {
    // Sin plines en el include, el cliente mete la respuesta en el detalle abierto y
    // los PLUs desaparecen de pantalla como si se hubieran borrado.
    expect(rechazar).toContain("include: SOLICITUD_INCLUDE");
    expect(reenviar).toContain("include: SOLICITUD_INCLUDE");
    expect(srv).toMatch(/SOLICITUD_INCLUDE[\s\S]{0,160}plines:\s*true/);
  });

  it("2· el listado pagina de verdad", () => {
    expect(listado).toContain("sanearPaginacion");
    expect(listado).toContain("skip: (page - 1) * pageSize");
    // Number('abc') es NaN y skip: NaN revienta Prisma.
    expect(calc).toContain("Number.isFinite");
  });

  it("3· el error del detalle se renderiza en el detalle", () => {
    const detalle = leer("nuxt-app/app/components/solicitudes-transporte/Detalle.vue");
    expect(detalle).toMatch(/v-if="error"/);
  });

  it("4· el formulario de edición NUNCA envía claves de gestión", () => {
    // Es el bug que rompía "Corregir" para los 6 roles no gestores en producción.
    expect(formModal).toContain("for (const k of GESTION_KEYS) delete payload[k]");
    expect(formModal).not.toMatch(/\.\.\.\s*props\.initial/);
    expect(utilsCliente).toContain("GESTION_KEYS");
  });
});

describe("port Nuxt — filtro por dueño", () => {
  it("buildWhereSolicitud exige el actor y acota a los no gestores", () => {
    expect(srv).toMatch(/actor:\s*\{\s*id:\s*string;\s*role:\s*string\s*\}/);
    expect(srv).toMatch(/esGestor \? \{\} : \{ creadoPorId: actor\.id \}/);
  });

  it("los KPIs parten del mismo where que la lista", () => {
    // Un KPI sin el filtro de dueño delataría totales ajenos aunque la lista esté bien.
    const usos = listado.match(/buildWhereSolicitud\(actor/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(3);
  });
});

describe("port Nuxt — matriz de módulos sincronizada entre las tres copias", () => {
  const extraer = (src: string) =>
    (src.match(/'solicitudes-transporte':\s*\[([\s\S]*?)\]/)?.[1] ?? "")
      .split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean);

  it("cliente y servidor de Nuxt declaran los mismos roles", () => {
    expect(extraer(modulePermSrv)).toEqual(extraer(modulePermCli));
  });

  it("y coinciden con la fuente de Next", () => {
    const next = (leer("src/lib/modulePermissions.ts").match(/"solicitudes-transporte":\s*\[([\s\S]*?)\]/)?.[1] ?? "")
      .split(",").map((s) => s.trim().replace(/['"]/g, "")).filter((s) => s && !s.startsWith("//"));
    expect(extraer(modulePermSrv).sort()).toEqual(next.sort());
  });

  it("los roles OPERACIONES_* siguen fuera", () => {
    expect(extraer(modulePermSrv)).not.toContain("OPERACIONES_GOURMET");
    expect(extraer(modulePermSrv)).not.toContain("OPERACIONES_MUEBLES");
  });
});

describe("port Nuxt — cableado de la ruta", () => {
  it("el sidebar tiene key para poder resaltar el módulo", () => {
    expect(layout).toMatch(/href: '\/dashboard\/solicitudes-transporte'[^}]*key: 'solicitudes-transporte'/);
  });

  it("existe la página cuyo nombre de archivo es el route.name", () => {
    expect(() => leer("nuxt-app/app/pages/solicitudes-transporte.vue")).not.toThrow();
  });

  it("la variable entra en la cadena de SHARED_NUXT_URL", () => {
    // Sin esto, si fuera la única definida no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y la página cargaría en blanco.
    expect(nextConfig).toMatch(/SHARED_NUXT_URL\s*=[^;]*NUXT_PILOT_SOLICITUDES_URL/);
    expect(nextConfig).toMatch(/if \(NUXT_PILOT_SOLICITUDES_URL\)/);
  });
});

describe("port Nuxt — los mensajes de zod son los mismos que ve el usuario", () => {
  it.each([
    "Cantidad cajas es obligatoria",
    "Debes indicar el area",
    "Debes indicar el punto de recogida",
    "Debes indicar el tipo de servicio",
    "Debes describir la restriccion horaria",
  ])("conserva %s", (msg) => {
    expect(schemas).toContain(msg);
  });
});
