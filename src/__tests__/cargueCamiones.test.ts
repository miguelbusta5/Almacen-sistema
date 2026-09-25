// Cargue de camiones (25-09-2026): el camion con quienes lo cargan, las ordenes
// OVDM/TSDM que se le suben (de Cargue Gourmet y/o Muebles) con su reloj y sus
// bultos, y sus indicadores.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canSeeModule } from "@/lib/modulePermissions";
import { cargarNuxt } from "./apoyo/nuxt";

const calc = cargarNuxt("utils/cargueCamionCalc.ts");
const ind = cargarNuxt("utils/cargueIndicadoresCalc.ts");
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("reglas del cargue", () => {
  it("codigo OVDM/TSDM normalizado", () => {
    expect(calc.normalizarCodigoCargue(" ovdm 121-831 ")).toBe("OVDM121831");
    expect(calc.validarCodigoCargue("tsdm104781")).toBeNull();
    expect(calc.validarCodigoCargue("CONTADO-1155773")).toMatch(/OVDM o TSDM/);
    expect(calc.tipoOrdenCargue("TSDM1")).toBe("TSDM");
  });

  it("iniciar el camion pide tipo, transportadora y quienes cargan", () => {
    const base = { tipoVehiculo: "Turbo", transportadora: "X", operarios: ["a"] };
    expect(calc.validarInicioCamion(base)).toBeNull();
    expect(calc.validarInicioCamion({ ...base, tipoVehiculo: " " })).toMatch(/tipo de vehiculo/);
    expect(calc.validarInicioCamion({ ...base, transportadora: "" })).toMatch(/transportadora/);
    expect(calc.validarInicioCamion({ ...base, operarios: [] })).toMatch(/al menos una persona/);
    expect(calc.normalizarPlaca(" abc-123 ")).toBe("ABC123");
    expect(calc.normalizarTextoCargue("  turbo   doble ")).toBe("TURBO DOBLE");
  });

  it("que ordenes se pueden subir", () => {
    // Gourmet: los listos quedan en UBICACION_ASIGNADA (el 25-09 habia 3.079 asi y 0 enviados).
    expect(calc.gourmetCargable("UBICACION_ASIGNADA")).toBe(true);
    expect(calc.gourmetCargable("CARGUE_COMPLETO")).toBe(true);
    expect(calc.gourmetCargable("BORRADOR")).toBe(false);
    expect(calc.gourmetCargable("CANCELADO")).toBe(false);
    expect(calc.mueblesCargable("INSPECCIONADA")).toBe(true);
    expect(calc.mueblesCargable("ENTREGADA_TRANSPORTE")).toBe(true);
    expect(calc.mueblesCargable("EN_INSPECCION")).toBe(false);
    expect(calc.mueblesCargable("EN_PICKING")).toBe(false);
  });

  it("bultos de muebles = unidades x partes (cajas); origen", () => {
    expect(calc.bultosMuebles([{ unidades: 2, partes: 4 }, { unidades: 3, partes: null }, { unidades: 1, partes: 0 }])).toBe(12);
    expect(calc.origenDe(true, true)).toBe("AMBOS");
    expect(calc.origenDe(true, false)).toBe("GOURMET");
    expect(calc.origenDe(false, true)).toBe("MUEBLES");
    expect(calc.origenDe(false, false)).toBe("MANUAL");
  });

  it("finalizar la orden: bultos contados; si no cuadran, nota obligatoria", () => {
    expect(calc.validarFinOrden({ declarados: 10, cargados: 10 })).toBeNull();
    expect(calc.validarFinOrden({ declarados: 10, cargados: 9 })).toMatch(/Se declararon 10 bultos y se cargaron 9/);
    expect(calc.validarFinOrden({ declarados: 10, cargados: 9, nota: "una caja rota" })).toBeNull();
    expect(calc.validarFinOrden({ declarados: null, cargados: 4 })).toBeNull();
    expect(calc.validarFinOrden({ declarados: 3, cargados: -1 })).toMatch(/cuantos bultos/);
    expect(calc.validarFinOrden({ declarados: 3, cargados: 2.5 })).toMatch(/cuantos bultos/);
  });

  it("cerrar el camion: sin ordenes a medias y con al menos una", () => {
    expect(calc.validarCierreCamion([])).toMatch(/al menos una orden/);
    expect(calc.validarCierreCamion([{ horaFin: null }])).toMatch(/orden en cargue/);
    expect(calc.validarCierreCamion([{ horaFin: new Date() }])).toBeNull();
  });
});

describe("indicadores del cargue", () => {
  const t = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 24, h + 5, m)); // hora de Bogota
  const orden = (o: Partial<any>) => ({
    codigo: "OVDM1", origen: "MUEBLES", tienda: null, cliente: null, ciudad: "MEDELLIN", bultosDeclarados: 10, bultosCargados: 10,
    notaDiferencia: null, m3: 1.5, kg: 100, valorOvdm: 1000, horaInicio: t(8), horaFin: t(8, 30), ...o,
  });
  const camiones = [
    { id: "c1", fecha: "2026-09-24", tipoVehiculo: "TURBO", transportadora: "TCC", placa: "A1", horaInicio: t(8), horaFinalizacion: t(9),
      operarios: ["JONATAN ORTEGA", "HECTOR CAÑAS"],
      ordenes: [orden({}), orden({ codigo: "TSDM2", origen: "GOURMET", ciudad: "cali", bultosDeclarados: 5, bultosCargados: 4, notaDiferencia: "rota", m3: null, kg: null, valorOvdm: null, horaInicio: t(8, 30), horaFin: t(9) })] },
    { id: "c2", fecha: "2026-09-25", tipoVehiculo: "SENCILLO", transportadora: "TCC", placa: null, horaInicio: t(14), horaFinalizacion: t(14, 40),
      operarios: ["JONATAN ORTEGA"], ordenes: [orden({ codigo: "OVDM3", bultosCargados: 6, bultosDeclarados: 6, horaInicio: t(14), horaFin: t(14, 40) })] },
  ];

  it("resumen: camiones, ordenes, bultos, tiempos, bultos por hora, novedades y lo de muebles", () => {
    const r = ind.resumirCargue(camiones);
    expect(r).toMatchObject({
      camiones: 2, ordenes: 3, bultos: 20, bultosDeclarados: 21, dias: 2, camionesDia: 1, bultosDia: 10,
      minCamion: 50, novedades: 1, pctNovedad: 33.3, m3: 3, kg: 200, valorOvdm: 2000,
    });
    // 20 bultos en 30 + 30 + 40 = 100 min de cargue de ordenes.
    expect(r.bultosHora).toBe(12);
    expect(r.minOrden).toBe(33.3);
  });

  it("repartos: transportadora, ciudad, persona (cada camion le cuenta completo), origen, hora y novedades", () => {
    const i = ind.indicadoresCargue(camiones);
    expect(i.porTransportadora).toEqual([expect.objectContaining({ clave: "TCC", camiones: 2, ordenes: 3, bultos: 20 })]);
    expect(i.porCiudad.map((g: any) => [g.clave, g.bultos])).toEqual([["MEDELLIN", 16], ["CALI", 4]]);
    expect(i.porOperario.find((g: any) => g.clave === "JONATAN ORTEGA")).toMatchObject({ camiones: 2, bultos: 20 });
    expect(i.porOperario.find((g: any) => g.clave === "HECTOR CAÑAS")).toMatchObject({ camiones: 1, bultos: 14 });
    expect(i.porOrigen.map((g: any) => g.clave)).toEqual(["Muebles", "Gourmet"]);
    expect(i.porHora).toEqual([{ hora: 8, camiones: 1 }, { hora: 14, camiones: 1 }]);
    expect(i.novedades).toEqual([expect.objectContaining({ codigo: "TSDM2", declarados: 5, cargados: 4, nota: "rota" })]);
    expect(i.porDia.map((d: any) => [d.dia, d.camiones, d.bultos, d.valorOvdm])).toEqual([["2026-09-24", 1, 14, 1000], ["2026-09-25", 1, 6, 1000]]);
  });

  it("sin camiones no divide por cero", () => {
    expect(ind.resumirCargue([])).toMatchObject({ camiones: 0, camionesDia: null, minCamion: null, bultosHora: null, pctNovedad: null });
  });
});

describe("cableado", () => {
  it("permisos: el equipo de transporte opera; supervision ve los indicadores", () => {
    for (const r of ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"]) expect(canSeeModule(r, "cargue-camiones")).toBe(true);
    expect(canSeeModule("OPERARIO_ALMACENAMIENTO", "cargue-camiones")).toBe(false);
    expect(canSeeModule("TRANSPORTE", "indicadores-transporte")).toBe(false);
    expect(canSeeModule("SUPERVISOR_TRANSPORTE", "indicadores-transporte")).toBe(true);
    const nuxt = leer("nuxt-app/app/utils/modulePermissions.ts");
    expect(nuxt).toContain("'cargue-camiones': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN']");
    expect(nuxt).toContain("'indicadores-transporte': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN']");
  });

  it("el servidor exige el rol en cada endpoint", () => {
    const util = leer("nuxt-app/server/utils/cargueCamion.ts");
    expect(util).toContain("if (!puedeCargarCamiones(actor.role))");
    for (const f of [
      "index.get.ts", "index.post.ts", "buscar.get.ts", "operarios/index.get.ts", "[id]/cerrar.post.ts",
      "[id]/index.patch.ts", "[id]/ordenes/index.post.ts", "[id]/ordenes/[ordenId]/finalizar.post.ts", "[id]/ordenes/[ordenId]/index.delete.ts",
    ]) expect(leer(`nuxt-app/server/api/cargue-camiones/${f}`)).toMatch(/requireCargue\(event\)|requireGestionCargue\(event/);
    for (const f of ["operarios/index.post.ts", "operarios/[id].patch.ts"]) {
      expect(leer(`nuxt-app/server/api/cargue-camiones/${f}`)).toContain("if (actor.role !== 'ADMIN')");
    }
    expect(leer("nuxt-app/server/api/cargue-camiones/[id]/index.delete.ts")).toContain("requireGestionCargue(event");
    expect(leer("nuxt-app/server/api/indicadores-transporte/index.get.ts")).toContain("if (!ROLES.includes(actor.role))");
  });

  it("al finalizar la orden se actualiza el origen y se sella lo de muebles", () => {
    const fin = leer("nuxt-app/server/api/cargue-camiones/[id]/ordenes/[ordenId]/finalizar.post.ts");
    expect(fin).toContain("where: { id: orden.ordenMueblesId, estado: 'INSPECCIONADA' }");
    expect(fin).toContain("data: { estado: 'ENTREGADA_TRANSPORTE', entregadaTransporteAt: now, entregadaPorId: actor.id }");
    expect(fin).toContain("estado: 'CARGUE_COMPLETO_MANUAL', esCierreManual: true, cantidadContadaManual: bultos");
    expect(fin).toContain("if (om.tipoOrden === 'OVDM' && !om.tiendaOrigenCodigo)");
  });

  it("menus, redireccion de Next, pagina y area de indicadores", () => {
    expect(leer("nuxt-app/app/layouts/default.vue")).toContain("href: '/dashboard/cargue-camiones', key: 'cargue-camiones', moduleKey: 'cargue-camiones'");
    expect(leer("src/components/common/Sidebar.tsx")).toContain('href: "/dashboard/cargue-camiones"');
    expect(leer("next.config.ts")).toContain('"cargue-camiones",');
    expect(leer("nuxt-app/app/pages/cargue-camiones.vue")).toContain("<CargueCamionesModule />");
    const pag = leer("nuxt-app/app/pages/indicadores.vue");
    expect(pag).toContain("canSeeModule(me.value?.role, 'indicadores-transporte')");
    expect(pag).toContain("<IndicadoresTransporteModule v-else-if=\"area === 'transporte'\" />");
  });

  it("SQL aditivo con los 10 que cargan, y los dos schemas iguales", () => {
    const sql = leer("prisma/migrate-cargue-camiones.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS cargues_camion");
    expect(sql).toContain("('JONATAN ORTEGA'), ('HECTOR CAÑAS')");
    expect(sql).toContain("WHERE NOT EXISTS (SELECT 1 FROM operarios_cargue)");
    expect(leer("prisma/schema.prisma")).toBe(leer("nuxt-app/prisma/schema.prisma"));
  });

  it("$fetch sin tipado por ruta (con mas de ~210 rutas reventaba el chequeo de tipos)", () => {
    expect(leer("nuxt-app/nuxt.config.ts")).toContain("'types:extend'(types) {\n        types.routes = {}");
  });
});
