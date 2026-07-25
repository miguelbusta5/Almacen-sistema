// Cubre el port de Exportaciones a nuxt-app. Los helpers viven duplicados (client
// en app/utils, server en server/utils) porque Nitro y Vue resuelven alias distintos;
// estos tests son la red que impide que se desincronicen de src/lib/exportaciones.ts.
import { describe, it, expect } from "vitest";
import {
  calcularTotalProductividad,
  estadoExport,
  hoyBogota,
  normalizePlu as normalizePluClient,
  puedeGestionarExportaciones as gestionaClient,
  puedeUsarExportaciones as usaClient,
  sumarDias,
  toneProm,
  PAISES_EXPORT,
  type Exportacion,
  type UserStat,
} from "../../nuxt-app/app/utils/exportaciones";
import {
  puedeUsarExportaciones as usaSrv,
  puedeGestionarExportaciones as gestionaSrv,
} from "../../src/lib/exportaciones";

const ROLES = [
  "ADMIN", "GERENTE", "OPERADOR", "TRANSPORTISTA", "INVENTARIO", "TRANSPORTE",
  "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "TIENDA", "SUPERVISOR_TIENDA",
  "OPERACIONES_MUEBLES", "OPERACIONES_GOURMET", "ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO",
] as const;

describe("exportaciones (port Nuxt) — paridad de permisos con src/lib", () => {
  it.each(ROLES)("%s: puedeUsar coincide entre Next y Nuxt", (role) => {
    expect(usaClient(role)).toBe(usaSrv(role));
  });

  it.each(ROLES)("%s: puedeGestionar coincide entre Next y Nuxt", (role) => {
    expect(gestionaClient(role)).toBe(gestionaSrv(role));
  });

  it("ETIQUETADO usa pero no gestiona", () => {
    expect(usaClient("ETIQUETADO")).toBe(true);
    expect(gestionaClient("ETIQUETADO")).toBe(false);
  });

  it("roles ajenos al modulo quedan fuera", () => {
    expect(usaClient("TIENDA")).toBe(false);
    expect(usaClient(null)).toBe(false);
    expect(usaClient(undefined)).toBe(false);
  });
});

describe("exportaciones (port Nuxt) — zona horaria", () => {
  // 03:00 UTC son las 22:00 del dia anterior en Bogota (UTC-5). Si esta funcion se
  // reescribiera con dayjs o con `new Date(fecha)` sin la Z, el dia se desplazaria y
  // los registros creados desde la app Next no apareceran en la Nuxt (comparten tabla).
  it("hoyBogota devuelve el dia colombiano, no el UTC", () => {
    expect(hoyBogota(new Date("2026-07-24T03:00:00Z"))).toBe("2026-07-23");
  });

  it("hoyBogota no se adelanta durante la jornada", () => {
    expect(hoyBogota(new Date("2026-07-24T16:00:00Z"))).toBe("2026-07-24");
  });

  it("sumarDias cruza el cambio de mes", () => {
    expect(sumarDias("2026-07-01", -6)).toBe("2026-06-25");
    expect(sumarDias("2026-07-24", 0)).toBe("2026-07-24");
  });
});

describe("exportaciones (port Nuxt) — helpers", () => {
  it("normalizePlu recorta y pasa a mayusculas", () => {
    expect(normalizePluClient("  a4011 ")).toBe("A4011");
  });

  it("estadoExport depende solo de horaFinalizacion", () => {
    const base = { horaFinalizacion: null } as Exportacion;
    expect(estadoExport(base)).toBe("en-curso");
    expect(estadoExport({ ...base, horaFinalizacion: "2026-07-24T12:00:00.000Z" })).toBe("finalizado");
  });

  it("toneProm aplica el semaforo 5/10", () => {
    expect(toneProm(null)).toBe("var(--faint)");
    expect(toneProm(5)).toBe("var(--u-ok)");
    expect(toneProm(7.5)).toBe("var(--u-aviso)");
    expect(toneProm(11)).toBe("var(--u-critico)");
  });
});

describe("exportaciones (port Nuxt) — fila Total de productividad", () => {
  const stats: UserStat[] = [
    { id: "u1", nombre: "Ana", cajas: 10, plusDistintos: 4, totalUnidades: 60, finalizadas: 9, duracionTotalMin: 70, promedioPorCajaMin: 7.8 },
    { id: "u2", nombre: "Beto", cajas: 5, plusDistintos: 3, totalUnidades: 30, finalizadas: 5, duracionTotalMin: 40, promedioPorCajaMin: 8 },
  ];

  it("suma cajas, unidades, finalizadas y minutos", () => {
    const t = calcularTotalProductividad(stats);
    expect(t.cajas).toBe(15);
    expect(t.totalUnidades).toBe(90);
    expect(t.finalizadas).toBe(14);
    expect(t.duracionTotalMin).toBe(110);
  });

  it("promedia sobre finalizadas, no sobre cajas", () => {
    expect(calcularTotalProductividad(stats).promedioPorCajaMin).toBe(7.9);
  });

  it("los PLU distintos no son sumables entre operarios", () => {
    expect(calcularTotalProductividad(stats).plusDistintos).toBe(0);
  });

  it("sin finalizadas el promedio es null, no division por cero", () => {
    const sin: UserStat[] = [{ ...stats[0]!, finalizadas: 0, duracionTotalMin: 0 }];
    expect(calcularTotalProductividad(sin).promedioPorCajaMin).toBeNull();
  });
});

describe("exportaciones (port Nuxt) — config de paises", () => {
  it("cada pais tiene routeName igual al ultimo segmento de basePath", () => {
    // De esto depende que el sidebar resalte el item activo: `key` compara contra
    // route.name, que Nuxt deriva del nombre del archivo en app/pages/.
    for (const cfg of Object.values(PAISES_EXPORT)) {
      expect(cfg.basePath).toBe(`/dashboard/${cfg.routeName}`);
    }
  });

  it("routeName y moduleKey coinciden por pais", () => {
    for (const cfg of Object.values(PAISES_EXPORT)) {
      expect(cfg.routeName).toBe(cfg.moduleKey);
    }
  });

  it("los routeName son distintos entre si y ninguno es prefijo de otro por igualdad", () => {
    const names = Object.values(PAISES_EXPORT).map((c) => c.routeName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("apiBase apunta al modulo correcto", () => {
    expect(PAISES_EXPORT.ecuador.apiBase).toBe("/api/exportaciones");
    expect(PAISES_EXPORT.mexico.apiBase).toBe("/api/exportaciones-mexico");
    expect(PAISES_EXPORT.eeuu.apiBase).toBe("/api/exportaciones-eeuu");
  });
});
